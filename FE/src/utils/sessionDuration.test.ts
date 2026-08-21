import { describe, expect, it } from 'vitest';
import {
  formatSessionDuration,
  formatSessionWhen,
  sessionDurationLabel,
  sessionDurationMinutes,
  sessionEndMs,
} from './sessionDuration';

describe('sessionDurationMinutes', () => {
  it('prefers the stored duration', () => {
    expect(sessionDurationMinutes({ duration: 45 })).toBe(45);
  });

  it('accepts a numeric string duration', () => {
    expect(sessionDurationMinutes({ duration: '30' })).toBe(30);
  });

  it('falls back to start/end when duration is missing or zero', () => {
    const session = {
      duration: 0,
      start: '2026-08-21T10:00:00.000Z',
      end: '2026-08-21T11:30:00.000Z',
    };
    expect(sessionDurationMinutes(session)).toBe(90);
  });

  it('returns null when neither duration nor a usable range exists', () => {
    expect(sessionDurationMinutes({})).toBeNull();
    expect(sessionDurationMinutes({ start: 'nope', end: 'nope' })).toBeNull();
    expect(
      sessionDurationMinutes({
        start: '2026-08-21T10:00:00.000Z',
        end: '2026-08-21T10:00:00.000Z',
      }),
    ).toBeNull();
  });
});

describe('formatSessionDuration', () => {
  it('formats minutes under an hour', () => {
    expect(formatSessionDuration(45)).toBe('45 min');
  });

  it('formats whole and partial hours', () => {
    expect(formatSessionDuration(60)).toBe('1 hr');
    expect(formatSessionDuration(90)).toBe('1 hr 30 min');
    expect(formatSessionDuration(120)).toBe('2 hr');
  });

  it('renders nothing for a missing or invalid duration', () => {
    expect(formatSessionDuration(null)).toBe('');
    expect(formatSessionDuration(undefined)).toBe('');
    expect(formatSessionDuration(0)).toBe('');
    expect(formatSessionDuration(-15)).toBe('');
  });
});

describe('sessionDurationLabel', () => {
  it('labels a session straight from its record', () => {
    expect(sessionDurationLabel({ duration: 60 })).toBe('1 hr');
    expect(sessionDurationLabel({})).toBe('');
  });
});

describe('sessionEndMs', () => {
  const start = Date.parse('2026-08-21T10:00:00.000Z');

  it('prefers a stored end time', () => {
    expect(
      sessionEndMs({
        start: '2026-08-21T10:00:00.000Z',
        end: '2026-08-21T11:00:00.000Z',
      }),
    ).toBe(start + 60 * 60_000);
  });

  it('falls back to start plus the duration', () => {
    expect(sessionEndMs({ start: '2026-08-21T10:00:00.000Z', duration: 45 })).toBe(
      start + 45 * 60_000,
    );
  });

  it('ignores an end that is not after the start', () => {
    expect(
      sessionEndMs({
        start: '2026-08-21T10:00:00.000Z',
        end: '2026-08-21T09:00:00.000Z',
        duration: 30,
      }),
    ).toBe(start + 30 * 60_000);
  });

  it('is the start itself when nothing says how long it runs', () => {
    expect(sessionEndMs({ start: '2026-08-21T10:00:00.000Z' })).toBe(start);
  });

  it('returns null without a usable start', () => {
    expect(sessionEndMs({})).toBeNull();
    expect(sessionEndMs({ start: 'nope' })).toBeNull();
  });
});

describe('formatSessionWhen', () => {
  const now = new Date('2026-08-21T12:00:00.000Z');
  const at = (iso: string) => formatSessionWhen(Date.parse(iso), now);

  it('names the calendar date, not just the weekday', () => {
    const label = at('2026-08-28T15:00:00.000Z');
    expect(label).toMatch(/Aug/);
    expect(label).toMatch(/28/);
    expect(label).toMatch(/Fri/);
  });

  it('adds the year only when it differs from this one', () => {
    expect(at('2026-12-01T15:00:00.000Z')).not.toMatch(/2026/);
    expect(at('2027-02-01T15:00:00.000Z')).toMatch(/2027/);
  });

  it('renders nothing for an unreadable instant', () => {
    expect(formatSessionWhen(Number.NaN, now)).toBe('');
  });
});
