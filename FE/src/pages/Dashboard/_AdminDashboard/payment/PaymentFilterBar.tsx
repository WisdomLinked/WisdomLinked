import React from 'react';
import SelectField from '../../../../components/ui/SelectField';
import ClearableInput, { FILTER_CONTROL_CLASS } from '../../../../components/ui/ClearableInput';
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
  /** When false (production live-only), hide the Stripe mode filter. */
  showStripeModeFilter = true,
}: {
  filters: HistoryFilters;
  emailDraft: string;
  activeCount: number;
  resultLabel: string;
  onEmailDraft: (value: string) => void;
  onChange: (patch: Partial<HistoryFilters>) => void;
  onClear: () => void;
  showStripeModeFilter?: boolean;
}) {
  const field = FILTER_CONTROL_CLASS;

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[1_1_160px]">
          <label htmlFor="payment-filter-email" className="mb-1 block text-[12px] text-wl-muted">
            Filter by email
          </label>
          <ClearableInput
            id="payment-filter-email"
            type="search"
            value={emailDraft}
            onChange={e => onEmailDraft(e.target.value)}
            placeholder="Exact user email"
          />
        </div>
        {showStripeModeFilter ? (
        <div className="min-w-0 flex-[1_1_120px]" data-testid="payment-filter-mode">
          <label htmlFor="payment-filter-mode" className="mb-1 block text-[12px] text-wl-muted">
            Stripe mode
          </label>
          <SelectField
            id="payment-filter-mode"
            value={filters.mode}
            onChange={mode => onChange({ mode })}
            options={[...MODE_OPTIONS]}
            placeholder="All"
            size="filter"
          />
        </div>
        ) : null}
        <div className="min-w-0 flex-[1_1_120px]" data-testid="payment-filter-status">
          <label htmlFor="payment-filter-status" className="mb-1 block text-[12px] text-wl-muted">
            Status
          </label>
          <SelectField
            id="payment-filter-status"
            value={filters.status}
            onChange={status => onChange({ status })}
            options={[...HISTORY_STATUS_OPTIONS]}
            placeholder="All"
            size="filter"
          />
        </div>
        <div className="min-w-0 flex-[1_1_120px]" data-testid="payment-filter-type">
          <label htmlFor="payment-filter-type" className="mb-1 block text-[12px] text-wl-muted">
            Payment type
          </label>
          <SelectField
            id="payment-filter-type"
            value={filters.type}
            onChange={type => onChange({ type })}
            options={[...PAYMENT_TYPE_OPTIONS]}
            placeholder="All"
            size="filter"
          />
        </div>
        <div className="flex w-full basis-full flex-wrap gap-3 xl:w-auto xl:basis-auto xl:flex-nowrap">
          <div className="min-w-[160px] flex-1 xl:flex-none">
            <label htmlFor="payment-filter-from" className="mb-1 block text-[12px] text-wl-muted">
              From
            </label>
            <input
              id="payment-filter-from"
              type="date"
              value={filters.from}
              onChange={e => onChange({ from: e.target.value })}
              className={`${field} min-w-[160px]`}
            />
          </div>
          <div className="min-w-[160px] flex-1 xl:flex-none">
            <label htmlFor="payment-filter-to" className="mb-1 block text-[12px] text-wl-muted">
              To
            </label>
            <input
              id="payment-filter-to"
              type="date"
              value={filters.to}
              onChange={e => onChange({ to: e.target.value })}
              className={`${field} min-w-[160px]`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
