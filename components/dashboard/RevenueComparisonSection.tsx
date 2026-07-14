"use client";

import type { LocationCardData } from "@/types/dashboard";
import { formatCurrencyMaybe, isFiniteNumber, lastDefinedValue } from "@/lib/utils";
import { SectionShell } from "@/components/dashboard/SectionShell";

interface RevenueComparisonSectionProps {
  title: string;
  locations: LocationCardData[];
}

export function RevenueComparisonSection({
  title,
  locations,
}: RevenueComparisonSectionProps) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 min-[250px]:grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((loc) => {
          const chartRevenue = loc.charts.revenue;
          const currentFromChart = lastDefinedValue(chartRevenue[chartRevenue.length - 1]?.points);
          const current =
            isFiniteNumber(loc.revenue) && loc.revenue > 0
              ? loc.revenue
              : currentFromChart;
          const previousFromChart = lastDefinedValue(chartRevenue[chartRevenue.length - 2]?.points);
          const previous = isFiniteNumber(loc.lastRevenue)
            ? loc.lastRevenue
            : previousFromChart;
          const secondPrevious = lastDefinedValue(chartRevenue[chartRevenue.length - 3]?.points);

          return (
            <div key={`${title}-${loc.id}`} className="text-center">
              <p className="text-[9px] font-medium text-text-muted">{loc.label}</p>
              <p className="mt-1 text-[10px] text-text-muted">
                Current:{" "}
                <span className="font-semibold text-text-main">
                  {formatCurrencyMaybe(current)}
                </span>
              </p>
              <p className="text-[10px] text-text-light">
                Last:{" "}
                <span className="font-semibold text-text-semibold">
                  {formatCurrencyMaybe(previous)}
                </span>
              </p>
              <p className="text-[10px] text-text-light">
                2nd Last:{" "}
                <span className="font-semibold text-text-semibold">
                  {formatCurrencyMaybe(secondPrevious)}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
