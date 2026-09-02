import { describe, expect, it } from 'vitest';
import { isSlotUnavailable } from '../actions/common';
import { toYMDLocal } from './schedulingTimezone';

describe('schedulingBooking helpers', () => {
  it('isSlotUnavailable detects overlap', () => {
    const start = new Date('2026-05-01T09:00:00').getTime();
    const duration = 60 * 60 * 1000;
    const eventStart = new Date('2026-05-01T09:30:00').getTime();
    const eventEnd = new Date('2026-05-01T10:30:00').getTime();
    expect(isSlotUnavailable(start, duration, eventStart, eventEnd)).toBe(true);
  });

  it('toYMDLocal formats local date', () => {
    const d = new Date(2026, 4, 1, 15, 0, 0);
    expect(toYMDLocal(d)).toBe('2026-05-01');
  });
});
