import type { LocationCardData } from "@/types/dashboard";
import { SectionShell } from "@/components/dashboard/SectionShell";
import { LOCATION_META } from "@/lib/constants";

interface MoveInOutSectionProps {
  locations: LocationCardData[];
}

export function MoveInOutSection({ locations }: MoveInOutSectionProps) {
  return (
    <SectionShell title="Move-in / Move-out">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((loc) => (
          <div
            key={`move-in-out-${loc.id}`}
            className={`rounded-full px-2 py-1.5 text-center text-[11px] font-semibold text-white ${LOCATION_META[loc.id].pillClass}`}
          >
            {loc.moveIns} / {loc.moveOuts}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
