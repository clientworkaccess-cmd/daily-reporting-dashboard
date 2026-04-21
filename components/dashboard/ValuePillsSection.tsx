"use client";

import type { LocationCardData } from "@/types/dashboard";
import { LOCATION_META } from "@/lib/constants";
import { SectionShell } from "@/components/dashboard/SectionShell";

interface ValuePillsSectionProps {
  title: string;
  locations: LocationCardData[];
  formatter: (value: number, location: LocationCardData) => string;
  valueAccessor: (location: LocationCardData) => number;
}

export function ValuePillsSection({
  title,
  locations,
  formatter,
  valueAccessor,
}: ValuePillsSectionProps) {
  return (
    <SectionShell title={title}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {locations.map((location) => (
          <div
            key={`${title}-${location.id}`}
            className={`rounded-full px-2 py-1.5 text-center text-[11px] font-semibold text-white ${LOCATION_META[location.id].pillClass}`}
          >
            {formatter(valueAccessor(location), location)}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
