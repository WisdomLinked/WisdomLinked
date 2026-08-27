import { describe, expect, it } from 'vitest';
import { eventIsUpcoming } from './eventTiming';

const NOW = Date.parse('2026-08-10T12:00:00Z');
const iso = (msFromNow: number) => new Date(NOW + msFromNow).toISOString();
const HOUR = 60 * 60 * 1000;

describe('eventIsUpcoming', () => {
  it('treats a future event as upcoming', () => {
    expect(eventIsUpcoming({ end: iso(HOUR) }, NOW)).toBe(true);
  });

  it('treats a finished event as past', () => {
    expect(eventIsUpcoming({ end: iso(-HOUR) }, NOW)).toBe(false);
  });

  it('treats an event ending exactly now as past', () => {
    expect(eventIsUpcoming({ end: iso(0) }, NOW)).toBe(false);
  });

  // The expert calendar used to compare the ISO string straight to a Date, which
  // is false for every event and so hid the Accept/Decline buttons entirely.
  it('does not regress to the string-vs-Date comparison', () => {
    const future = { end: iso(365 * 24 * HOUR) };
    expect((future.end as any) > (new Date(NOW) as any)).toBe(false);
    expect(eventIsUpcoming(future, NOW)).toBe(true);
  });

  it('treats a missing or unparseable end as past rather than crashing', () => {
    expect(eventIsUpcoming({}, NOW)).toBe(false);
    expect(eventIsUpcoming({ end: 'sometime' }, NOW)).toBe(false);
    expect(eventIsUpcoming(null, NOW)).toBe(false);
  });
});
