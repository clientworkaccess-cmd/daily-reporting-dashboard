import type {
  ChartMetric,
  ChartPoint,
  DashboardState,
  KPISelection,
  LocationCardData,
  LocationKey,
  ReportingResponse,
} from "@/types/dashboard";
import {
  CHART_METRICS,
  LOCATION_META,
  LOCATION_ORDER,
  MONTH_NAMES,
  MONTH_SHORT,
} from "@/lib/constants";

// ─── Number helpers ───────────────────────────────────────────────────────────

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = value.toString().replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseMoveInOut(value: string | number | null | undefined): {
  moveIns: number;
  moveOuts: number;
} {
  const [moveIns, moveOuts] = `${value ?? "0/0"}`.split("/");
  return { moveIns: toNumber(moveIns), moveOuts: toNumber(moveOuts) };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatCurrencyMaybe(value: number | null | undefined): string {
  return isFiniteNumber(value) ? formatCurrency(value) : "-";
}

// ─── Month parsing ────────────────────────────────────────────────────────────

export function parseMonthName(monthName: string): number {
  const idx = MONTH_NAMES.findIndex(
    (name) => name.toLowerCase() === monthName.toLowerCase()
  );
  return idx >= 0 ? idx + 1 : 0;
}

export function buildMonthMap(allDates: KPISelection[]): {
  years: number[];
  monthsByYear: Record<number, number[]>;
} {
  const map = new Map<number, Set<number>>();

  allDates.forEach((entry) => {
    const year = Number.parseInt(entry.year, 10);
    const month = parseMonthName(entry.month);
    if (!year || !month) return;
    if (!map.has(year)) map.set(year, new Set<number>());
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

export function selectDateForMonth(
  dates: KPISelection[],
  selectedYear: number,
  selectedMonth: number
): KPISelection | null {
  const matches = dates.filter(
    (entry) =>
      Number.parseInt(entry.year, 10) === selectedYear &&
      parseMonthName(entry.month) === selectedMonth
  );
  if (matches.length === 0) return null;
  return matches.sort(
    (a, b) => Number.parseInt(b.day, 10) - Number.parseInt(a.day, 10)
  )[0];
}

// ─── Chart data helpers ───────────────────────────────────────────────────────

export function parseDatasetLabel(label: string): Date | null {
  const normalized = label.trim();
  if (!normalized) return null;

  const shortMatch = normalized.match(/^([A-Za-z]{3})\s+(\d{2})$/);
  if (shortMatch) {
    const monthIndex = MONTH_SHORT.findIndex(
      (m) => m.toLowerCase() === shortMatch[1].toLowerCase()
    );
    if (monthIndex >= 0) {
      const year = Number.parseInt(`20${shortMatch[2]}`, 10);
      return new Date(year, monthIndex, 1);
    }
  }

  const parsed = new Date(`${normalized} 1`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeSeries(
  rawSeries: Array<number | null | undefined>
): ChartPoint[] {
  return rawSeries.map((v) =>
    typeof v === "number" && Number.isFinite(v) ? v : null
  );
}

export function buildStaticLines(target: number): ChartPoint[][] {
  const safeTarget = Math.max(target, 1);
  const days = 31;
  return [0.6, 0.73, 0.86, 1].map((scale, lineIndex) =>
    Array.from({ length: days }, (_, dayIndex) => {
      const progress = dayIndex / (days - 1);
      const start = safeTarget * (0.18 + lineIndex * 0.07);
      const end = safeTarget * scale;
      const wave =
        Math.sin((dayIndex + 1) * (0.3 + lineIndex * 0.06)) * safeTarget * 0.01;
      return Number(Math.max(start + (end - start) * progress + wave, 0).toFixed(2));
    })
  );
}

export function cleanLines(lines: ChartPoint[][]): ChartPoint[][] {
  return lines.filter((line) => line.some((v) => typeof v === "number"));
}

export function extractTrendLines(
  data: ReportingResponse,
  selectedYear: number,
  selectedMonth: number
): ChartPoint[][] {
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];

  const parsed = datasets
    .map((dataset, index) => {
      const date = parseDatasetLabel(dataset.label ?? "");
      const key = date
        ? `${date.getFullYear()}-${date.getMonth() + 1}`
        : `unknown-${index}`;
      return {
        key,
        date,
        points: normalizeSeries(
          Array.isArray(dataset.data) ? dataset.data : []
        ),
      };
    })
    .sort((a, b) => {
      const aTime = a.date?.getTime() ?? Number.MIN_SAFE_INTEGER + 1;
      const bTime = b.date?.getTime() ?? Number.MIN_SAFE_INTEGER + 1;
      return aTime - bTime;
    });

  if (!parsed.length) return [];

  const targetKey = `${selectedYear}-${selectedMonth}`;
  const endIndex = parsed.findIndex((e) => e.key === targetKey);
  if (endIndex < 0) return [];

  const scoped = parsed
    .slice(Math.max(0, endIndex - 3), endIndex + 1)
    .map((e) => e.points);
  return cleanLines(scoped);
}

export function lastDefinedValue(
  series?: Array<number | null | undefined>
): number | null {
  if (!series) return null;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

// ─── Dashboard helpers ────────────────────────────────────────────────────────

export function createFallbackLocation(
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
  }
): LocationCardData {
  return {
    id,
    label: LOCATION_META[id].label,
    ...seed,
    charts: {
      revenue:   buildStaticLines(seed.revenue),
      occupancy: buildStaticLines(seed.occupancy),
      arrears:   buildStaticLines(seed.arrears),
      insurance: buildStaticLines(seed.insurance),
      autopay:   buildStaticLines(seed.autopay),
    },
  };
}

export const FALLBACK_DASHBOARD: DashboardState = {
  years: [new Date().getFullYear()],
  monthsByYear: { [new Date().getFullYear()]: [new Date().getMonth() + 1] },
  locations: {
    charlotte: createFallbackLocation("charlotte", {
      revenue: 0, lastRevenue: null, forecast: 0,
      occupancy: 0, moveIns: 0, moveOuts: 0,
      arrears: 0, insurance: 0, autopay: 0, leads: 0,
    }),
    houston: createFallbackLocation("houston", {
      revenue: 0, lastRevenue: null, forecast: 0,
      occupancy: 0, moveIns: 0, moveOuts: 0,
      arrears: 0, insurance: 0, autopay: 0, leads: 0,
    }),
    catawba: createFallbackLocation("catawba", {
      revenue: 19000, lastRevenue: 17600, forecast: 19000,
      occupancy: 92.6, moveIns: 9, moveOuts: 6,
      arrears: 3.4, insurance: 29.4, autopay: 69.8, leads: 14,
    }),
    rock_hill: createFallbackLocation("rock_hill", {
      revenue: 14000, lastRevenue: 13200, forecast: 14000,
      occupancy: 90.1, moveIns: 8, moveOuts: 7,
      arrears: 2.8, insurance: 25.7, autopay: 67.2, leads: 11,
    }),
  },
};

export function locationList(
  locations: Record<LocationKey, LocationCardData>
): LocationCardData[] {
  return LOCATION_ORDER.map((id) => locations[id]);
}

export function leadBubbleCount(leads: number): number {
  if (leads <= 0) return 0;
  if (leads <= 20) return Math.round(leads);
  return Math.min(21, Math.max(8, Math.round(leads / 3)));
}

// ─── Empty charts helper ──────────────────────────────────────────────────────

export function emptyCharts(): Record<ChartMetric, ChartPoint[][]> {
  return CHART_METRICS.reduce<Record<ChartMetric, ChartPoint[][]>>(
    (acc, metric) => { acc[metric] = []; return acc; },
    {} as Record<ChartMetric, ChartPoint[][]>
  );
}
