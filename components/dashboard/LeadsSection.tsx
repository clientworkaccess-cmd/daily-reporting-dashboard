import { UserRound } from "lucide-react";
import type { LocationCardData } from "@/types/dashboard";
import { LOCATION_META } from "@/lib/constants";
import { leadBubbleCount } from "@/lib/utils";
import { SectionShell } from "@/components/dashboard/SectionShell";

interface LeadsSectionProps {
  locations: LocationCardData[];
}

export function LeadsSection({ locations }: LeadsSectionProps) {
  return (
    <SectionShell title="Leads">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => {
          const icons = leadBubbleCount(location.leads);

          return (
            <div key={`leads-${location.id}`} className="text-center">
              <p className="mb-1 text-[9px] font-medium text-slate-500">{location.label}</p>
              <div className="grid grid-cols-7 justify-items-center gap-x-0.5 gap-y-0.5">
                {Array.from({ length: 21 }, (_, iconIndex) => (
                  <UserRound
                    key={`${location.id}-${iconIndex}`}
                    className={`h-3 w-3 ${iconIndex < icons ? LOCATION_META[location.id].iconClass : "text-slate-200"}`}
                    strokeWidth={2.3}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] font-semibold text-slate-600">{Math.round(location.leads)} leads</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
