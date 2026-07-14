"use client";

import type { ReactNode } from "react";

interface SectionShellProps {
  title: string;
  children: ReactNode;
}

export function SectionShell({ title, children }: SectionShellProps) {
  return (
    <section className="rounded-[14px] border border-border-muted bg-white p-3">
      <h2 className="mb-2 text-[12px] font-semibold text-text-main">{title}</h2>
      {children}
    </section>
  );
}

