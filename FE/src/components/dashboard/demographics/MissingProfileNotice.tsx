import React from 'react';

export default function MissingProfileNotice({
  message,
  onRemind,
}: {
  message: string;
  onRemind: () => void;
}) {
  if (!message) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-wl-card/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-wl-muted">{message}</p>
      <button
        type="button"
        onClick={onRemind}
        className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-wl-ink hover:border-wl-brand/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50"
      >
        Send reminder
      </button>
    </div>
  );
}
