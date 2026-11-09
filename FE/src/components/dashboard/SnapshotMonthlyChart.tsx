import React, { useState } from 'react';
import type { AdminSnapshotMonthlyPoint } from '../../api/api';
import { formatMoney, formatMoneyByCurrency, formatMonthKey } from '../../utils/adminSnapshotDisplay';
import { METRIC_VALUE_CLASS } from './MetricValue';

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/50';
const PLOT_H = 128;

function pointValue(point: AdminSnapshotMonthlyPoint, useAmount?: boolean): number {
  if (!useAmount) return point.count;
  return Object.values(point.amountsByCurrency || {}).reduce(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0,
  );
}

/** A month with payments whose money was all refunded reads $0, not "—". */
export function pointDisplay(point: AdminSnapshotMonthlyPoint, useAmount?: boolean): string {
  if (!useAmount) return point.count.toLocaleString();
  const money = formatMoneyByCurrency(point.amountsByCurrency, { fractionDigits: 0 });
  if (money) return money;
  return point.count > 0 ? formatMoney(0, 'usd', { fractionDigits: 0 }) || '$0' : '—';
}

function chartMaxDisplay(points: AdminSnapshotMonthlyPoint[], max: number, useAmount?: boolean): string {
  if (!useAmount) return max.toLocaleString();
  const currencies = Array.from(new Set(points.flatMap(p => Object.keys(p.amountsByCurrency || {}))));
  if (currencies.length === 1) {
    return formatMoney(max, currencies[0], { fractionDigits: 0 }) || max.toLocaleString();
  }
  return max.toLocaleString();
}

function plotBarHeight(value: number, max: number): number {
  return value > 0 && max > 0 ? Math.max(4, Math.round((value / max) * PLOT_H)) : 2;
}

/** "Nothing in this range" only when no month has a record; months that net to $0 still show. */
export function chartHasData(points: AdminSnapshotMonthlyPoint[], useAmount?: boolean): boolean {
  return points.some(p => pointValue(p, useAmount) > 0 || p.count > 0);
}

export default function SnapshotMonthlyChart({
  points,
  useAmount,
  title,
  emptyLabel,
}: {
  points: AdminSnapshotMonthlyPoint[] | undefined;
  useAmount?: boolean;
  title: string;
  emptyLabel: string;
}) {
  const rows = points || [];
  const [hovered, setHovered] = useState<number | null>(null);
  const values = rows.map(p => pointValue(p, useAmount));
  const max = Math.max(0, ...values);
  const latestWithData = rows.reduce((last, p, i) => (values[i] > 0 || p.count > 0 ? i : last), -1);
  const active = hovered ?? (latestWithData >= 0 ? latestWithData : rows.length - 1);
  const activePoint = rows[active];
  const activeLabel = activePoint ? formatMonthKey(activePoint.month).long : '';
  const activeValue = activePoint ? pointDisplay(activePoint, useAmount) : '';
  const labelEveryOther = rows.length > 8;
  const showBars = rows.length > 0 && chartHasData(rows, useAmount);

  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold text-ink">{title}</span>
        {activePoint ? (
          <span className="min-w-0 text-sm text-muted">
            {activeLabel}: <span className={METRIC_VALUE_CLASS}>{activeValue}</span>
          </span>
        ) : null}
      </figcaption>
      <div className="relative h-32 min-w-0 border-b border-line">
        {showBars ? (
          <>
            {max > 0 ? (
              <div className="pointer-events-none absolute right-1 top-1 text-xs font-numeric tabular-nums lining-nums tracking-tight text-muted">
                {chartMaxDisplay(rows, max, useAmount)}
              </div>
            ) : null}
            <div className="flex h-full min-w-0 items-end gap-1 sm:gap-2">
              {rows.map((p, i) => {
                const v = values[i] || 0;
                const isActive = i === active;
                const month = formatMonthKey(p.month);
                const display = pointDisplay(p, useAmount);
                return (
                  <button
                    key={p.month}
                    type="button"
                    aria-label={`${month.long}: ${display}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    className={`flex h-full min-w-0 flex-1 items-end ${FOCUS}`}
                  >
                    <span
                      style={{ height: plotBarHeight(v, max) }}
                      className={`block w-full rounded-t ${
                        v === 0 ? 'bg-line' : isActive ? 'bg-wl-brand' : 'bg-brand-soft'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            {emptyLabel}
          </p>
        )}
      </div>
      {rows.length ? (
        <div className="mt-1.5 flex min-w-0 gap-1 sm:gap-2">
          {rows.map((p, i) => {
            const month = formatMonthKey(p.month);
            const showLabel = !labelEveryOther || i % 2 === 0 || i === rows.length - 1;
            return (
              <span key={`lbl-${p.month}`} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted">
                {showLabel ? month.short : ''}
              </span>
            );
          })}
        </div>
      ) : null}
    </figure>
  );
}
