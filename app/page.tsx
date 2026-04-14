"use client";

import { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { fetchLatestKPIs, fetchReportingData, fetchForecasts } from "@/lib/dataService";

type LiveLocation = "charlotte" | "houston";
type LocationKey = LiveLocation | "catawba" | "rock_hill";
type ChartMetric = "revenue" | "occupancy" | "arrears" | "insurance" | "autopay";
type ChartPoint = number | null;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface KPISelection {
  raw: string;
  day: string;
  month: string;
  year: string;
}

interface KPIResponse {
  metrics: Record<string, string | number | null | undefined>;
  availableDates: KPISelection[];
  selectedDate: string;
}

interface ReportingResponse {
  labels?: string[];
  datasets?: Array<{
    label?: string;
    data?: Array<number | null | undefined>;
  }>;
}

interface LocationCardData {
  id: LocationKey;
  label: string;
  revenue: number;
  lastRevenue: number | null;
  forecast: number;
  occupancy: number;
  moveIns: number;
  moveOuts: number;
  arrears: number;
  insurance: number;
  autopay: number;
  leads: number;
  charts: Record<ChartMetric, ChartPoint[][]>;
}

interface DashboardState {
  years: number[];
  monthsByYear: Record<number, number[]>;
  locations: Record<LocationKey, LocationCardData>;
}

const LOCATION_ORDER: LocationKey[] = ["charlotte", "houston", "catawba", "rock_hill"];
const LIVE_LOCATIONS: LiveLocation[] = ["charlotte", "houston"];
const CHART_METRICS: ChartMetric[] = ["revenue", "occupancy", "arrears", "insurance", "autopay"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LOCATION_META: Record<LocationKey, { label: string; pillClass: string; iconClass: string; donutColor: string }> = {
  charlotte: {
    label: "Charlotte",
    pillClass: "bg-[#2e88d1]",
    iconClass: "text-[#2e88d1]",
    donutColor: "#2e88d1",
  },
  houston: {
    label: "Houston",
    pillClass: "bg-[#9454c9]",
    iconClass: "text-[#9454c9]",
    donutColor: "#9454c9",
  },
  catawba: {
    label: "Catawba",
    pillClass: "bg-[#1d7d9c]",
    iconClass: "text-[#1d7d9c]",
    donutColor: "#1d7d9c",
  },
  rock_hill: {
    label: "Rock Hill",
    pillClass: "bg-[#3ca7c7]",
    iconClass: "text-[#3ca7c7]",
    donutColor: "#3ca7c7",
  },
};

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) {
    return 0;
  }
  const cleaned = value.toString().replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoveInOut(value: string | number | null | undefined): { moveIns: number; moveOuts: number } {
  const [moveIns, moveOuts] = `${value ?? "0/0"}`.split("/");
  return { moveIns: toNumber(moveIns), moveOuts: toNumber(moveOuts) };
}

function parseMonthName(monthName: string): number {
  const monthIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === monthName.toLowerCase());
  return monthIndex >= 0 ? monthIndex + 1 : 0;
}

function buildMonthMap(allDates: KPISelection[]): { years: number[]; monthsByYear: Record<number, number[]> } {
  const map = new Map<number, Set<number>>();

  allDates.forEach((entry) => {
    const year = Number.parseInt(entry.year, 10);
    const month = parseMonthName(entry.month);
    if (!year || !month) {
      return;
    }
    if (!map.has(year)) {
      map.set(year, new Set<number>());
    }
    map.get(year)?.add(month);
  });

  const years = Array.from(map.keys()).sort((a, b) => b - a);
  const monthsByYear: Record<number, number[]> = {};

  years.forEach((year) => {
    monthsByYear[year] = Array.from(map.get(year) ?? []).sort((a, b) => a - b);
  });

  if (years.length === 0) {
    const now = new Date();
    const fallbackYear = now.getFullYear();
    years.push(fallbackYear);
    monthsByYear[fallbackYear] = [now.getMonth() + 1];
  }

  return { years, monthsByYear };
}

function selectDateForMonth(dates: KPISelection[], selectedYear: number, selectedMonth: number): KPISelection | null {
  const matches = dates.filter(
    (entry) => Number.parseInt(entry.year, 10) === selectedYear && parseMonthName(entry.month) === selectedMonth,
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.sort((a, b) => Number.parseInt(b.day, 10) - Number.parseInt(a.day, 10))[0];
}

function parseDatasetLabel(label: string): Date | null {
  const normalized = label.trim();
  if (!normalized) {
    return null;
  }

  const shortMatch = normalized.match(/^([A-Za-z]{3})\s+(\d{2})$/);
  if (shortMatch) {
    const monthIndex = MONTH_SHORT.findIndex((month) => month.toLowerCase() === shortMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      const year = Number.parseInt(`20${shortMatch[2]}`, 10);
      return new Date(year, monthIndex, 1);
    }
  }

  const parsed = new Date(`${normalized} 1`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeSeries(rawSeries: Array<number | null | undefined>): ChartPoint[] {
  if (!rawSeries.length) {
    return [];
  }
  return rawSeries.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null));
}

function buildStaticLines(target: number): ChartPoint[][] {
  const safeTarget = Math.max(target, 1);
  const days = 31;

  return [0.6, 0.73, 0.86, 1].map((scale, lineIndex) =>
    Array.from({ length: days }, (_, dayIndex) => {
      const progress = dayIndex / (days - 1);
      const start = safeTarget * (0.18 + lineIndex * 0.07);
      const end = safeTarget * scale;
      const wave = Math.sin((dayIndex + 1) * (0.3 + lineIndex * 0.06)) * safeTarget * 0.01;
      return Number(Math.max(start + (end - start) * progress + wave, 0).toFixed(2));
    }),
  );
}

function cleanLines(lines: ChartPoint[][]): ChartPoint[][] {
  return lines.filter((line) => line.some((value) => typeof value === "number"));
}

function extractTrendLines(data: ReportingResponse, selectedYear: number, selectedMonth: number): ChartPoint[][] {
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];

  const parsed = datasets
    .map((dataset, index) => {
      const date = parseDatasetLabel(dataset.label ?? "");
      const key = date ? `${date.getFullYear()}-${date.getMonth() + 1}` : `unknown-${index}`;
      return {
        key,
        date,
        points: normalizeSeries(Array.isArray(dataset.data) ? dataset.data : []),
      };
    })
    .sort((a, b) => {
      const aTime = a.date?.getTime() ?? Number.MIN_SAFE_INTEGER + 1;
      const bTime = b.date?.getTime() ?? Number.MIN_SAFE_INTEGER + 1;
      return aTime - bTime;
    });

  if (!parsed.length) {
    return [];
  }

  const targetKey = `${selectedYear}-${selectedMonth}`;
  let endIndex = parsed.findIndex((entry) => entry.key === targetKey);

  if (endIndex < 0) {
    return [];
  }

  const scoped = parsed.slice(Math.max(0, endIndex - 3), endIndex + 1).map((entry) => entry.points);
  return cleanLines(scoped);
}

function createFallbackLocation(
  id: LocationKey,
  seed: {
    revenue: number;
    lastRevenue: number | null;
    forecast: number;
    occupancy: number;
    moveIns: number;
    moveOuts: number;
    arrears: number;
    insurance: number;
    autopay: number;
    leads: number;
  },
): LocationCardData {
  return {
    id,
    label: LOCATION_META[id].label,
    revenue: seed.revenue,
    lastRevenue: seed.lastRevenue,
    forecast: seed.forecast,
    occupancy: seed.occupancy,
    moveIns: seed.moveIns,
    moveOuts: seed.moveOuts,
    arrears: seed.arrears,
    insurance: seed.insurance,
    autopay: seed.autopay,
    leads: seed.leads,
    charts: {
      revenue: buildStaticLines(seed.revenue),
      occupancy: buildStaticLines(seed.occupancy),
      arrears: buildStaticLines(seed.arrears),
      insurance: buildStaticLines(seed.insurance),
      autopay: buildStaticLines(seed.autopay),
    },
  };
}

const FALLBACK_DASHBOARD: DashboardState = {
  years: [new Date().getFullYear()],
  monthsByYear: {
    [new Date().getFullYear()]: [new Date().getMonth() + 1],
  },
  locations: {
    charlotte: createFallbackLocation("charlotte", {
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
    }),
    houston: createFallbackLocation("houston", {
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
    }),
    catawba: createFallbackLocation("catawba", {
      revenue: 19000,
      lastRevenue: 17600,
      forecast: 19000,
      occupancy: 92.6,
      moveIns: 9,
      moveOuts: 6,
      arrears: 3.4,
      insurance: 29.4,
      autopay: 69.8,
      leads: 14,
    }),
    rock_hill: createFallbackLocation("rock_hill", {
      revenue: 14000,
      lastRevenue: 13200,
      forecast: 14000,
      occupancy: 90.1,
      moveIns: 8,
      moveOuts: 7,
      arrears: 2.8,
      insurance: 25.7,
      autopay: 67.2,
      leads: 11,
    }),
  },
};

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function locationList(locations: Record<LocationKey, LocationCardData>): LocationCardData[] {
  return LOCATION_ORDER.map((id) => locations[id]);
}

function leadBubbleCount(leads: number): number {
  if (leads <= 0) {
    return 0;
  }
  if (leads <= 20) {
    return Math.round(leads);
  }
  return Math.min(21, Math.max(8, Math.round(leads / 3)));
}

function MiniTrendChart({ lines }: { lines: ChartPoint[][] }) {
  const normalizedLines = cleanLines(lines);
  if (normalizedLines.length === 0) {
    return <div className="flex h-[112px] w-full items-center justify-center text-[10px] text-slate-400">No data</div>;
  }

  const pointCount = Math.max(2, ...normalizedLines.map((line) => line.length));
  const labels = Array.from({ length: pointCount }, (_, index) => `${index + 1}`);

  const chartData = {
    labels,
    datasets: normalizedLines.map((series, index) => ({
      label: `Month ${index + 1}`,
      data: series,
      borderColor: ["#89c2ff", "#b495d6", "#6fa9c2", "#66cde0"][index],
      backgroundColor: "transparent",
      borderWidth: index === normalizedLines.length - 1 ? 2.4 : 1.8,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointHitRadius: 10,
      tension: 0.35,
      spanGaps: true,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#ffffff",
        bodyColor: "#e2e8f0",
        displayColors: false,
        callbacks: {
          title: (items: any[]) => `Day ${items[0]?.label ?? ""}`,
          label: (ctx: any) => `${Number(ctx.raw).toLocaleString("en-US")}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#9aa4b2",
          font: { size: 8 },
          maxRotation: 0,
          autoSkip: false,
          callback: (_: unknown, index: number) => {
            const day = index + 1;
            return [1, 7, 14, 21, 28, pointCount].includes(day) ? `${day}` : "";
          },
        },
      },
      y: {
        grid: { color: "#eef2f7" },
        ticks: {
          color: "#9aa4b2",
          font: { size: 8 },
          callback: (value: string | number) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000) {
              return `${Math.round(num / 1000)}k`;
            }
            if (Math.abs(num) >= 100) {
              return `${Math.round(num)}`;
            }
            return `${Math.round(num * 10) / 10}`;
          },
        },
      },
    },
  };

  return (
    <div className="h-[120px] w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[12px] font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function ChartSection({
  title,
  metric,
  locations,
}: {
  title: string;
  metric: ChartMetric;
  locations: LocationCardData[];
}) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => (
          <div key={`${title}-${location.id}`}>
            <p className="mb-1 text-center text-[9px] font-medium text-slate-500">{location.label}</p>
            <MiniTrendChart lines={location.charts[metric]} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function lastDefinedValue(series?: Array<number | null | undefined>): number | null {
  if (!series) {
    return null;
  }
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const value = series[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatCurrencyMaybe(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return "-";
  }
  return formatCurrency(value);
}

function RevenueComparisonSection({ title, locations }: { title: string; locations: LocationCardData[] }) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 min-[250px]:grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => (
          <div key={`${title}-${location.id}`} className="text-center">
            <p className="text-[9px] font-medium text-slate-500">{location.label}</p>
            {(() => {
              const currentFromChart = lastDefinedValue(location.charts.revenue[location.charts.revenue.length - 1]);
              const current = isFiniteNumber(location.revenue) && location.revenue > 0 ? location.revenue : currentFromChart;
              const previousFromChart = lastDefinedValue(location.charts.revenue[location.charts.revenue.length - 2]);
              const previous = isFiniteNumber(location.lastRevenue) ? location.lastRevenue : previousFromChart;
              const secondPrevious = lastDefinedValue(location.charts.revenue[location.charts.revenue.length - 3]);

              return (
                <>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Current: <span className="font-semibold text-slate-700">{formatCurrencyMaybe(current)}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Last: <span className="font-semibold text-slate-600">{formatCurrencyMaybe(previous)}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    2nd Last: <span className="font-semibold text-slate-600">{formatCurrencyMaybe(secondPrevious)}</span>
                  </p>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function ValuePillsSection({
  title,
  locations,
  formatter,
  valueAccessor,
}: {
  title: string;
  locations: LocationCardData[];
  formatter: (value: number, location: LocationCardData) => string;
  valueAccessor: (location: LocationCardData) => number;
}) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => (
          <div
            key={`${title}-${location.id}`}
            className={`rounded-full px-2 py-1.5 text-center text-[11px] font-semibold text-white ${LOCATION_META[location.id].pillClass}`}
          >
            {formatter(valueAccessor(location), location)}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function DonutMeter({ value, color }: { value: number; color: string }) {
  const size = 80;
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(value, 100));
  const strokeDashoffset = circumference * (1 - normalized / 100);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[72px] w-[72px]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ecf0f4" strokeWidth="10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function DonutSection({
  title,
  locations,
  valueAccessor,
}: {
  title: string;
  locations: LocationCardData[];
  valueAccessor: (location: LocationCardData) => number;
}) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 min-[250px]:grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => (
          <div key={`${title}-${location.id}`} className="text-center">
            <p className="mb-1 text-[9px] font-medium text-slate-500">{location.label}</p>
            <DonutMeter value={valueAccessor(location)} color={LOCATION_META[location.id].donutColor} />
            <p className="mt-0.5 text-[10px] font-semibold text-slate-600">{formatPercent(valueAccessor(location))}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function LeadsSection({ locations }: { locations: LocationCardData[] }) {
  return (
    <SectionShell title="Leads">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => {
          const icons = leadBubbleCount(location.leads);

          return (
            <div key={`leads-${location.id}`} className="text-center">
              <p className="mb-1 text-[9px] font-medium text-slate-500">{location.label}</p>
              <div className="grid grid-cols-7 justify-items-center gap-x-0.5 gap-y-0.5">
                {Array.from({ length: 21 }, (_, iconIndex) => (
                  <UserRound
                    key={`${location.id}-${iconIndex}`}
                    className={`h-3 w-3 ${iconIndex < icons ? LOCATION_META[location.id].iconClass : "text-slate-200"}`}
                    strokeWidth={2.3}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] font-semibold text-slate-600">{Math.round(location.leads)} leads</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

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
    const emptyCharts = CHART_METRICS.reduce<Record<ChartMetric, ChartPoint[][]>>((acc, metric) => {
      acc[metric] = [];
      return acc;
    }, {} as Record<ChartMetric, ChartPoint[][]>);

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
        charts: emptyCharts,
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

  const charts = CHART_METRICS.reduce<Record<ChartMetric, ChartPoint[][]>>((acc, metric, metricIndex) => {
    acc[metric] = extractTrendLines(chartResponses[metricIndex], selectedYear, selectedMonth);
    return acc;
  }, {} as Record<ChartMetric, ChartPoint[][]>);

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
        const forecasts = await fetchForecasts();
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
      } catch (error) {
        console.error("Failed to load dashboard data", error);
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

  const locations = useMemo(() => locationList(dashboard.locations), [dashboard.locations]);
  const monthsForYear = dashboard.monthsByYear[selectedYear] ?? [selectedMonth];

  return (
    <main className="relative min-h-screen bg-[#f2f3f6] px-2 py-3 text-slate-700 sm:px-3">
      <div className="w-full rounded-[16px] border border-[#d8dde5] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
        <header className="mb-3 flex flex-col gap-2 rounded-[12px] border border-slate-200 bg-[#f8f9fb] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[12px] font-semibold text-slate-700">Daily Sales Reporting</h1>
          <div className="flex flex-wrap items-center gap-2">
            {loading && <span className="hidden text-[10px] text-slate-400 sm:inline">Syncing...</span>}
            <select
              className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number.parseInt(event.target.value, 10))}
            >
              {dashboard.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number.parseInt(event.target.value, 10))}
            >
              {monthsForYear.map((month) => (
                <option key={`${selectedYear}-${month}`} value={month}>
                  {MONTH_NAMES[month - 1]}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="space-y-3">
          <ChartSection title="Revenue" metric="revenue" locations={locations} />

          <RevenueComparisonSection title="Revenue Comparison" locations={locations} />

          <ValuePillsSection
            title="Forecast"
            locations={locations}
            valueAccessor={(location) => location.forecast}
            formatter={(value) => formatCurrency(value)}
          />

          <ChartSection title="Occupancy" metric="occupancy" locations={locations} />

          <ValuePillsSection
            title="Move-in / Move-out"
            locations={locations}
            valueAccessor={(location) => location.moveIns}
            formatter={(_, location) => `${Math.round(location.moveIns)} / ${Math.round(location.moveOuts)}`}
          />

          <ChartSection title="Arrears" metric="arrears" locations={locations} />

          <DonutSection title="Arrears (Current Month)" locations={locations} valueAccessor={(location) => location.arrears} />

          <ChartSection title="Insurance" metric="insurance" locations={locations} />

          <DonutSection
            title="Insurance (Current Month)"
            locations={locations}
            valueAccessor={(location) => location.insurance}
          />

          <LeadsSection locations={locations} />
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/45 backdrop-blur-[4px]">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-center shadow-lg">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-500" />
            <p className="mt-2 text-xs font-medium text-slate-600">Loading dashboard data...</p>
          </div>
        </div>
      )}
    </main>
  );
}
