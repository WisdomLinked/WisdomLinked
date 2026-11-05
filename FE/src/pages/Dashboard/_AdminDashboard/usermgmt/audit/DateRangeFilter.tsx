import React, { useEffect, useState } from 'react';
import { AUDIT_FOCUS } from './auditUi';
import { isRangeActive, type AuditDateRange } from './auditDateRange';

const INPUT_CLASS = `${AUDIT_FOCUS} h-9 w-full min-w-0 rounded-lg border border-audit-line bg-audit-surface px-2 text-sm tabular-nums text-audit-ink sm:w-[150px]`;

type Side = keyof AuditDateRange;

/** While a year is being typed the input reports 0002, 0020, 0202 before 2026. */
const isFinishedDay = (day: string) => day === '' || /^[1-9]\d{3}-\d{2}-\d{2}$/.test(day);
const isBackwards = ({ from, to }: AuditDateRange) => Boolean(from && to && from > to);

export default function DateRangeFilter({
  range,
  onChange,
}: {
  range: AuditDateRange;
  onChange: (range: AuditDateRange) => void;
}) {
  // What the inputs show. The filter only moves once a date is finished, so typing one
  // never filters on a half-typed year or wipes the other date on the way past.
  const [draft, setDraft] = useState<AuditDateRange>(range);
  const { from, to } = range;

  useEffect(() => {
    setDraft({ from, to });
  }, [from, to]);

  const edit = (side: Side, value: string) => {
    const shown = { ...draft, [side]: value };
    setDraft(shown);
    const next = {
      from: isFinishedDay(shown.from) ? shown.from : from,
      to: isFinishedDay(shown.to) ? shown.to : to,
    };
    if (isFinishedDay(value) && !isBackwards(next)) onChange(next);
  };

  const settle = (side: Side) => {
    const value = draft[side];
    if (!isFinishedDay(value)) {
      setDraft({ from, to });
      return;
    }
    if (isBackwards({ from, to, [side]: value })) onChange(side === 'from' ? { from: value, to: '' } : { from: '', to: value });
  };

  return (
    <div role="group" aria-label="Filter by date" className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-audit-muted">Dates</span>
      <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto">
        <input
          type="date"
          aria-label="From date"
          value={draft.from}
          max={to || undefined}
          onChange={event => edit('from', event.target.value)}
          onBlur={() => settle('from')}
          className={INPUT_CLASS}
        />
        <span className="text-sm text-audit-muted" aria-hidden>
          –
        </span>
        <input
          type="date"
          aria-label="To date"
          value={draft.to}
          min={from || undefined}
          onChange={event => edit('to', event.target.value)}
          onBlur={() => settle('to')}
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
