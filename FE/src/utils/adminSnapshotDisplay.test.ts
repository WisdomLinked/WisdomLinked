import { describe, expect, it } from 'vitest';
import {
  formatCents,
  formatCentsByCurrency,
  formatMoney,
  formatMoneyByCurrency,
  formatHourlyPrice,
  formatSnapshotDate,
  formatSnapshotDateParts,
  isValidRecordDate,
  paymentBookingStart,
  statusLabel,
  stripRefundPrefix,
} from './adminSnapshotDisplay';

describe('adminSnapshotDisplay', () => {
  it('treats epoch and empty dates as missing', () => {
    expect(isValidRecordDate(null)).toBe(false);
    expect(isValidRecordDate('1970-01-01T00:00:00.000Z')).toBe(false);
    expect(formatSnapshotDate('')).toEqual({ text: 'No date set', missing: true });
    expect(isValidRecordDate('2026-04-01T00:00:00.000Z')).toBe(true);
  });

  it('capitalises statuses through the display map without changing the stored value', () => {
    expect(statusLabel('refunded')).toBe('Refunded');
    expect(statusLabel('pending')).toBe('Pending');
    expect(statusLabel('review')).toBe('In review');
  });

  it('strips repeated Refund prefixes for display only', () => {
    expect(stripRefundPrefix('Refund — session request declined: Math')).toBe(
      'session request declined: Math',
    );
    expect(stripRefundPrefix('Refund — Refund — captured without enrollment')).toBe(
      'captured without enrollment',
    );
  });

  it('formats cents per currency and never mixes them', () => {
    expect(formatCents(1234, 'usd')).toBe('USD 12.34');
    expect(formatCentsByCurrency({ usd: 5000, eur: 2000 })).toBe('EUR 20.00 · USD 50.00');
  });

  it('formats a single amount with a currency symbol', () => {
    expect(formatMoney(5000, 'usd')).toBe('$50.00');
    expect(formatMoney(1999, 'eur')).toBe('€19.99');
    expect(formatMoney(42000, 'usd', { fractionDigits: 0 })).toBe('$420');
    expect(formatMoney(495600, 'usd', { fractionDigits: 0 })).toBe('$4,956');
    expect(formatMoneyByCurrency({ usd: 12000 }, { fractionDigits: 0 })).toBe('$120');
    expect(formatMoneyByCurrency({ usd: 495600 }, { fractionDigits: 0 })).toBe('$4,956');
  });

  it('formats dates without seconds and with a relative line', () => {
    const parts = formatSnapshotDateParts('2026-10-06T17:53:00.000Z', new Date('2026-10-21T17:53:00.000Z'));
    expect(parts.missing).toBe(false);
    expect(parts.date).toBe('Oct 6, 2026');
    expect(parts.time).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
    expect(parts.relative).toBe('15 days ago');
  });

  it('formats an hourly price as a range', () => {
    expect(formatHourlyPrice([10])).toBe('$10/hr');
    expect(formatHourlyPrice([10, 25])).toBe('$10–$25/hr');
    expect(formatHourlyPrice([])).toBe('');
  });

  it('reads booking start from groupChat or populated event', () => {
    expect(paymentBookingStart({ groupChat: { start: '2026-05-01T00:00:00.000Z' } })).toBe(
      '2026-05-01T00:00:00.000Z',
    );
    expect(paymentBookingStart({ event: { start: '2026-06-01T00:00:00.000Z' } })).toBe(
      '2026-06-01T00:00:00.000Z',
    );
    expect(paymentBookingStart({ event: 'abc123' })).toBeNull();
  });
});
