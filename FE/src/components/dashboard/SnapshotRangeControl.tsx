import React, { useEffect, useRef, useState } from 'react';
import {
  SNAPSHOT_RANGE_OPTIONS,
  snapshotCustomRangeValid,
  type SnapshotCustomRange,
  type SnapshotRangeKey,
} from '../../utils/adminSnapshotRange';

const PILL =
  'rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 focus-visible:ring-offset-2';

export default function SnapshotRangeControl({
  value,
  customRange,
  onChange,
  id = 'snapshot-range',
}: {
  value: SnapshotRangeKey;
  customRange?: SnapshotCustomRange | null;
  onChange: (next: SnapshotRangeKey, custom?: SnapshotCustomRange) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(customRange?.startDate ?? '');
  const [draftEnd, setDraftEnd] = useState(customRange?.endDate ?? '');
  const [error, setError] = useState('');
  const customRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraftStart(customRange?.startDate ?? '');
    setDraftEnd(customRange?.endDate ?? '');
    setError('');
  }, [open, customRange?.startDate, customRange?.endDate]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const applyCustom = () => {
    if (!draftStart || !draftEnd) {
      setError('Choose a start and end date');
      return;
    }
    if (!snapshotCustomRangeValid(draftStart, draftEnd)) {
      setError('End date must be on or after start date');
      return;
    }
    onChange('custom', { startDate: draftStart, endDate: draftEnd });
    setOpen(false);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      id={id}
      className="inline-flex max-w-full flex-wrap rounded-full border border-wl-line bg-white p-0.5"
    >
      {SNAPSHOT_RANGE_OPTIONS.map(opt => {
        const selected = value === opt.value;
        if (opt.value === 'custom') {
          return (
            <div key={opt.value} ref={customRef} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen(v => !v)}
                className={`${PILL} ${selected ? 'bg-wl-brand text-white' : 'text-wl-muted hover:text-wl-ink'}`}
              >
                {opt.label}
              </button>
              {open ? (
                <div
                  role="dialog"
                  aria-label="Custom date range"
                  className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-wl-line bg-white p-3 shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
                >
                  <div className="space-y-2">
                    <label className="block text-[11px] font-medium uppercase tracking-wide text-wl-muted" htmlFor={`${id}-start`}>
                      Start
                    </label>
                    <input
                      id={`${id}-start`}
                      type="date"
                      value={draftStart}
                      onChange={e => {
                        setDraftStart(e.target.value);
                        setError('');
                      }}
                      className="h-9 w-full rounded-lg border border-wl-line bg-white px-2 text-sm text-wl-ink outline-none focus:ring-2 focus:ring-wl-brand/30"
                    />
                    <label className="block text-[11px] font-medium uppercase tracking-wide text-wl-muted" htmlFor={`${id}-end`}>
                      End
                    </label>
                    <input
                      id={`${id}-end`}
                      type="date"
                      value={draftEnd}
                      min={draftStart || undefined}
                      onChange={e => {
                        setDraftEnd(e.target.value);
                        setError('');
                      }}
                      className="h-9 w-full rounded-lg border border-wl-line bg-white px-2 text-sm text-wl-ink outline-none focus:ring-2 focus:ring-wl-brand/30"
                    />
                    {error ? (
                      <p className="text-xs text-red-600" role="alert">
                        {error}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={applyCustom}
                      className="mt-1 w-full rounded-full bg-wl-brand px-3 py-1.5 text-xs font-medium text-white hover:brightness-95"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              setOpen(false);
              onChange(opt.value);
            }}
            className={`${PILL} ${selected ? 'bg-wl-brand text-white' : 'text-wl-muted hover:text-wl-ink'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
