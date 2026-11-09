import { format } from 'date-fns';

export type PaidOutCheque = {
  _id?: string;
  expertId?: string;
  expertName?: string;
  expertEmail?: string;
  year?: number;
  month?: number;
  amountCents?: number;
  numberType?: string;
  chequeNumber?: string;
  chequeDate?: string | Date | null;
};

export type PaidOutFilters = {
  expert: string;
  number: string;
  from: string;
  to: string;
};

export const EMPTY_PAID_OUT_FILTERS: PaidOutFilters = { expert: '', number: '', from: '', to: '' };

const UTC_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function payrollMonthLabel(year?: number, month?: number): string {
  const name = month ? UTC_MONTHS[month - 1] : '';
  if (!name || typeof year !== 'number' || !Number.isFinite(year)) return '—';
  return `${name} ${year}`;
}

/** Payment dates are stored at UTC midnight, so the UTC calendar day is the day that was entered. */
export function chequeDay(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function formatChequeDate(value?: string | Date | null): string {
  const day = chequeDay(value);
  if (!day) return '—';
  const [y, m, d] = day.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d, yyyy');
}

export function countPaidOutFilters(filters: PaidOutFilters): number {
  return (['expert', 'number', 'from', 'to'] as const).filter(key => Boolean(filters[key].trim())).length;
}

/** From and To are whole days and both included. A payout with no usable date never matches a date filter. */
export function filterPaidOut(cheques: PaidOutCheque[], filters: PaidOutFilters): PaidOutCheque[] {
  const expert = filters.expert.trim().toLowerCase();
  const number = filters.number.trim().toLowerCase();
  const from = filters.from.trim();
  const to = filters.to.trim();
  return cheques.filter(cheque => {
    if (expert) {
      const name = String(cheque.expertName || '').toLowerCase();
      const email = String(cheque.expertEmail || '').toLowerCase();
      if (!name.includes(expert) && !email.includes(expert)) return false;
    }
    if (number && !String(cheque.chequeNumber || '').toLowerCase().includes(number)) return false;
    if (from || to) {
      const day = chequeDay(cheque.chequeDate);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
}
