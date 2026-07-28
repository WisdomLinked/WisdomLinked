import { describe, expect, it } from 'vitest';
import {
  SEAT_REQUEST_HOLD_MS,
  seatRequestActionLabel,
  seatRequestWindow,
  seatRequestWindowMessage,
  seatRequestWindowShortLabel,
} from './seatRequestWindow';

const NOW = new Date('2026-07-28T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

describe('seatRequestWindow', () => {
  it('is open inside the 7-day hold window', () => {
    expect(seatRequestWindow(NOW + 3 * DAY, NOW).state).toBe('open');
    expect(seatRequestWindow(NOW + SEAT_REQUEST_HOLD_MS, NOW).state).toBe('open');
    expect(seatRequestWindow(NOW + 60_000, NOW).state).toBe('open');
  });

  it('is too early beyond the hold window, and reports when it opens', () => {
    const start = NOW + 30 * DAY;
    const w = seatRequestWindow(start, NOW);
    expect(w.state).toBe('too_early');
    expect(w.opensAtMs).toBe(start - SEAT_REQUEST_HOLD_MS);
  });

  it('is closed once the seminar has started', () => {
    expect(seatRequestWindow(NOW - 1, NOW).state).toBe('closed');
    expect(seatRequestWindow(NOW, NOW).state).toBe('closed');
  });

  it('treats missing or sentinel start dates as undated', () => {
    expect(seatRequestWindow(null, NOW).state).toBe('undated');
    expect(seatRequestWindow(undefined, NOW).state).toBe('undated');
    expect(seatRequestWindow(0, NOW).state).toBe('undated');
    expect(seatRequestWindow(Number.MAX_SAFE_INTEGER, NOW).state).toBe('undated');
  });
});

describe('seatRequestWindowMessage', () => {
  it('tells a too-early student the date to come back after', () => {
    const msg = seatRequestWindowMessage(seatRequestWindow(NOW + 30 * DAY, NOW), { price: 40 });
    expect(msg).toMatch(/^After /);
    expect(msg).toContain('check for seat availability again');
  });

  it('tells an in-window student to pay to join the waiting list', () => {
    expect(seatRequestWindowMessage(seatRequestWindow(NOW + DAY, NOW), { price: 40 })).toContain(
      'Pay to get on the waiting list for the host to approve',
    );
  });

  it('drops the payment wording for free seminars', () => {
    const msg = seatRequestWindowMessage(seatRequestWindow(NOW + DAY, NOW), { price: 0 });
    expect(msg).not.toContain('Pay');
    expect(msg).toContain('waiting list');
  });

  it('explains started and undated seminars', () => {
    expect(seatRequestWindowMessage(seatRequestWindow(NOW - DAY, NOW))).toContain('already started');
    expect(seatRequestWindowMessage(seatRequestWindow(null, NOW))).toContain('start date');
  });
});

describe('seatRequestWindowShortLabel', () => {
  it('names the opening date while it is too early', () => {
    expect(seatRequestWindowShortLabel(seatRequestWindow(NOW + 30 * DAY, NOW))).toMatch(
      /^Waiting list opens /,
    );
  });

  it('says the list is open inside the window', () => {
    expect(seatRequestWindowShortLabel(seatRequestWindow(NOW + DAY, NOW))).toBe('Waiting list open');
  });
});

describe('seatRequestActionLabel', () => {
  it('mentions payment only when the seminar costs money', () => {
    expect(seatRequestActionLabel(40)).toBe('Pay to join the waiting list');
    expect(seatRequestActionLabel(0)).toBe('Join the waiting list');
  });
});
