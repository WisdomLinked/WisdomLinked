import React from 'react';
import type { AdminDemographicsLocation } from '../../../api/api';
import MissingProfileNotice from './MissingProfileNotice';
import {
  type AudienceFilter,
  locationCount,
  safePct,
} from './demographicsMath';

const BAR_GAP_PX = 2;

export default function LocationBars({
  rows,
  audience,
  knownTotal,
  missingMessage,
  onRemind,
}: {
  rows: AdminDemographicsLocation[];
  audience: AudienceFilter;
  knownTotal: number;
  missingMessage: string;
  onRemind: () => void;
}) {
  const max = Math.max(1, ...rows.map(row => locationCount(row, audience)));
  const showExperts = audience === 'all' || audience === 'experts';
  const showStudents = audience === 'all' || audience === 'students';

  return (
    <div className="min-w-0">
      <div className="mb-2 text-left text-xs font-semibold uppercase tracking-wider text-wl-muted">
        Locations
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-wl-muted">
        {showExperts ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-wl-brand" aria-hidden />
            Experts
          </span>
        ) : null}
        {showStudents ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brownyellow" aria-hidden />
            Students
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-wl-muted">
          No locations in this range yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(row => {
            const total = locationCount(row, audience);
            const pct = safePct(total, knownTotal);
            const expertShare = audience === 'all' && total > 0 ? row.experts / total : 0;
            const studentShare = audience === 'all' && total > 0 ? row.students / total : 0;
            const widthPct = Math.max(4, Math.round((total / max) * 100));
            const label =
              audience === 'all'
                ? `${row.country}: ${row.experts} experts, ${row.students} students (${pct}%)`
                : `${row.country}: ${total} (${pct}%)`;

            return (
              <li key={row.country} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2">
                <span className="truncate text-left text-sm font-medium text-wl-ink" title={row.country}>
                  {row.country}
                </span>
                <div
                  className="h-2.5 min-w-0 overflow-hidden rounded-full bg-wl-line/60"
                  role="img"
                  aria-label={label}
                  title={label}
                >
                  {audience === 'all' ? (
                    <div className="flex h-full" style={{ width: `${widthPct}%`, gap: BAR_GAP_PX }}>
                      {row.experts > 0 ? (
                        <div
                          className="h-full rounded-full bg-wl-brand"
                          style={{ flexGrow: expertShare || 0.0001, flexBasis: 0 }}
                        />
                      ) : null}
                      {row.students > 0 ? (
                        <div
                          className="h-full rounded-full bg-brownyellow"
                          style={{ flexGrow: studentShare || 0.0001, flexBasis: 0 }}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className={`h-full rounded-full ${audience === 'experts' ? 'bg-wl-brand' : 'bg-brownyellow'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  )}
                </div>
                <span className="whitespace-nowrap text-right text-xs tabular-nums text-wl-ink">
                  {total.toLocaleString()}
                  <span className="ml-1 text-wl-muted">{pct}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <MissingProfileNotice message={missingMessage} onRemind={onRemind} />
    </div>
  );
}
