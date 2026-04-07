import type { LocationCardData } from "@/types/dashboard";
import { formatCurrencyMaybe, isFiniteNumber, lastDefinedValue, formatCurrency } from "@/lib/utils";
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
          const currentFromChart = lastDefinedValue(chartRevenue[chartRevenue.length - 1]);
          const current =
            isFiniteNumber(loc.revenue) && loc.revenue > 0
              ? loc.revenue
              : currentFromChart;
          const previousFromChart = lastDefinedValue(chartRevenue[chartRevenue.length - 2]);
          const previous = isFiniteNumber(loc.lastRevenue)
            ? loc.lastRevenue
            : previousFromChart;
          const secondPrevious = lastDefinedValue(chartRevenue[chartRevenue.length - 3]);

          return (
            <div key={`${title}-${loc.id}`} className="text-center">
              <p className="text-[9px] font-medium text-slate-500">{loc.label}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                Current:{" "}
                <span className="font-semibold text-slate-700">
                  {formatCurrencyMaybe(current)}
                </span>
              </p>
              <p className="text-[10px] text-slate-400">
                Last:{" "}
                <span className="font-semibold text-slate-600">
                  {formatCurrencyMaybe(previous)}
                </span>
              </p>
              <p className="text-[10px] text-slate-400">
                2nd Last:{" "}
                <span className="font-semibold text-slate-600">
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
