"use client";

import { useEffect, useState } from "react";
import { fetchLatestKPIs, fetchReportingData, fetchForecasts } from "@/lib/dataService";
import type {
  DashboardState,
  KPIResponse,
  LocationCardData,
  LocationKey,
  LiveLocation,
  ReportingResponse,
  ChartMetric,
  KPISelection,
  TrendSeries
} from "@/types/dashboard";
import {
  LIVE_LOCATIONS,
  CHART_METRICS,
  LOCATION_META
} from "@/lib/constants";
import {
  buildMonthMap,
  selectDateForMonth,
  extractTrendLines,
  toNumber,
  parseMoveInOut,
  FALLBACK_DASHBOARD,
  locationList,
  formatPercent,
  emptyCharts
} from "@/lib/utils";

// Dashboard Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { DonutSection } from "@/components/dashboard/DonutSection";
import { LeadsSection } from "@/components/dashboard/LeadsSection";
import { RevenueComparisonSection } from "@/components/dashboard/RevenueComparisonSection";
import { ValuePillsSection } from "@/components/dashboard/ValuePillsSection";
import { MoveInOutSection } from "@/components/dashboard/MoveInOutSection";
import { Spinner } from "@/components/ui/Spinner";

async function buildLiveLocationCard(
  location: LiveLocation,
  selectedYear: number,
  selectedMonth: number,
): Promise<{ location: LiveLocation; data: LocationCardData; availableDates: KPISelection[] } | null> {
  const latest = (await fetchLatestKPIs(location)) as KPIResponse | null;
  if (!latest) {
    return null;
  }

  const chosenDate = selectDateForMonth(latest.availableDates, selectedYear, selectedMonth);
  if (!chosenDate) {
    return {
      location,
      availableDates: latest.availableDates,
      data: {
        id: location,
        label: LOCATION_META[location].label,
        revenue: 0,
        lastRevenue: null,
        forecast: 0,
        occupancy: 0,
        moveIns: 0,
        moveOuts: 0,
        arrears: 0,
        insurance: 0,
        autopay: 0,
        leads: 0,
        charts: emptyCharts(),
      },
    };
  }

  let metrics = latest.metrics;

  if (chosenDate.raw !== latest.selectedDate) {
    const selected = (await fetchLatestKPIs(location, chosenDate.raw)) as KPIResponse | null;
    if (selected?.metrics) {
      metrics = selected.metrics;
    }
  }

  const moveValues = parseMoveInOut(metrics.move_in_out);

  const chartResponses = await Promise.all(
    CHART_METRICS.map(async (metric) => (await fetchReportingData(location, "daily", metric)) as ReportingResponse),
  );

  const charts = CHART_METRICS.reduce<Record<ChartMetric, TrendSeries[]>>((acc, metric, metricIndex) => {
    acc[metric] = extractTrendLines(chartResponses[metricIndex], selectedYear, selectedMonth);
    return acc;
  }, {} as Record<ChartMetric, TrendSeries[]>);

  return {
    location,
    availableDates: latest.availableDates,
    data: {
      id: location,
      label: LOCATION_META[location].label,
      revenue: toNumber(metrics.revenue),
      lastRevenue: metrics.last_revenue == null ? null : toNumber(metrics.last_revenue),
      forecast: toNumber(metrics.forecast),
      occupancy: toNumber(metrics.occupancy),
      moveIns: moveValues.moveIns,
      moveOuts: moveValues.moveOuts,
      arrears: toNumber(metrics.arrears),
      insurance: toNumber(metrics.insurance),
      autopay: toNumber(metrics.autopay),
      leads: toNumber(metrics.leads),
      charts,
    },
  };
}

export default function DashboardPage() {
  const fallbackYear = FALLBACK_DASHBOARD.years[0];
  const fallbackMonth = FALLBACK_DASHBOARD.monthsByYear[fallbackYear][0];

  const [dashboard, setDashboard] = useState<DashboardState>(FALLBACK_DASHBOARD);
  const [selectedYear, setSelectedYear] = useState<number>(fallbackYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(fallbackMonth);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      try {
        const liveSnapshots = await Promise.all(
          LIVE_LOCATIONS.map((location) => buildLiveLocationCard(location, selectedYear, selectedMonth)),
        );

        if (cancelled) {
          return;
        }

        const availableDates = liveSnapshots.flatMap((snapshot) => snapshot?.availableDates ?? []);
        const { years, monthsByYear } = buildMonthMap(availableDates);

        const resolvedYear = years.includes(selectedYear) ? selectedYear : years[0];
        const months = monthsByYear[resolvedYear] ?? [selectedMonth];
        const resolvedMonth = months.includes(selectedMonth) ? selectedMonth : months[months.length - 1];

        if (resolvedYear !== selectedYear) {
          setSelectedYear(resolvedYear);
        }
        if (resolvedMonth !== selectedMonth) {
          setSelectedMonth(resolvedMonth);
        }

        const locationData: Record<LocationKey, LocationCardData> = {
          ...FALLBACK_DASHBOARD.locations,
        };

        liveSnapshots.forEach((snapshot) => {
          if (!snapshot) {
            return;
          }
          locationData[snapshot.location] = snapshot.data;
        });

        // Fetch forecasts from area_forecasts table
        const forecasts = await fetchForecasts(resolvedYear, resolvedMonth);
        Object.keys(locationData).forEach((key) => {
          const locationKey = key as LocationKey;
          if (forecasts[locationKey]) {
            locationData[locationKey].forecast = forecasts[locationKey];
          }
        });

        setDashboard({
          years,
          monthsByYear,
          locations: locationData,
        });
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [selectedYear, selectedMonth]);

  const sortedLocations = locationList(dashboard.locations);

  return (
    <main className="min-h-screen bg-[#f8fafc] p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <DashboardHeader
          years={dashboard.years}
          monthsForYear={dashboard.monthsByYear[selectedYear] ?? []}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          loading={loading}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />
        <div className={`space-y-6 transition-opacity duration-300 ${loading ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
          <div className={loading ? "flex flex-col h-screen w-full items-center justify-center text-slate-800 gap-4 fixed top-0 left-0 right-0 bottom-0 inset-0 opacity-100" : "hidden"}>
            <Spinner className="h-12 w-12 border-slate-200 border-t-slate-800" />
            <p className="text-lg font-semibold">Syncing...</p>
          </div>
          <ChartSection title="Revenue" metric="revenue" locations={sortedLocations} />
          <RevenueComparisonSection title="Revenue Comparison" locations={sortedLocations} />
          <ValuePillsSection
            title="Forecast"
            locations={sortedLocations}
            valueAccessor={(loc) => loc.forecast}
            formatter={(val) => `$${Math.round(val).toLocaleString()}`}
          />
          <ChartSection title="Occupancy" metric="occupancy" locations={sortedLocations} />
          <MoveInOutSection locations={sortedLocations} />
          <ChartSection title="Arrears" metric="arrears" locations={sortedLocations} />
          <DonutSection
            title="Arrears (Current Month)"
            locations={sortedLocations}
            valueAccessor={(loc) => loc.arrears}
          />
          <ChartSection title="Insurance" metric="insurance" locations={sortedLocations} />
          <DonutSection
            title="Insurance (Current Month)"
            locations={sortedLocations}
            valueAccessor={(loc) => loc.insurance}
          />
          <LeadsSection locations={sortedLocations} />
        </div>
      </div>
    </main>
  );
}
