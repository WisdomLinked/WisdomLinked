import React from 'react';
import MetricValue from './MetricValue';
import type { AmountByCurrency } from '../../api/api';
import { formatMoney, formatMoneyByCurrency } from '../../utils/adminSnapshotDisplay';

export type KpiItem = { label: string; value: string; hint?: string };

export const PAYMENTS_COUNT_HINT = 'Paid or partly refunded';

/** COLLECTED reads $0 (not "—") when there were payments but every one was refunded. */
export function collectedValue(amounts: AmountByCurrency | undefined, count: number): string {
  const money = formatMoneyByCurrency(amounts, { fractionDigits: 0 });
  if (money) return money;
  return count > 0 ? formatMoney(0, 'usd', { fractionDigits: 0 }) || '$0' : '—';
}

export function paymentKpis(range: { paymentsAmountByCurrency?: AmountByCurrency; paymentsCount: number }): KpiItem[] {
  const amounts = range.paymentsAmountByCurrency || {};
  const currencies = Object.keys(amounts);
  // AVERAGE = COLLECTED / COUNT; safe when COUNT is 0 or multi-currency.
  const average =
    range.paymentsCount > 0 && currencies.length <= 1
      ? formatMoney((amounts[currencies[0]] || 0) / range.paymentsCount, currencies[0] || 'usd')
      : '—';
  return [
    { label: 'Collected', value: collectedValue(amounts, range.paymentsCount) },
    { label: 'Count', value: range.paymentsCount.toLocaleString(), hint: PAYMENTS_COUNT_HINT },
    { label: 'Average', value: average || '—' },
  ];
}

export default function SnapshotKpiStrip({ kpis, loadingLabel = 'Loading…' }: { kpis: KpiItem[]; loadingLabel?: string }) {
  if (!kpis.length) {
    return <div className="min-w-0 rounded-xl border border-line bg-surface p-4 text-sm text-muted">{loadingLabel}</div>;
  }
  const cols =
    kpis.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : kpis.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`min-w-0 grid ${cols} gap-px overflow-hidden rounded-xl border border-line bg-line`}>
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          // Two columns on phones: an odd last figure takes the whole row instead of leaving an empty cell.
          className={`min-w-0 bg-surface px-5 py-4 ${
            kpis.length % 2 === 1 && i === kpis.length - 1 ? 'col-span-2 sm:col-span-1' : ''
          }`}
        >
          <div className="text-xs uppercase tracking-wider text-muted">{kpi.label}</div>
          <MetricValue size="md" className="break-words">
            {kpi.value}
          </MetricValue>
          {kpi.hint ? <div className="mt-1 text-xs text-muted">{kpi.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
