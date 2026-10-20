import { describe, expect, it } from 'vitest';
import {
  SEAT_REQUEST_HOLD_MS,
  canJoinWaitlist,
  seatRequestActionLabel,
  seatRequestWindow,
  seatRequestWindowMessage,
  seatRequestWindowShortLabel,
} from './seatRequestWindow';

const NOW = new Date('2026-07-28T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('seatRequestWindow', () => {
  it('is open for any future seminar (including beyond 7 days)', () => {
    expect(seatRequestWindow(NOW + 3 * DAY, NOW).state).toBe('open');
    expect(seatRequestWindow(NOW + SEAT_REQUEST_HOLD_MS, NOW).state).toBe('open');
    expect(seatRequestWindow(NOW + 30 * DAY, NOW).state).toBe('open');
    expect(seatRequestWindow(NOW + 60_000, NOW).state).toBe('open');
  });

  it('is closed once the seminar has started', () => {
    expect(seatRequestWindow(NOW - 1, NOW).state).toBe('closed');
    expect(seatRequestWindow(NOW, NOW).state).toBe('closed');
  });

  it('treats missing or sentinel start dates as undated (still joinable)', () => {
    expect(seatRequestWindow(null, NOW).state).toBe('undated');
    expect(seatRequestWindow(undefined, NOW).state).toBe('undated');
    expect(seatRequestWindow(0, NOW).state).toBe('undated');
    expect(seatRequestWindow(Number.MAX_SAFE_INTEGER, NOW).state).toBe('undated');
  });
});

describe('seatRequestWindowMessage', () => {
  it('tells students they can join anytime with no payment until offered', () => {
    const msg = seatRequestWindowMessage(seatRequestWindow(NOW + 30 * DAY, NOW), { price: 40 });
    expect(msg).toContain('Join the waitlist');
    expect(msg).toContain('No payment until you join');
    expect(msg).not.toContain('7 days');
    expect(msg).not.toContain('host to approve');
  });

  it('uses the same copy for free and paid seminars', () => {
    const paid = seatRequestWindowMessage(seatRequestWindow(NOW + DAY, NOW), { price: 40 });
    const free = seatRequestWindowMessage(seatRequestWindow(NOW + DAY, NOW), { price: 0 });
    expect(paid).toBe(free);
    expect(free).not.toContain('Pay');
  });

  it('explains started seminars', () => {
    expect(seatRequestWindowMessage(seatRequestWindow(NOW - DAY, NOW))).toContain('already started');
  });
});

describe('seatRequestWindowShortLabel', () => {
  it('says join waitlist while open', () => {
    expect(seatRequestWindowShortLabel(seatRequestWindow(NOW + 30 * DAY, NOW))).toBe('Join waitlist');
    expect(seatRequestWindowShortLabel(seatRequestWindow(NOW + DAY, NOW))).toBe('Join waitlist');
  });

  it('says closed after start', () => {
    expect(seatRequestWindowShortLabel(seatRequestWindow(NOW - DAY, NOW))).toBe('Waiting list closed');
  });
});

describe('seatRequestActionLabel', () => {
  it('never mentions payment on join', () => {
    expect(seatRequestActionLabel(40)).toBe('Join waitlist');
    expect(seatRequestActionLabel(0)).toBe('Join waitlist');
  });
});

describe('canJoinWaitlist', () => {
  it('allows join whenever the seminar has not started', () => {
    expect(canJoinWaitlist(seatRequestWindow(NOW + 30 * DAY, NOW))).toBe(true);
    expect(canJoinWaitlist(seatRequestWindow(null, NOW))).toBe(true);
    expect(canJoinWaitlist(seatRequestWindow(NOW - 1, NOW))).toBe(false);
  });
});
