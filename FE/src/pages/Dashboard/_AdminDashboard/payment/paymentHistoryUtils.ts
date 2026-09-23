export type PaymentHistoryRow = {
  _id?: string;
  amount?: number;
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
  groupChat?: { type?: string; name?: string; status?: string } | null;
  event?: unknown;
};

export type HistoryFilters = {
  email: string;
  mode: string;
  status: string;
  type: string;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: HistoryFilters = {
  email: '',
  mode: '',
  status: '',
  type: '',
  from: '',
  to: '',
};

export const HISTORY_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Paid' },
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
      email: (search.get('email') || '').trim(),
      mode: search.get('mode') || '',
      status: search.get('status') || '',
      type: search.get('type') || '',
      from: search.get('from') || '',
      to: search.get('to') || '',
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
  if (filters.email) next.set('email', filters.email);
  if (filters.mode) next.set('mode', filters.mode);
  if (filters.status) next.set('status', filters.status);
  if (filters.type) next.set('type', filters.type);
  if (filters.from) next.set('from', filters.from);
  if (filters.to) next.set('to', filters.to);
  if (page > 0) next.set('page', String(page + 1));
  if (pageSize !== 5) next.set('pageSize', String(pageSize));
  return next;
}

export function countActiveFilters(filters: HistoryFilters): number {
  return (['email', 'mode', 'status', 'type', 'from', 'to'] as const).filter(
    key => Boolean(filters[key]),
  ).length;
}

export function formatAmount(amount?: number, currency?: string): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  const value = (amount / 100).toFixed(2);
  return currency ? `${value} ${String(currency).toUpperCase()}` : value;
}

export function shortPaymentIntent(id?: string | null): string {
  const value = String(id || '').trim();
  if (!value) return 'N/A';
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function eventTypeLabel(item: PaymentHistoryRow): string {
  if (item?.event) return 'Event';
  const type = item?.groupChat?.type;
  if (type === 'seminar') return 'Seminar';
  if (type === 'individual') return '1:1 Session';
  if (type) return 'Chat';
  return item?.groupChat ? 'Session' : '—';
}

export function partyEmails(item: PaymentHistoryRow): string[] {
  const emails = [item.customer?.email, item.expert?.email].filter(Boolean) as string[];
  return emails;
}

export function hasAnyParty(rows: PaymentHistoryRow[]): boolean {
  return rows.some(row => partyEmails(row).length > 0);
}

export function formatDateOnly(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
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
  return item.status === 'completed' && Boolean(item.paymentIntent) && item.paymentType !== 'refund';
}

export function lastPageIndex(totalCount: number, pageSize: number): number {
  if (!totalCount || pageSize <= 0) return 0;
  return Math.max(0, Math.ceil(totalCount / pageSize) - 1);
}
