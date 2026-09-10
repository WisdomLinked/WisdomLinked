import React from 'react';
import SelectField from '../../../../components/ui/SelectField';
import {
  HISTORY_STATUS_OPTIONS,
  MODE_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  type HistoryFilters,
} from './paymentHistoryUtils';

export default function PaymentFilterBar({
  filters,
  emailDraft,
  activeCount,
  resultLabel,
  onEmailDraft,
  onChange,
  onClear,
}: {
  filters: HistoryFilters;
  emailDraft: string;
  activeCount: number;
  resultLabel: string;
  onEmailDraft: (value: string) => void;
  onChange: (patch: Partial<HistoryFilters>) => void;
  onClear: () => void;
}) {
  const field =
    'h-10 w-full rounded-xl border border-wl-line bg-white px-3 text-sm text-wl-ink outline-none focus:border-wl-brand focus:ring-2 focus:ring-wl-brand/40';

  return (
    <div className="space-y-3 border-b border-wl-line bg-wl-pageAlt/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-wl-ink" aria-live="polite">
          {resultLabel}
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} active` : ''}
        </p>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-wl-line bg-white px-3 py-1.5 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="payment-filter-email" className="mb-1 block text-[12px] text-wl-muted">
            Filter by email
          </label>
          <input
            id="payment-filter-email"
            type="search"
            value={emailDraft}
            onChange={e => onEmailDraft(e.target.value)}
            placeholder="Exact user email"
            className={field}
          />
        </div>
        <div data-testid="payment-filter-mode">
          <label htmlFor="payment-filter-mode" className="mb-1 block text-[12px] text-wl-muted">
            Stripe mode
          </label>
          <SelectField
            id="payment-filter-mode"
            value={filters.mode}
            onChange={mode => onChange({ mode })}
            options={[...MODE_OPTIONS]}
            placeholder="All"
          />
        </div>
        <div data-testid="payment-filter-status">
          <label htmlFor="payment-filter-status" className="mb-1 block text-[12px] text-wl-muted">
            Status
          </label>
          <SelectField
            id="payment-filter-status"
            value={filters.status}
            onChange={status => onChange({ status })}
            options={[...HISTORY_STATUS_OPTIONS]}
            placeholder="All"
          />
        </div>
        <div data-testid="payment-filter-type">
          <label htmlFor="payment-filter-type" className="mb-1 block text-[12px] text-wl-muted">
            Payment type
          </label>
          <SelectField
            id="payment-filter-type"
            value={filters.type}
            onChange={type => onChange({ type })}
            options={[...PAYMENT_TYPE_OPTIONS]}
            placeholder="All"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="payment-filter-from" className="mb-1 block text-[12px] text-wl-muted">
              From
            </label>
            <input
              id="payment-filter-from"
              type="date"
              value={filters.from}
              onChange={e => onChange({ from: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="payment-filter-to" className="mb-1 block text-[12px] text-wl-muted">
              To
            </label>
            <input
              id="payment-filter-to"
              type="date"
              value={filters.to}
              onChange={e => onChange({ to: e.target.value })}
              className={field}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
