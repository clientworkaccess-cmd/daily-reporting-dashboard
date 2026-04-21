"use client";

import type { ChartMetric, LocationCardData } from "@/types/dashboard";
import { SectionShell } from "@/components/dashboard/SectionShell";
import { MiniTrendChart } from "@/components/ui/MiniTrendChart";

interface ChartSectionProps {
  title: string;
  metric: ChartMetric;
  locations: LocationCardData[];
  dayCount?: number;
}

export function ChartSection({ title, metric, locations, dayCount }: ChartSectionProps) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((loc) => (
          <div key={`${title}-${loc.id}`}>
            <p className="mb-1 text-center text-[9px] font-medium text-slate-500">
              {loc.label}
            </p>
            <MiniTrendChart lines={loc.charts[metric]} dayCount={dayCount} />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
