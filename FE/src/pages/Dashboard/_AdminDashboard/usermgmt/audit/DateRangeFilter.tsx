import React from 'react';
import { AUDIT_FOCUS } from './auditUi';
import { isRangeActive, type AuditDateRange } from './auditDateRange';

const INPUT_CLASS = `${AUDIT_FOCUS} h-9 w-full min-w-0 rounded-lg border border-audit-line bg-audit-surface px-2 text-sm tabular-nums text-audit-ink sm:w-[150px]`;

export default function DateRangeFilter({
  range,
  onChange,
}: {
  range: AuditDateRange;
  onChange: (range: AuditDateRange) => void;
}) {
  const setFrom = (from: string) => onChange({ from, to: range.to && from && range.to < from ? '' : range.to });
  const setTo = (to: string) => onChange({ from: range.from && to && range.from > to ? '' : range.from, to });

  return (
    <div role="group" aria-label="Filter by date" className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-audit-muted">Dates</span>
      <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto">
        <input
          type="date"
          aria-label="From date"
          value={range.from}
          max={range.to || undefined}
          onChange={event => setFrom(event.target.value)}
          className={INPUT_CLASS}
        />
        <span className="text-sm text-audit-muted" aria-hidden>
          –
        </span>
        <input
          type="date"
          aria-label="To date"
          value={range.to}
          min={range.from || undefined}
          onChange={event => setTo(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      {isRangeActive(range) ? (
        <button
          type="button"
          onClick={() => onChange({ from: '', to: '' })}
          className={`${AUDIT_FOCUS} ml-auto h-9 rounded-lg px-2 text-sm font-medium text-audit-brand hover:bg-audit-sunken sm:ml-0`}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
