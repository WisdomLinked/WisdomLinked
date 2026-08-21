import { describe, expect, it } from 'vitest';
import {
  formatSessionDuration,
  sessionDurationLabel,
  sessionDurationMinutes,
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
