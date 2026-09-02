import { describe, it, expect } from 'vitest';
import {
  isRangeWithinPreset,
  proposedTimeNeedsOverride,
  hasBookingConflict,
} from './proposeAvailability';

// Expert in UTC, available 09:00–11:00 (half-hour indices 18,19,20,21).
const expert = {
  timeZone: 'UTC',
  timeSlots: [18, 19, 20, 21],
  blockedBookingDates: [],
  blockedBookingSlots: {},
  events: [],
  groupChats: [],
};

const at = (iso: string) => new Date(iso);

describe('proposeAvailability', () => {
  it('treats an in-window time as within preset / no override', () => {
    const start = at('2026-06-30T09:00:00Z');
    const end = at('2026-06-30T09:30:00Z');
    expect(isRangeWithinPreset(expert, start, end)).toBe(true);
    expect(proposedTimeNeedsOverride(expert, start, end)).toBe(false);
  });

  it('needs override when the time is outside the preset window', () => {
    expect(
      proposedTimeNeedsOverride(expert, at('2026-06-30T06:00:00Z'), at('2026-06-30T06:30:00Z')),
    ).toBe(true);
  });

  it('needs override on a blocked date even inside the window', () => {
    const blocked = { ...expert, blockedBookingDates: ['2026-06-30'] };
    expect(
      proposedTimeNeedsOverride(blocked, at('2026-06-30T09:00:00Z'), at('2026-06-30T09:30:00Z')),
    ).toBe(true);
  });

  it('needs override over a blocked slot', () => {
    const blocked = { ...expert, blockedBookingSlots: { '2026-06-30': [18] } };
    expect(
      proposedTimeNeedsOverride(blocked, at('2026-06-30T09:00:00Z'), at('2026-06-30T09:30:00Z')),
    ).toBe(true);
  });

  it('flags a conflict with an existing active session (1:1 or seminar)', () => {
    const busy = {
      ...expert,
      groupChats: [
        { start: '2026-06-30T11:00:00Z', end: '2026-06-30T12:00:00Z', status: 'active', type: 'seminar' },
      ],
    };
    expect(hasBookingConflict(busy, at('2026-06-30T11:30:00Z'), at('2026-06-30T12:00:00Z'))).toBe(true);
    expect(hasBookingConflict(busy, at('2026-06-30T12:00:00Z'), at('2026-06-30T12:30:00Z'))).toBe(false);
  });

  it('ignores declined/cancelled sessions when checking conflicts', () => {
    const busy = {
      ...expert,
      events: [{ start: '2026-06-30T11:00:00Z', end: '2026-06-30T12:00:00Z', status: 'declined' }],
      groupChats: [{ start: '2026-06-30T11:00:00Z', end: '2026-06-30T12:00:00Z', status: 'cancelled' }],
    };
    expect(hasBookingConflict(busy, at('2026-06-30T11:30:00Z'), at('2026-06-30T12:00:00Z'))).toBe(false);
  });
});
