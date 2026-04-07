"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchLatestKPIs,
  fetchReportingData,
  fetchForecasts,
} from "@/lib/dataService";
import {
  buildMonthMap,
  createFallbackLocation,
  emptyCharts,
  extractTrendLines,
  FALLBACK_DASHBOARD,
  locationList,
  parseMoveInOut,
  selectDateForMonth,
  toNumber,
} from "@/lib/utils";
import { CHART_METRICS, LIVE_LOCATIONS, LOCATION_META } from "@/lib/constants";
import type {
  ChartMetric,
  ChartPoint,
  DashboardState,
  KPIResponse,
  KPISelection,
  LiveLocation,
  LocationCardData,
  LocationKey,
  ReportingResponse,
} from "@/types/dashboard";

// ─── Build one live location card ─────────────────────────────────────────────

async function buildLiveLocationCard(
  location: LiveLocation,
  selectedYear: number,
  selectedMonth: number
): Promise<{
  location: LiveLocation;
  data: LocationCardData;
  availableDates: KPISelection[];
} | null> {
  const latest = (await fetchLatestKPIs(location)) as KPIResponse | null;
  if (!latest) return null;

  const chosenDate = selectDateForMonth(
    latest.availableDates,
    selectedYear,
    selectedMonth
  );

  if (!chosenDate) {
    return {
      location,
      availableDates: latest.availableDates,
      data: {
        id:          location,
        label:       LOCATION_META[location].label,
        revenue:     0,
        lastRevenue: null,
        forecast:    0,
        occupancy:   0,
        moveIns:     0,
        moveOuts:    0,
        arrears:     0,
        insurance:   0,
        autopay:     0,
        leads:       0,
        charts:      emptyCharts(),
      },
    };
  }

  let metrics = latest.metrics;

  if (chosenDate.raw !== latest.selectedDate) {
    const selected = (await fetchLatestKPIs(
      location,
      chosenDate.raw
    )) as KPIResponse | null;
    if (selected?.metrics) metrics = selected.metrics;
  }

  const moveValues = parseMoveInOut(metrics.move_in_out);

  const chartResponses = await Promise.all(
    CHART_METRICS.map(
      async (metric) =>
        (await fetchReportingData(location, "daily", metric)) as ReportingResponse
    )
  );

  const charts = CHART_METRICS.reduce<Record<ChartMetric, ChartPoint[][]>>(
    (acc, metric, idx) => {
      acc[metric] = extractTrendLines(
        chartResponses[idx],
        selectedYear,
        selectedMonth
      );
      return acc;
    },
    {} as Record<ChartMetric, ChartPoint[][]>
  );

  return {
    location,
    availableDates: latest.availableDates,
    data: {
      id:          location,
      label:       LOCATION_META[location].label,
      revenue:     toNumber(metrics.revenue),
      lastRevenue: metrics.last_revenue == null ? null : toNumber(metrics.last_revenue),
      forecast:    toNumber(metrics.forecast),
      occupancy:   toNumber(metrics.occupancy),
      moveIns:     moveValues.moveIns,
      moveOuts:    moveValues.moveOuts,
      arrears:     toNumber(metrics.arrears),
      insurance:   toNumber(metrics.insurance),
      autopay:     toNumber(metrics.autopay),
      leads:       toNumber(metrics.leads),
      charts,
    },
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const fallbackYear  = FALLBACK_DASHBOARD.years[0];
  const fallbackMonth = FALLBACK_DASHBOARD.monthsByYear[fallbackYear][0];

  const [dashboard, setDashboard]   = useState<DashboardState>(FALLBACK_DASHBOARD);
  const [selectedYear, setSelectedYear]   = useState<number>(fallbackYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(fallbackMonth);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const liveSnapshots = await Promise.all(
          LIVE_LOCATIONS.map((loc) =>
            buildLiveLocationCard(loc, selectedYear, selectedMonth)
          )
        );

        if (cancelled) return;

        const availableDates = liveSnapshots.flatMap(
          (s) => s?.availableDates ?? []
        );
        const { years, monthsByYear } = buildMonthMap(availableDates);

        const resolvedYear = years.includes(selectedYear) ? selectedYear : years[0];
        const months = monthsByYear[resolvedYear] ?? [selectedMonth];
        const resolvedMonth = months.includes(selectedMonth)
          ? selectedMonth
          : months[months.length - 1];

        if (resolvedYear  !== selectedYear)  setSelectedYear(resolvedYear);
        if (resolvedMonth !== selectedMonth) setSelectedMonth(resolvedMonth);

        const locationData: Record<LocationKey, LocationCardData> = {
          ...FALLBACK_DASHBOARD.locations,
        };

        liveSnapshots.forEach((snapshot) => {
          if (snapshot) locationData[snapshot.location] = snapshot.data;
        });

        // Fetch forecasts — no match for this month → 0
        const forecasts = await fetchForecasts(resolvedYear, resolvedMonth);
        (Object.keys(locationData) as LocationKey[]).forEach((key) => {
          if (forecasts[key] !== undefined) {
            locationData[key].forecast = forecasts[key] as number;
          }
        });

        setDashboard({ years, monthsByYear, locations: locationData });
      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedYear, selectedMonth]);

  const locations = useMemo(
    () => locationList(dashboard.locations),
    [dashboard.locations]
  );

  const monthsForYear = dashboard.monthsByYear[selectedYear] ?? [selectedMonth];

  return {
    dashboard,
    locations,
    selectedYear,
    selectedMonth,
    monthsForYear,
    loading,
    setSelectedYear,
    setSelectedMonth,
  };
}
