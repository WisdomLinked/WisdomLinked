import React from 'react';
import {
  formatAmount,
  type PaymentStatusAmount,
  type PaymentStatusTotals,
  EMPTY_PAYMENT_STATUS_TOTALS,
} from './paymentHistoryUtils';

function bucketText(amounts: PaymentStatusAmount[] | undefined): string {
  if (!amounts?.length) return formatAmount(0, 'usd');
  return amounts.map(row => formatAmount(row.cents, row.currency)).join(' · ');
}

const GROUPS: Array<{
  key: keyof PaymentStatusTotals;
  label: string;
  amountClass: string;
}> = [
  { key: 'paid', label: 'Paid', amountClass: 'text-emerald-800' },
  { key: 'failed', label: 'Failed', amountClass: 'text-red-700' },
  { key: 'refunded', label: 'Refunded', amountClass: 'text-slate-600' },
];

export default function PaymentStatusTotalsBar({
  totals,
}: {
  totals?: PaymentStatusTotals | null;
}) {
  const value = totals || EMPTY_PAYMENT_STATUS_TOTALS;
  return (
    <div
      data-testid="payment-history-totals-bar"
      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-0"
    >
      <div className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-wl-muted sm:pr-4 sm:pb-0.5">
        Total (filtered)
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
        {GROUPS.map((group, index) => (
          <div
            key={group.key}
            className={`min-w-0 sm:flex-1 sm:px-4 ${
              index > 0 ? 'border-t border-wl-line/80 pt-3 sm:border-t-0 sm:border-l sm:pt-0' : 'sm:pl-0'
            }`}
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-wl-muted">
              {group.label}
            </div>
            <div
              className={`mt-0.5 text-base font-semibold tabular-nums sm:text-[17px] ${group.amountClass}`}
            >
              {bucketText(value[group.key])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
