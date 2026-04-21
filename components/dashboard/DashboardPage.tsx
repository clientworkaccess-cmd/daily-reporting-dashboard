"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DonutSection } from "@/components/dashboard/DonutSection";
import { LeadsSection } from "@/components/dashboard/LeadsSection";
import { RevenueComparisonSection } from "@/components/dashboard/RevenueComparisonSection";
import { ValuePillsSection } from "@/components/dashboard/ValuePillsSection";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const {
    dashboard,
    locations,
    selectedYear,
    selectedMonth,
    monthsForYear,
    loading,
    setSelectedYear,
    setSelectedMonth,
  } = useDashboard();

  const dayCount = new Date(selectedYear, selectedMonth, 0).getDate();

  return (
    <main className="relative min-h-screen bg-[#f2f3f6] px-2 py-3 text-slate-700 sm:px-3">
      <div className="w-full rounded-[16px] border border-[#d8dde5] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
        <DashboardHeader
          years={dashboard.years}
          monthsForYear={monthsForYear}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          loading={loading}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />

        <div className="space-y-3">
          <ChartSection title="Revenue" metric="revenue" locations={locations} dayCount={dayCount} />

          <RevenueComparisonSection title="Revenue Comparison" locations={locations} />

          <ValuePillsSection
            title="Forecast"
            locations={locations}
            valueAccessor={(location) => location.forecast}
            formatter={(value) => formatCurrency(value)}
          />

          <ChartSection title="Occupancy" metric="occupancy" locations={locations} dayCount={dayCount} />

          <ValuePillsSection
            title="Move-in / Move-out"
            locations={locations}
            valueAccessor={(location) => location.moveIns}
            formatter={(_, location) =>
              `${Math.round(location.moveIns)} / ${Math.round(location.moveOuts)}`
            }
          />

          <ChartSection title="Arrears" metric="arrears" locations={locations} dayCount={dayCount} />

          <DonutSection
            title="Arrears (Current Month)"
            locations={locations}
            valueAccessor={(location) => location.arrears}
          />

          <ChartSection title="Insurance" metric="insurance" locations={locations} dayCount={dayCount} />

          <DonutSection
            title="Insurance (Current Month)"
            locations={locations}
            valueAccessor={(location) => location.insurance}
          />

          <ChartSection title="Autopay" metric="autopay" locations={locations} dayCount={dayCount} />

          <LeadsSection locations={locations} />
        </div>
      </div>

      <LoadingOverlay visible={loading} text="Loading dashboard data..." />
    </main>
  );
}
