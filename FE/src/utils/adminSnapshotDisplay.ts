import type { AmountByCurrency } from '../api/api';

const STATUS_LABELS: Record<string, string> = {
  review: 'In review',
  active: 'Active',
  blocked: 'Blocked',
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  draft: 'Draft',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
  withheld: 'Withheld',
  released: 'Released',
};

export type StatusTone = 'green' | 'navy' | 'amber' | 'red' | 'grey';

const STATUS_TONES: Record<string, StatusTone> = {
  completed: 'green',
  succeeded: 'green',
  active: 'green',
  accepted: 'green',
  scheduled: 'navy',
  confirmed: 'navy',
  pending: 'amber',
  draft: 'amber',
  review: 'amber',
  withheld: 'amber',
  cancelled: 'red',
  canceled: 'red',
  declined: 'red',
  failed: 'red',
  blocked: 'red',
  refunded: 'grey',
  inactive: 'grey',
  released: 'grey',
};

/** Dates at or before 1970 are treated as unset (epoch / missing). */
export const MIN_VALID_DATE_MS = Date.parse('1971-01-01T00:00:00.000Z');

export function parseRecordDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function isValidRecordDate(value: unknown): boolean {
  const d = parseRecordDate(value);
  return Boolean(d && d.getTime() >= MIN_VALID_DATE_MS);
}

export function formatSnapshotDate(value: unknown): { text: string; missing: boolean } {
  const parts = formatSnapshotDateParts(value);
  if (parts.missing) return { text: 'No date set', missing: true };
  return { text: parts.date, missing: false };
}

export function relativeTimeFrom(d: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - d.getTime();
  const future = diffMs < 0;
  const mins = Math.round(Math.abs(diffMs) / 60000);
  const phrase = (unit: string) => (future ? `in ${unit}` : `${unit} ago`);
  if (mins < 1) return 'just now';
  if (mins < 60) return phrase(`${mins} min`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return phrase(`${hours} hour${hours === 1 ? '' : 's'}`);
  const days = Math.round(mins / (60 * 24));
  if (days < 31) return phrase(`${days} day${days === 1 ? '' : 's'}`);
  const months = Math.round(days / 30);
  if (months < 12) return phrase(`${months} month${months === 1 ? '' : 's'}`);
  const years = Math.round(days / 365);
  return phrase(`${years} year${years === 1 ? '' : 's'}`);
}

export function formatSnapshotDateParts(
  value: unknown,
  now: Date = new Date(),
): { missing: boolean; date: string; time: string; relative: string } {
  if (!isValidRecordDate(value)) {
    return { missing: true, date: 'No date set', time: '', relative: '' };
  }
  const d = parseRecordDate(value);
  if (!d) return { missing: true, date: 'No date set', time: '', relative: '' };
  return {
    missing: false,
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    relative: relativeTimeFrom(d, now),
  };
}

export function formatMonthKey(month: string): { short: string; long: string } {
  const [year, m] = month.split('-').map(Number);
  if (!year || !m) return { short: month, long: month };
  const d = new Date(Date.UTC(year, m - 1, 1));
  return {
    short: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    long: d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

export function formatHourlyPrice(price: unknown): string {
  if (!Array.isArray(price)) return '';
  const nums = price.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  if (!nums.length) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const fmt = (n: number) => `$${Number.isInteger(n) ? String(n) : n.toFixed(2)}`;
  if (min === max) return `${fmt(min)}/hr`;
  return `${fmt(min)}–${fmt(max)}/hr`;
}

export function stripRefundPrefix(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^(Refund\s+[—–-]\s*)+/i, '').trim();
}

export function statusLabel(status: unknown): string {
  const raw = String(status || '').trim();
  if (!raw) return '';
  const mapped = STATUS_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function statusTone(status: unknown): StatusTone {
  const raw = String(status || '').trim().toLowerCase();
  return STATUS_TONES[raw] || 'grey';
}

export function statusPillClass(tone: StatusTone): string {
  if (tone === 'green') return 'bg-emerald-50 text-green';
  if (tone === 'navy') return 'bg-wl-brandSoft text-wl-brand';
  if (tone === 'amber') return 'bg-amber-50 text-amber-800';
  if (tone === 'red') return 'bg-red-50 text-red';
  return 'bg-slate-100 text-slate-600';
}

export type FormatMoneyOptions = {
  fractionDigits?: number;
};

export function formatCents(amount: unknown, currency?: unknown): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const value = (amount / 100).toFixed(2);
  const code = String(currency || 'usd').trim().toUpperCase() || 'USD';
  return `${code} ${value}`;
}

export function formatMoney(
  amount: unknown,
  currency?: unknown,
  options?: FormatMoneyOptions,
): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '';
  const code = String(currency || 'usd').trim().toUpperCase() || 'USD';
  const digits = options?.fractionDigits ?? 2;
  const major = amount / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    return `$${major.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
}

export function formatCentsByCurrency(amounts: AmountByCurrency | null | undefined): string {
  if (!amounts) return '—';
  const parts = Object.entries(amounts)
    .filter(([, n]) => typeof n === 'number' && n !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, n]) => formatCents(n, code));
  return parts.length ? parts.join(' · ') : '—';
}

export function formatMoneyByCurrency(
  amounts: AmountByCurrency | null | undefined,
  options?: FormatMoneyOptions,
): string {
  if (!amounts) return '';
  const parts = Object.entries(amounts)
    .filter(([, n]) => typeof n === 'number' && n !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, n]) => formatMoney(n, code, options))
    .filter(Boolean);
  return parts.join(' · ');
}

export function initialsFromName(name: unknown): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
}

export type PaymentBookingRef = {
  groupChat?: { start?: string | Date | null } | null;
  event?: { start?: string | Date | null } | string | null;
};

export function paymentBookingStart(row: PaymentBookingRef | null | undefined): unknown {
  const gcStart = row?.groupChat?.start;
  if (gcStart) return gcStart;
  const event = row?.event;
  if (event && typeof event === 'object' && event.start) return event.start;
  return null;
}
