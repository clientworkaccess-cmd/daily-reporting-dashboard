"use client";

export function LoadingOverlay({ visible, text }: { visible: boolean; text: string }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/45 backdrop-blur-[4px]">
      <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-center shadow-lg">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-500" />
        <p className="mt-2 text-xs font-medium text-slate-600">{text}</p>
      </div>
    </div>
  );
}

