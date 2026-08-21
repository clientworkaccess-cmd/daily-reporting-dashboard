import type { LocationKey, ChartMetric } from "@/types/dashboard";

// ─── Location display metadata ────────────────────────────────────────────────

export const LOCATION_META: Record<
  LocationKey,
  { label: string; pillClass: string; iconClass: string; donutColor: string }
> = {
  charlotte: {
    label:      "Charlotte",
    pillClass:  "bg-loc-charlotte",
    iconClass:  "text-loc-charlotte",
    donutColor: "var(--color-loc-charlotte)",
  },
  houston: {
    label:      "Houston",
    pillClass:  "bg-loc-houston",
    iconClass:  "text-loc-houston",
    donutColor: "var(--color-loc-houston)",
  },
  catawba: {
    label:      "Catawba",
    pillClass:  "bg-loc-catawba",
    iconClass:  "text-loc-catawba",
    donutColor: "var(--color-loc-catawba)",
  },
  rock_hill: {
    label:      "Rock Hill",
    pillClass:  "bg-loc-rock-hill",
    iconClass:  "text-loc-rock-hill",
    donutColor: "var(--color-loc-rock-hill)",
  },
};

// ─── Ordering ─────────────────────────────────────────────────────────────────

export const LOCATION_ORDER: LocationKey[] = ["charlotte", "houston", "catawba", "rock_hill"];
export const LIVE_LOCATIONS: Array<"charlotte" | "houston"> = ["charlotte", "houston"];
export const CHART_METRICS: ChartMetric[] = ["revenue", "occupancy", "arrears", "insurance", "autopay"];

// ─── Month names ──────────────────────────────────────────────────────────────

export const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
