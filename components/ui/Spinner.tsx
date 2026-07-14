import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("h-3 w-3 animate-spin rounded-full border-2 border-border-dark border-t-text-semibold", className)} />
  );
}
