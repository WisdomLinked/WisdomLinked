import React from 'react';

export default function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 text-left">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-wl-muted">{label}</div>
      <div className="mt-1 font-sans text-xl font-semibold tabular-nums text-wl-brand">{value}</div>
      <p className="mt-1 text-xs text-wl-muted">{hint}</p>
    </div>
  );
}
