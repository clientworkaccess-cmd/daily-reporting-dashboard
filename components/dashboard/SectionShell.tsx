"use client";

import type { ReactNode } from "react";

interface SectionShellProps {
  title: string;
  children: ReactNode;
}

export function SectionShell({ title, children }: SectionShellProps) {
  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[12px] font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

