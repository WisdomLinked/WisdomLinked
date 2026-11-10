import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronRight, ExternalLink, RotateCcw, Search, Undo2 } from 'lucide-react';
import SelectField from '../../../../components/ui/SelectField';
import Pagination from '../../../../components/Pagination';
import { DateCell, FOCUS, StatusPill, UserCell } from '../../../../components/dashboard/records/RecordAtoms';
import RecordDetailPanel from '../../../../components/dashboard/records/RecordDetailPanel';
import {
  PaymentDetailFields,
  paymentHeader,
  toPaymentRow,
  type PaymentRow,
} from '../../../../components/dashboard/records/paymentRecord';
import { formatMoney, isValidRecordDate } from '../../../../utils/adminSnapshotDisplay';
import PaymentStatusTotalsBar from './PaymentStatusTotalsBar';
import {
  HISTORY_STATUS_OPTIONS,
  MODE_OPTIONS,
  PAYMENT_STATUS_HINTS,
  PAYMENT_TYPE_OPTIONS,
  canRefundPayment,
  canRetryPayment,
  paymentStatusLabel,
  paymentStatusTone,
  typePill,
  type BookingScope,
  type HistoryFilters,
  type PaymentHistoryRow,
  type PaymentStatusTotals,
} from './paymentHistoryUtils';

const WHEN_TABS: { id: BookingScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'past', label: 'Past bookings' },
  { id: 'upcoming', label: 'Upcoming bookings' },
];

const withAllLabel = (options: ReadonlyArray<{ value: string; label: string }>, all: string) =>
  options.map(o => (o.value === '' ? { value: '', label: all } : { value: o.value, label: o.label }));

const STATUS_FILTER = withAllLabel(HISTORY_STATUS_OPTIONS, 'All statuses');
const TYPE_FILTER = withAllLabel(PAYMENT_TYPE_OPTIONS, 'All types');
const MODE_FILTER = withAllLabel(MODE_OPTIONS, 'Test and live');

export function PaymentStatus({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <StatusPill
      status={status}
      label={paymentStatusLabel(status)}
      title={PAYMENT_STATUS_HINTS[status]}
      tone={paymentStatusTone(status)}
    />
  );
}

function TypeTag({ item }: { item: PaymentHistoryRow }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
      {typePill(item)}
    </span>
  );
}

function countLine(total: number, when: BookingScope, rangePhrase: string): string {
  const n = `${total.toLocaleString()} ${total === 1 ? 'payment' : 'payments'}`;
  if (when === 'upcoming') return `${n} for upcoming sessions · not limited by the date range`;
  if (when === 'past') return `${n} for sessions held · ${rangePhrase}`;
  return `${n} · ${rangePhrase}`;
}

const isDesktop = () => Boolean(window.matchMedia?.('(min-width: 1024px)')?.matches);

export default function PaymentHistoryList({
  filters,
  searchDraft,
  onSearchDraft,
  onChange,
  onClear,
  activeCount,
  showStripeModeFilter,
  rangePhrase,
  histories,
  totalCount,
  loading,
  loadError,
  onRetryLoad,
  hasLoaded,
  statusTotals,
  currentPage,
  pageSize,
  onPage,
  onPageSize,
  onRetryPayment,
  onRefundPayment,
}: {
  filters: HistoryFilters;
  searchDraft: string;
  onSearchDraft: (value: string) => void;
  onChange: (patch: Partial<HistoryFilters>) => void;
  onClear: () => void;
  activeCount: number;
  showStripeModeFilter: boolean;
  rangePhrase: string;
  histories: PaymentHistoryRow[];
  totalCount: number;
  loading: boolean;
  loadError: boolean;
  onRetryLoad: () => void;
  hasLoaded: boolean;
  statusTotals: PaymentStatusTotals;
  currentPage: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onRetryPayment: (item: PaymentHistoryRow) => void;
  onRefundPayment: (item: PaymentHistoryRow) => void;
}) {
  const rows = useMemo(() => histories.map(toPaymentRow), [histories]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the open record when it is still in the list (e.g. after a refund); otherwise open the first one on desktop.
  useEffect(() => {
    setSelectedId(current => {
      if (current && rows.some(r => r.id === current)) return current;
      return isDesktop() && rows.length ? rows[0].id : null;
    });
  }, [rows]);

  const selected: PaymentRow | null = rows.find(r => r.id === selectedId) || null;
  const close = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    if (!selectedId) return;
    const nodes = listRef.current?.querySelectorAll(`[data-row-id="${selectedId}"]`);
    const visible = Array.from(nodes || []).find(node => (node as HTMLElement).offsetParent !== null);
    (visible as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  const showBooking = rows.some(r => isValidRecordDate(r.bookingStart));
  const genuineEmpty = hasLoaded && !loading && !loadError && totalCount === 0 && activeCount === 0;
  const filteredEmpty = hasLoaded && !loading && !loadError && totalCount === 0 && activeCount > 0;

  const actions = selected ? (
    <>
      {canRetryPayment(selected.raw) ? (
        <button
          type="button"
          onClick={() => onRetryPayment(selected.raw)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-wl-line bg-white px-3 py-1.5 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft ${FOCUS}`}
        >
          <RotateCcw size={14} aria-hidden />
          Retry
        </button>
      ) : null}
      {canRefundPayment(selected.raw) ? (
        <button
          type="button"
          onClick={() => onRefundPayment(selected.raw)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-wl-line bg-white px-3 py-1.5 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft ${FOCUS}`}
        >
          <Undo2 size={14} aria-hidden />
          Refund
        </button>
      ) : null}
      {selected.raw.receiptUrl ? (
        <a
          href={selected.raw.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-full border border-wl-line bg-white px-3 py-1.5 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft ${FOCUS}`}
        >
          <ExternalLink size={14} aria-hidden />
          View receipt
        </a>
      ) : null}
    </>
  ) : null;

  const panel = (variant: 'column' | 'sheet') => (
    <RecordDetailPanel
      header={selected ? paymentHeader(selected) : null}
      status={selected && !selected.userMissing ? <PaymentStatus status={selected.status} /> : undefined}
      actions={actions}
      onClose={close}
      variant={variant}
    >
      {selected ? (
        <PaymentDetailFields
          row={selected}
          variant={selected.paymentType === 'refund' ? 'refund' : 'payment'}
          statusPill={status => <PaymentStatus status={status} />}
          showLiveMode
        />
      ) : null}
    </RecordDetailPanel>
  );

  return (
    <>
      <div className="grid min-w-0 overflow-hidden border-t border-wl-line lg:h-[720px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="shrink-0 space-y-3 border-b border-line p-4">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
              <div className="shrink-0" role="tablist" aria-label="Which bookings">
                {WHEN_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filters.when === tab.id}
                    onClick={() => onChange({ when: tab.id })}
                    className={`mb-1 mr-1 rounded-full px-3 py-1.5 text-xs font-medium ${FOCUS} ${
                      filters.when === tab.id ? 'bg-wl-brand text-white' : 'bg-sunken text-muted'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                <label htmlFor="payment-search" className="sr-only">
                  Search description or email
                </label>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="payment-search"
                  type="search"
                  value={searchDraft}
                  onChange={e => onSearchDraft(e.target.value)}
                  placeholder="Search description or email"
                  className={`h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted ${FOCUS}`}
                />
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="relative min-w-0" data-testid="payment-filter-status">
                <label htmlFor="payment-filter-status" className="sr-only">
                  Status
                </label>
                <SelectField
                  id="payment-filter-status"
                  value={filters.status}
                  onChange={status => onChange({ status })}
                  options={STATUS_FILTER}
                  placeholder="All statuses"
                />
              </div>
              <div className="relative min-w-0" data-testid="payment-filter-type">
                <label htmlFor="payment-filter-type" className="sr-only">
                  Payment type
                </label>
                <SelectField
                  id="payment-filter-type"
                  value={filters.type}
                  onChange={type => onChange({ type })}
                  options={TYPE_FILTER}
                  placeholder="All types"
                />
              </div>
              {showStripeModeFilter ? (
                <div className="relative min-w-0" data-testid="payment-filter-mode">
                  <label htmlFor="payment-filter-mode" className="sr-only">
                    Stripe mode
                  </label>
                  <SelectField
                    id="payment-filter-mode"
                    value={filters.mode}
                    onChange={mode => onChange({ mode })}
                    options={MODE_FILTER}
                    placeholder="Test and live"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-sunken px-4 py-2 text-xs text-muted">
            <span className="inline-flex min-w-0 items-center gap-2" aria-live="polite">
              <Calendar size={14} aria-hidden className="shrink-0" />
              <span>
                {loading && !hasLoaded ? 'Loading payments…' : countLine(totalCount, filters.when, rangePhrase)}
                {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} active` : ''}
              </span>
            </span>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className={`rounded-full border border-wl-line bg-white px-3 py-1 text-xs font-medium text-wl-brand hover:bg-wl-brandSoft ${FOCUS}`}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div ref={listRef} className="min-h-0 min-w-0 flex-1 overflow-auto" data-testid="payment-history-list">
            {loading ? (
              <div className="space-y-2 p-4" data-testid="payment-history-skeleton">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-wl-pageAlt" />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-wrap items-center gap-3 p-4 text-sm text-rose-700">
                Could not load payment history.
                <button
                  type="button"
                  onClick={onRetryLoad}
                  className="rounded-full border border-wl-line bg-white px-3 py-1 text-sm font-medium text-wl-brand"
                >
                  Try again
                </button>
              </div>
            ) : filteredEmpty ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-wl-muted">No payment history matches these filters</p>
                <button
                  type="button"
                  onClick={onClear}
                  className="mt-3 rounded-full border border-wl-line bg-white px-4 py-1.5 text-sm font-medium text-wl-brand"
                >
                  Clear filters
                </button>
              </div>
            ) : genuineEmpty ? (
              <p className="px-6 py-16 text-center text-sm text-wl-muted">No payment history yet.</p>
            ) : (
              <>
                <div className="hidden md:block" data-testid="payment-history-table">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-surface">
                      <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                        <th className="px-4 py-2.5 font-semibold">User</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        {showBooking ? <th className="px-4 py-2.5 font-semibold">Booking</th> : null}
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => {
                        const isSelected = selectedId === row.id;
                        return (
                          <tr
                            key={row.id}
                            data-row-id={row.id}
                            tabIndex={0}
                            aria-selected={isSelected}
                            onClick={() => setSelectedId(row.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedId(row.id);
                              }
                            }}
                            className={`cursor-pointer border-b border-line ${FOCUS} ${isSelected ? 'bg-brand-soft' : 'hover:bg-sunken'}`}
                          >
                            <td className="min-w-0 px-4 py-2.5">
                              <UserCell label={row.userLabel} missing={row.userMissing} />
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(row.amount, row.currency) || '—'}</td>
                            <td className="px-4 py-2.5">
                              <DateCell value={row.createdAt} />
                            </td>
                            {showBooking ? (
                              <td className="px-4 py-2.5">
                                {row.bookingStart ? <DateCell value={row.bookingStart} /> : <span className="text-muted">—</span>}
                              </td>
                            ) : null}
                            <td className="px-4 py-2.5">
                              <TypeTag item={row.raw} />
                            </td>
                            <td className="px-4 py-2.5">
                              <PaymentStatus status={row.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden" data-testid="payment-history-cards">
                  {rows.map(row => (
                    <li key={row.id} className="border-b border-line">
                      <button
                        type="button"
                        data-row-id={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={`flex w-full items-center justify-between gap-3 p-4 text-left ${FOCUS} ${
                          selectedId === row.id ? 'bg-brand-soft' : 'hover:bg-sunken'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">
                            {row.userMissing ? 'Unknown user' : row.userLabel}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="tabular-nums">{formatMoney(row.amount, row.currency) || '—'}</span>
                            <TypeTag item={row.raw} />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <PaymentStatus status={row.status} />
                          <ChevronRight size={16} className="text-muted" aria-hidden />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-line p-4">
            {!loading && !loadError && totalCount > 0 ? (
              <div data-testid="payment-history-total" className="rounded-xl border border-wl-line bg-wl-brandSoft/60 px-4 py-3">
                <PaymentStatusTotalsBar totals={statusTotals} />
              </div>
            ) : null}
            <Pagination
              id="payment-page-size"
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={pageSize}
              onPage={onPage}
              onPageSize={onPageSize}
            />
          </div>
        </div>

        {panel('column')}
      </div>
      {panel('sheet')}
    </>
  );
}
