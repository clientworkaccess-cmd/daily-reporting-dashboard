import type { LocationKey, ChartMetric } from "@/types/dashboard";

// ─── Location display metadata ────────────────────────────────────────────────

export const LOCATION_META: Record<
  LocationKey,
  { label: string; pillClass: string; iconClass: string; donutColor: string }
> = {
  charlotte: {
    label:      "Charlotte",
    pillClass:  "bg-[#2e88d1]",
    iconClass:  "text-[#2e88d1]",
    donutColor: "#2e88d1",
  },
  houston: {
    label:      "Houston",
    pillClass:  "bg-[#9454c9]",
    iconClass:  "text-[#9454c9]",
    donutColor: "#9454c9",
  },
  catawba: {
    label:      "Catawba",
    pillClass:  "bg-[#1d7d9c]",
    iconClass:  "text-[#1d7d9c]",
    donutColor: "#1d7d9c",
  },
  rock_hill: {
    label:      "Rock Hill",
    pillClass:  "bg-[#3ca7c7]",
    iconClass:  "text-[#3ca7c7]",
    donutColor: "#3ca7c7",
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
