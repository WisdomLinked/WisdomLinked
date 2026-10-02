import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  formatAmount,
  historySearchFromState,
  lastPageIndex,
  parseHistorySearch,
  shortPaymentIntent,
} from './paymentHistoryUtils';

describe('paymentHistoryUtils', () => {
  it('formats amount with currency', () => {
    expect(formatAmount(10000, 'usd')).toBe('100.00 USD');
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
      { email: 'a@b.com', mode: 'live', status: 'completed', type: 'refund', from: '2024-01-01', to: '2024-02-01' },
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
