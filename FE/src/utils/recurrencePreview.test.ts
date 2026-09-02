import { describe, it, expect } from 'vitest';
import {
  MAX_RECURRENCE_OCCURRENCES,
  previewRecurrence,
  previewSummary,
} from './recurrencePreview';

const start = new Date(2026, 8, 1, 14, 0, 0); // Sep 1 2026, 14:00 local
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('previewRecurrence', () => {
  it('expands a fixed number of sessions, first one included', () => {
    const { dates } = previewRecurrence({ start, unit: 'day', interval: 3, endMode: 'count', count: 4 });
    expect(dates.map(ymd)).toEqual(['2026-09-01', '2026-09-04', '2026-09-07', '2026-09-10']);
  });

  it('holds the start time on every occurrence', () => {
    const { dates } = previewRecurrence({ start, unit: 'week', interval: 1, endMode: 'count', count: 3 });
    expect(dates.every((d) => d.getHours() === 14 && d.getMinutes() === 0)).toBe(true);
  });

  it('runs to an end date inclusively', () => {
    const { dates } = previewRecurrence({ start, unit: 'day', interval: 2, endMode: 'until', until: '2026-09-07' });
    expect(dates.map(ymd)).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07']);
  });

  it('falls back to a one-year horizon when the expert sets no end', () => {
    const { dates } = previewRecurrence({ start, unit: 'day', interval: 1, endMode: 'horizon' });
    expect(dates.length).toBe(365);
  });

  it('clamps a monthly series to the end of short months', () => {
    const jan31 = new Date(2026, 0, 31, 15, 0, 0);
    const { dates } = previewRecurrence({ start: jan31, unit: 'month', interval: 1, endMode: 'count', count: 4 });
    expect(dates.map(ymd)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('flags a rule that runs past the guard', () => {
    const tooMany = previewRecurrence({ start, unit: 'day', interval: 1, endMode: 'count', count: 9999 });
    expect(tooMany.dates.length).toBe(MAX_RECURRENCE_OCCURRENCES);
    expect(tooMany.overLimit).toBe(true);

    const exact = previewRecurrence({ start, unit: 'day', interval: 1, endMode: 'count', count: MAX_RECURRENCE_OCCURRENCES });
    expect(exact.overLimit).toBe(false);
  });

  it('produces nothing from an unusable rule', () => {
    expect(previewRecurrence({ start: null, unit: 'day', interval: 1, endMode: 'horizon' }).dates).toEqual([]);
    expect(previewRecurrence({ start, unit: 'day', interval: 0, endMode: 'horizon' }).dates).toEqual([]);
    expect(previewRecurrence({ start, unit: 'day', interval: 99, endMode: 'horizon' }).dates).toEqual([]);
    expect(previewRecurrence({ start, unit: 'day', interval: 1, endMode: 'until', until: '' }).dates).toEqual([]);
  });

  it('runs a weekly series on named weekdays', () => {
    // Sep 1 2026 is a Tuesday; Mon (1) and Fri (5).
    const { dates } = previewRecurrence({
      start, unit: 'week', interval: 1, weekdays: [1, 5], endMode: 'count', count: 5,
    });
    expect(dates.map(ymd)).toEqual(['2026-09-01', '2026-09-04', '2026-09-07', '2026-09-11', '2026-09-14']);
  });

  it('skips days that fall before the start in the first week', () => {
    const { dates } = previewRecurrence({
      start, unit: 'week', interval: 1, weekdays: [1, 3], endMode: 'count', count: 4,
    });
    expect(dates.map(ymd)).toEqual(['2026-09-01', '2026-09-02', '2026-09-07', '2026-09-09']);
  });

  it('spaces named weekdays by the week interval', () => {
    const { dates } = previewRecurrence({
      start, unit: 'week', interval: 2, weekdays: [2, 4], endMode: 'count', count: 4,
    });
    expect(dates.map(ymd)).toEqual(['2026-09-01', '2026-09-03', '2026-09-15', '2026-09-17']);
  });

  it('ignores weekdays on a rule they cannot apply to', () => {
    const { dates } = previewRecurrence({
      start, unit: 'day', interval: 2, weekdays: [1, 5], endMode: 'count', count: 3,
    });
    expect(dates.map(ymd)).toEqual(['2026-09-01', '2026-09-03', '2026-09-05']);
  });

  it('summarises the series for the form', () => {
    const preview = previewRecurrence({ start, unit: 'week', interval: 1, endMode: 'count', count: 3 });
    expect(previewSummary(preview)).toMatch(/^3 sessions · Sep 1, 2026 → Sep 15, 2026$/);
    expect(previewSummary({ dates: [], overLimit: false })).toBeNull();
  });
});
