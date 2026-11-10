import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  formatAmount,
  formatPaymentStatusTotals,
  historyDateBounds,
  historySearchFromState,
  lastPageIndex,
  parseHistorySearch,
  historyListParams,
  paymentStatusLabel,
  paymentStatusTone,
} from './paymentHistoryUtils';

describe('paymentHistoryUtils', () => {
  it('formats amount with currency and thousands separators', () => {
    expect(formatAmount(10000, 'usd')).toBe('100.00 USD');
    expect(formatAmount(546987, 'usd')).toBe('5,469.87 USD');
  });

  it('formats paid/failed/refunded totals across currencies', () => {
    expect(
      formatPaymentStatusTotals({
        paid: [
          { currency: 'CAD', cents: 2000 },
          { currency: 'USD', cents: 10000 },
        ],
        failed: [{ currency: 'USD', cents: 3000 }],
        refunded: [],
      }),
    ).toBe('Total: Paid 20.00 CAD · 100.00 USD, Failed 30.00 USD, Refunded 0.00 USD');
  });

  it('counts active filters', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: 'a@b.com', mode: 'test' })).toBe(2);
    expect(countActiveFilters({ ...EMPTY_FILTERS, when: 'past' })).toBe(1);
  });

  it('parses and serializes search params', () => {
    const params = historySearchFromState(
      { search: 'a@b.com', when: 'upcoming', mode: 'live', status: 'completed', type: 'refund', range: 'custom', startDate: '2024-01-01', endDate: '2024-02-01' },
      2,
      10,
    );
    const parsed = parseHistorySearch(params);
    expect(parsed.filters.search).toBe('a@b.com');
    expect(parsed.filters.when).toBe('upcoming');
    expect(params.get('q')).toBe('a@b.com');
    expect(parsed.filters.mode).toBe('live');
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(10);
  });

  it('computes last page index', () => {
    expect(lastPageIndex(12, 5)).toBe(2);
    expect(lastPageIndex(0, 5)).toBe(0);
  });
});

describe('Payment History date range', () => {
  const parse = (q: string) => parseHistorySearch(new URLSearchParams(q)).filters;

  it('defaults to all time and sends no dates', () => {
    expect(parse('').range).toBe('all');
    expect(historyDateBounds(EMPTY_FILTERS)).toEqual({});
  });

  it('keeps a preset range and a valid custom range from the URL, and writes them back the same way', () => {
    expect(parse('range=6m')).toMatchObject({ range: '6m', startDate: '', endDate: '' });
    const custom = parse('range=custom&startDate=2026-10-01&endDate=2026-10-05');
    expect(custom).toMatchObject({ range: 'custom', startDate: '2026-10-01', endDate: '2026-10-05' });
    expect(historySearchFromState(custom, 0, 5).toString()).toBe('range=custom&startDate=2026-10-01&endDate=2026-10-05');
    expect(historySearchFromState(EMPTY_FILTERS, 0, 5).toString()).toBe('');
  });

  it('falls back to all time for an unknown range or a broken custom range', () => {
    expect(parse('range=5y').range).toBe('all');
    expect(parse('range=custom&startDate=2026-10-05&endDate=2026-10-01').range).toBe('all');
    expect(parse('range=custom&startDate=2026-10-01').range).toBe('all');
  });

  it('ignores the old from/to URL parameters', () => {
    expect(parse('from=2024-01-01&to=2024-02-01')).toMatchObject({ range: 'all', startDate: '', endDate: '' });
  });

  it('a custom range starts at the first day and stops before the day after the last, in local time', () => {
    const bounds = historyDateBounds({ ...EMPTY_FILTERS, range: 'custom', startDate: '2026-10-05', endDate: '2026-10-05' });
    expect(bounds).toEqual({ dateFrom: new Date(2026, 9, 5).toISOString(), dateTo: new Date(2026, 9, 6).toISOString() });
  });

  it('3 / 6 / 12 months send only a start, three months back, so later payments still show', () => {
    const now = new Date(2026, 10, 9, 14, 30);
    const three = historyDateBounds({ ...EMPTY_FILTERS, range: '3m' }, now);
    expect(three).toEqual({ dateFrom: new Date(2026, 7, 9, 14, 30).toISOString() });
    expect(historyDateBounds({ ...EMPTY_FILTERS, range: '1y' }, now)).toEqual({ dateFrom: new Date(2025, 10, 9, 14, 30).toISOString() });
  });

  it('counts a range other than all time as one active filter', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, range: '3m' })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, range: 'all', search: 'a@b.com' })).toBe(1);
  });
});

describe('Payment History search, booking tabs and status names', () => {
  const bounds = { dateFrom: '2026-08-01T05:00:00.000Z', dateTo: '2026-09-01T05:00:00.000Z' };

  it('sends text as a description search and anything with an @ as an exact email', () => {
    expect(historyListParams({ ...EMPTY_FILTERS, search: 'Session A' }, {})).toEqual({ q: 'Session A' });
    expect(historyListParams({ ...EMPTY_FILTERS, search: '  ann@x.com ' }, {})).toEqual({ email: 'ann@x.com' });
    expect(historyListParams(EMPTY_FILTERS, {})).toEqual({});
  });

  it('All and Past use the date range; Upcoming ignores it', () => {
    expect(historyListParams(EMPTY_FILTERS, bounds)).toEqual(bounds);
    expect(historyListParams({ ...EMPTY_FILTERS, when: 'past' }, bounds)).toEqual({ bookingScope: 'past', ...bounds });
    expect(historyListParams({ ...EMPTY_FILTERS, when: 'upcoming' }, bounds)).toEqual({ bookingScope: 'upcoming' });
  });

  it('reads the tab from the URL and keeps old email links working', () => {
    expect(parseHistorySearch(new URLSearchParams('when=past')).filters.when).toBe('past');
    expect(parseHistorySearch(new URLSearchParams('when=later')).filters.when).toBe('all');
    expect(parseHistorySearch(new URLSearchParams('email=ann%40x.com')).filters.search).toBe('ann@x.com');
    expect(historySearchFromState({ ...EMPTY_FILTERS, when: 'all' }, 0, 5).toString()).toBe('');
  });

  it('uses the Payments page names and colours for each status', () => {
    expect(paymentStatusLabel('completed')).toBe('Paid');
    expect(paymentStatusLabel('pending')).toBe('In Flight');
    expect(paymentStatusLabel('partially_refunded')).toBe('Partially refunded');
    expect(paymentStatusLabel(undefined)).toBe('Paid');
    expect(paymentStatusTone('failed')).toBe('red');
    expect(paymentStatusTone('withheld')).toBe('amber');
    expect(paymentStatusTone('completed')).toBe('green');
  });
});
