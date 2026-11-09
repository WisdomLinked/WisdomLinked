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
  shortPaymentIntent,
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

  it('shortens payment intents', () => {
    expect(shortPaymentIntent('pi_3UB4xxxxUfoa')).toBe('pi_3UB4x...Ufoa');
    expect(shortPaymentIntent('')).toBe('N/A');
  });

  it('counts active filters', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, email: 'a@b.com', mode: 'test' })).toBe(2);
  });

  it('parses and serializes search params', () => {
    const params = historySearchFromState(
      { email: 'a@b.com', mode: 'live', status: 'completed', type: 'refund', range: 'custom', startDate: '2024-01-01', endDate: '2024-02-01' },
      2,
      10,
    );
    const parsed = parseHistorySearch(params);
    expect(parsed.filters.email).toBe('a@b.com');
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
    expect(countActiveFilters({ ...EMPTY_FILTERS, range: 'all', email: 'a@b.com' })).toBe(1);
  });
});
