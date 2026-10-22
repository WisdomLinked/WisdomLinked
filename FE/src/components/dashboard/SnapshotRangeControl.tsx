import React from 'react';
import {
  SNAPSHOT_RANGE_OPTIONS,
  type SnapshotRangeKey,
} from '../../utils/adminSnapshotRange';

export default function SnapshotRangeControl({
  value,
  onChange,
  id = 'snapshot-range',
}: {
  value: SnapshotRangeKey;
  onChange: (next: SnapshotRangeKey) => void;
  id?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      id={id}
      className="inline-flex max-w-full flex-wrap rounded-full border border-wl-line bg-white p-0.5"
    >
      {SNAPSHOT_RANGE_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50 focus-visible:ring-offset-2 ${
              selected ? 'bg-wl-brand text-white' : 'text-wl-muted hover:text-wl-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
