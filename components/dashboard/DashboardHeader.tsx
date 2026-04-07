import { MONTH_NAMES } from "@/lib/constants";

interface DashboardHeaderProps {
  years: number[];
  monthsForYear: number[];
  selectedYear: number;
  selectedMonth: number;
  loading: boolean;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export function DashboardHeader({
  years,
  monthsForYear,
  selectedYear,
  selectedMonth,
  loading,
  onYearChange,
  onMonthChange,
}: DashboardHeaderProps) {
  return (
    <header className="mb-3 flex flex-col gap-2 rounded-[12px] border border-slate-200 bg-[#f8f9fb] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-[12px] font-semibold text-slate-700">
        Daily Sales Reporting
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {loading && (
          <div className="flex items-center gap-1.5 px-2">
            <div className="h-2 w-2 animate-spin rounded-full border border-slate-300 border-t-slate-600" />
            <span className="text-[10px] font-medium text-slate-500">
              Syncing…
            </span>
          </div>
        )}

        {/* Year selector */}
        <select
          className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none"
          value={selectedYear}
          onChange={(e) => onYearChange(Number.parseInt(e.target.value, 10))}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {/* Month selector */}
        <select
          className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none"
          value={selectedMonth}
          onChange={(e) => onMonthChange(Number.parseInt(e.target.value, 10))}
        >
          {monthsForYear.map((month) => (
            <option key={`${selectedYear}-${month}`} value={month}>
              {MONTH_NAMES[month - 1]}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
