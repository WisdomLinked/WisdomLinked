import {
  parseSnapshotCustomRange,
  parseSnapshotRangeKey,
  snapshotRangeBounds,
  type SnapshotRangeKey,
} from '../../../../utils/adminSnapshotRange';

export type PaymentHistoryRow = {
  _id?: string;
  amount?: number;
  sessionType?: string;
  advertisedCents?: number;
  platformFeeCents?: number;
  taxCents?: number;
  commissionCents?: number;
  expertNetCents?: number;
  currency?: string;
  description?: string;
  paymentIntent?: string | null;
  receiptUrl?: string | null;
  status?: string;
  paymentType?: string;
  stripeMode?: string;
  createdAt?: string;
  expert?: { username?: string; email?: string; role?: string } | null;
  customer?: { username?: string; email?: string; role?: string } | null;
  groupChat?: { type?: string; name?: string; status?: string; start?: string; end?: string } | null;
  event?: { start?: string; end?: string; title?: string; status?: string } | string | null;
};

export type BookingScope = 'all' | 'past' | 'upcoming';

export type HistoryFilters = {
  /** Text to find in the description, or an exact user email (anything with an @). */
  search: string;
  /** All payments, or only those for sessions that already happened / are still to come. */
  when: BookingScope;
  mode: string;
  status: string;
  type: string;
  /** Date range for the list, the totals and the summary. Payment History defaults to all time. */
  range: SnapshotRangeKey;
  /** YYYY-MM-DD, set only when range is custom. */
  startDate: string;
  endDate: string;
};

export const EMPTY_FILTERS: HistoryFilters = {
  search: '',
  when: 'all',
  mode: '',
  status: '',
  type: '',
  range: 'all',
  startDate: '',
  endDate: '',
};

function parseBookingScope(raw: string | null): BookingScope {
  return raw === 'past' || raw === 'upcoming' ? raw : 'all';
}

/**
 * Search, booking tab and dates for the list request.
 * Past bookings: sessions that started inside the range. Upcoming bookings: every session still
 * to come, whatever the range (as on Overview). All: payments made inside the range.
 */
export function historyListParams(
  filters: HistoryFilters,
  dateBounds: { dateFrom?: string; dateTo?: string },
): { email?: string; q?: string; bookingScope?: 'past' | 'upcoming'; dateFrom?: string; dateTo?: string } {
  const text = filters.search.trim();
  const byEmail = text.includes('@');
  return {
    ...(text ? (byEmail ? { email: text } : { q: text }) : {}),
    ...(filters.when !== 'all' ? { bookingScope: filters.when } : {}),
    ...(filters.when === 'upcoming' ? {} : dateBounds),
  };
}

/** Only a valid custom range keeps its dates; anything unknown falls back to all time. */
function parseHistoryRange(search: URLSearchParams): Pick<HistoryFilters, 'range' | 'startDate' | 'endDate'> {
  const raw = search.get('range');
  if (!raw) return { range: 'all', startDate: '', endDate: '' };
  const range = parseSnapshotRangeKey(raw);
  if (range !== raw) return { range: 'all', startDate: '', endDate: '' };
  if (range !== 'custom') return { range, startDate: '', endDate: '' };
  const custom = parseSnapshotCustomRange(search);
  if (!custom) return { range: 'all', startDate: '', endDate: '' };
  return { range, ...custom };
}

/**
 * createdAt bounds for the list and the summary, in the admin's own time zone.
 * Custom: [first day, day after the last day). 3 / 6 / 12 months: from the start onward with no end,
 * so a payment or refund made after the range was picked still shows on the next refresh.
 */
export function historyDateBounds(filters: HistoryFilters, now: Date = new Date()): { dateFrom?: string; dateTo?: string } {
  if (filters.range === 'custom') {
    return snapshotRangeBounds('custom', now, { startDate: filters.startDate, endDate: filters.endDate });
  }
  const { dateFrom } = snapshotRangeBounds(filters.range, now, null);
  return dateFrom ? { dateFrom } : {};
}

export const HISTORY_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Paid' },
  { value: 'partially_refunded', label: 'Partially refunded' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'pending', label: 'In Flight' },
  { value: 'withheld', label: 'Withheld' },
  { value: 'failed', label: 'Failed' },
  { value: 'released', label: 'Released' },
] as const;

export const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'charge', label: 'Charge' },
  { value: 'refund', label: 'Refund' },
  { value: 'retry', label: 'Retry' },
] as const;

export const MODE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
] as const;

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function parseHistorySearch(search: URLSearchParams): {
  filters: HistoryFilters;
  page: number;
  pageSize: number;
} {
  const pageSizeRaw = Number(search.get('pageSize') || 5);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw as (typeof PAGE_SIZE_OPTIONS)[number])
    ? pageSizeRaw
    : 5;
  const pageRaw = Number(search.get('page') || 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) - 1 : 0;
  return {
    filters: {
      // `email` is the old name of the search box; links that still use it keep working.
      search: (search.get('q') || search.get('email') || '').trim(),
      when: parseBookingScope(search.get('when')),
      mode: search.get('mode') || '',
      status: search.get('status') || '',
      type: search.get('type') || '',
      ...parseHistoryRange(search),
    },
    page,
    pageSize,
  };
}

export function historySearchFromState(
  filters: HistoryFilters,
  page: number,
  pageSize: number,
): URLSearchParams {
  const next = new URLSearchParams();
  if (filters.search) next.set('q', filters.search);
  if (filters.when !== 'all') next.set('when', filters.when);
  if (filters.mode) next.set('mode', filters.mode);
  if (filters.status) next.set('status', filters.status);
  if (filters.type) next.set('type', filters.type);
  if (filters.range !== 'all') next.set('range', filters.range);
  if (filters.range === 'custom') {
    next.set('startDate', filters.startDate);
    next.set('endDate', filters.endDate);
  }
  if (page > 0) next.set('page', String(page + 1));
  if (pageSize !== 5) next.set('pageSize', String(pageSize));
  return next;
}

export function countActiveFilters(filters: HistoryFilters): number {
  const fields = (['search', 'mode', 'status', 'type'] as const).filter(key => Boolean(filters[key])).length;
  return fields + (filters.range !== 'all' ? 1 : 0) + (filters.when !== 'all' ? 1 : 0);
}

export function formatAmount(amount?: number, currency?: string): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  const value = (amount / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${value} ${String(currency).toUpperCase()}` : value;
}

export type PaymentStatusAmount = { currency: string; cents: number };

export type PaymentStatusTotals = {
  paid: PaymentStatusAmount[];
  failed: PaymentStatusAmount[];
  refunded: PaymentStatusAmount[];
};

export const EMPTY_PAYMENT_STATUS_TOTALS: PaymentStatusTotals = {
  paid: [],
  failed: [],
  refunded: [],
};

function formatStatusBucket(amounts: PaymentStatusAmount[] | undefined): string {
  if (!amounts?.length) return formatAmount(0, 'usd');
  return amounts
    .map(row => formatAmount(row.cents, row.currency))
    .join(' · ');
}

export function formatPaymentStatusTotals(totals?: PaymentStatusTotals | null): string {
  const value = totals || EMPTY_PAYMENT_STATUS_TOTALS;
  return `Total: Paid ${formatStatusBucket(value.paid)}, Failed ${formatStatusBucket(value.failed)}, Refunded ${formatStatusBucket(value.refunded)}`;
}

export function typePill(item: PaymentHistoryRow): string {
  const mode = item.stripeMode || 'test';
  const kind = item.paymentType || 'charge';
  return `${mode} · ${kind}`;
}

export function canRetryPayment(item: PaymentHistoryRow): boolean {
  return (
    item.status !== 'refunded' &&
    item.status !== 'withheld' &&
    item.status !== 'released' &&
    item.paymentType !== 'refund' &&
    item.paymentType !== 'retry'
  );
}

export function canRefundPayment(item: PaymentHistoryRow): boolean {
  return (
    (item.status === 'completed' || item.status === 'partially_refunded') &&
    Boolean(item.paymentIntent) &&
    item.paymentType !== 'refund'
  );
}

export function lastPageIndex(totalCount: number, pageSize: number): number {
  if (!totalCount || pageSize <= 0) return 0;
  return Math.max(0, Math.ceil(totalCount / pageSize) - 1);
}

/** Payments page names for each status (Overview keeps its own wording). */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  withheld: 'Withheld',
  pending: 'In Flight',
  completed: 'Paid',
  released: 'Released',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};

export const PAYMENT_STATUS_HINTS: Record<string, string> = {
  withheld: 'Card authorized, not charged — waiting on the host or expert to decide.',
  pending: 'A capture is in flight, or the row needs manual reconciliation.',
  completed: 'Money captured and settled.',
  released: 'Authorization released. The card was never charged.',
  failed: 'The payment did not go through.',
  refunded: 'Money was captured, then returned to the customer.',
  partially_refunded: 'Part of this payment was returned; the remainder is still paid.',
};

const PAYMENT_STATUS_TONES: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  completed: 'green',
  pending: 'amber',
  withheld: 'amber',
  failed: 'red',
  refunded: 'grey',
  partially_refunded: 'grey',
  released: 'grey',
};

export function paymentStatusLabel(status?: string): string {
  const key = status || 'completed';
  return PAYMENT_STATUS_LABELS[key] || status || 'Paid';
}

export function paymentStatusTone(status?: string): 'green' | 'amber' | 'red' | 'grey' {
  return PAYMENT_STATUS_TONES[status || 'completed'] || 'grey';
}
