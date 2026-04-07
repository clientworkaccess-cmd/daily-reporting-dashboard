import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600", className)} />
  );
}
