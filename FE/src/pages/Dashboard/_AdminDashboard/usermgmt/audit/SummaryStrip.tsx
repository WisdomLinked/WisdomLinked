import React from 'react';
import { formatLastActive, formatUsdFromCents } from './auditModel';

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <div className="text-xs uppercase tracking-wider text-audit-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums text-audit-ink">{value}</div>
    </div>
  );
}

export default function SummaryStrip({
  conversationCount,
  seminarCount,
  netEarningsCents,
  lastActive,
}: {
  conversationCount: number;
  seminarCount: number;
  netEarningsCents: number;
  lastActive?: string;
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-audit-line overflow-hidden rounded-xl border border-audit-line lg:grid-cols-4 lg:divide-y-0">
      <Stat label="Conversations" value={String(conversationCount)} />
      <Stat label="Seminars" value={String(seminarCount)} />
      <Stat label="Net earnings" value={formatUsdFromCents(netEarningsCents)} />
      <Stat label="Last active" value={formatLastActive(lastActive)} />
    </div>
  );
}
