// ─── Core type aliases ────────────────────────────────────────────────────────

export type LiveLocation = "charlotte" | "houston";
export type LocationKey = LiveLocation | "catawba" | "rock_hill";
export type ChartMetric = "revenue" | "occupancy" | "arrears" | "insurance" | "autopay";
export type ChartPoint = number | null;

export interface TrendSeries {
  label: string;
  points: ChartPoint[];
}

// ─── Date selector ────────────────────────────────────────────────────────────

export interface KPISelection {
  raw: string;
  day: string;
  month: string;
  year: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface KPIResponse {
  metrics: Record<string, string | number | null | undefined>;
  availableDates: KPISelection[];
  selectedDate: string;
}

export interface ReportingDataset {
  label?: string;
  data?: Array<number | null | undefined>;
}

export interface ReportingResponse {
  labels?: string[];
  datasets?: ReportingDataset[];
}

// ─── Location card ────────────────────────────────────────────────────────────

export interface LocationCardData {
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
  charts: Record<ChartMetric, TrendSeries[]>;
}

// ─── Dashboard state ──────────────────────────────────────────────────────────

export interface DashboardState {
  years: number[];
  monthsByYear: Record<number, number[]>;
  locations: Record<LocationKey, LocationCardData>;
}
