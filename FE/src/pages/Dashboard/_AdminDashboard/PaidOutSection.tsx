import React, { useMemo, useState } from 'react';
import ClearableInput, { FILTER_CONTROL_CLASS } from '../../../components/ui/ClearableInput';
import { formatDollarsFromCents } from '../../../utils/bookingPrice';
import { payoutNumberText } from '../../../utils/payoutNumber';
import {
  EMPTY_PAID_OUT_FILTERS,
  countPaidOutFilters,
  filterPaidOut,
  formatChequeDate,
  payrollMonthLabel,
  type PaidOutCheque,
  type PaidOutFilters,
} from '../../../utils/paidOutFilter';

export default function PaidOutSection({
  cheques,
  loading,
  error,
}: {
  cheques: PaidOutCheque[];
  loading: boolean;
  error: string;
}) {
  const [filters, setFilters] = useState<PaidOutFilters>(EMPTY_PAID_OUT_FILTERS);
  const visible = useMemo(() => filterPaidOut(cheques, filters), [cheques, filters]);
  const activeCount = countPaidOutFilters(filters);
  const patch = (change: Partial<PaidOutFilters>) => setFilters(current => ({ ...current, ...change }));
  const clear = () => setFilters(EMPTY_PAID_OUT_FILTERS);

  return (
    <section
      aria-labelledby="paid-out-heading"
      className="overflow-hidden rounded-2xl border border-wl-line bg-white shadow-sm"
    >
      <div className="space-y-3 border-b border-wl-line bg-wl-pageAlt/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="paid-out-heading" className="text-lg font-semibold text-wl-brand">
              Paid out
            </h2>
            <p className="text-sm text-wl-ink" aria-live="polite">
              {loading
                ? 'Loading payouts…'
                : `Showing ${visible.length} of ${cheques.length} payouts`}
              {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} active` : ''}
            </p>
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="rounded-full border border-wl-line bg-white px-3 py-1.5 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_200px]">
            <label htmlFor="paid-out-filter-expert" className="mb-1 block text-[12px] text-wl-muted">
              Expert
            </label>
            <ClearableInput
              id="paid-out-filter-expert"
              type="search"
              value={filters.expert}
              onChange={e => patch({ expert: e.target.value })}
              placeholder="Name or email"
            />
          </div>
          <div className="min-w-0 flex-[1_1_200px]">
            <label htmlFor="paid-out-filter-number" className="mb-1 block text-[12px] text-wl-muted">
              Cheque / reference number
            </label>
            <ClearableInput
              id="paid-out-filter-number"
              type="search"
              value={filters.number}
              onChange={e => patch({ number: e.target.value })}
              placeholder="Number"
            />
          </div>
          <div className="flex w-full basis-full flex-wrap gap-3 xl:w-auto xl:basis-auto xl:flex-nowrap">
            <div className="min-w-[160px] flex-1 xl:flex-none">
              <label htmlFor="paid-out-filter-from" className="mb-1 block text-[12px] text-wl-muted">
                From
              </label>
              <input
                id="paid-out-filter-from"
                type="date"
                value={filters.from}
                onChange={e => patch({ from: e.target.value })}
                className={`${FILTER_CONTROL_CLASS} min-w-[160px]`}
              />
            </div>
            <div className="min-w-[160px] flex-1 xl:flex-none">
              <label htmlFor="paid-out-filter-to" className="mb-1 block text-[12px] text-wl-muted">
                To
              </label>
              <input
                id="paid-out-filter-to"
                type="date"
                value={filters.to}
                onChange={e => patch({ to: e.target.value })}
                className={`${FILTER_CONTROL_CLASS} min-w-[160px]`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {error && !loading ? <p className="text-sm text-rose-700">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-wl-muted">Loading payouts…</p>
        ) : cheques.length === 0 ? (
          error ? null : (
          <p className="text-sm text-wl-muted">No payouts recorded yet.</p>
          )
        ) : visible.length === 0 ? (
          <div className="text-sm text-wl-muted">
            No payouts match these filters.{' '}
            <button type="button" onClick={clear} className="font-medium text-wl-brand hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="paid-out-cheques">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-wl-brand">
                <tr>
                  <th className="px-3 py-2 font-medium">Expert</th>
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Cheque / reference number</th>
                  <th className="px-3 py-2 font-medium">Payment date</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(cheque => (
                  <tr
                    key={cheque._id || `${cheque.expertId}-${cheque.year}-${cheque.month}`}
                    className="border-t border-wl-line"
                  >
                    <td className="px-3 py-2 text-wl-ink">{cheque.expertName || cheque.expertEmail || 'Expert'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-wl-ink">{payrollMonthLabel(cheque.year, cheque.month)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-wl-ink">
                      {formatDollarsFromCents(Number(cheque.amountCents) || 0)}
                    </td>
                    <td className="max-w-[220px] break-all px-3 py-2 text-wl-ink">{payoutNumberText(cheque)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-wl-ink">
                      {formatChequeDate(cheque.chequeDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
