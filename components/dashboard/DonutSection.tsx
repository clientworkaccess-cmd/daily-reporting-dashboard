import type { LocationCardData } from "@/types/dashboard";
import { LOCATION_META } from "@/lib/constants";
import { formatPercent } from "@/lib/utils";
import { SectionShell } from "@/components/dashboard/SectionShell";
import { DonutMeter } from "@/components/ui/DonutMeter";

interface DonutSectionProps {
  title: string;
  locations: LocationCardData[];
  valueAccessor: (location: LocationCardData) => number;
}

export function DonutSection({
  title,
  locations,
  valueAccessor,
}: DonutSectionProps) {
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
