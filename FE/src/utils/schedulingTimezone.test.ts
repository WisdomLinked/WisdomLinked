import { describe, expect, it } from 'vitest';
import {
  convertExpertSlotsToViewer,
  detectUserTimeZone,
  formatBookingConfirmation,
  formatSlotLabel,
  getViewerDayStartMs,
  getViewerSlotsForDay,
  getViewerYmdFromCalendarDate,
  resolveViewerTimeZone,
  toYMDInTimeZone,
  viewerSlotToInstant,
  zonedLocalToUtc,
} from './schedulingTimezone';

describe('schedulingTimezone', () => {
  it('detectUserTimeZone returns non-empty string', () => {
    expect(detectUserTimeZone().length).toBeGreaterThan(0);
  });

  it('convertExpertSlotsToViewer preserves slots when zones match', () => {
    const slots = [10, 11, 12];
    expect(convertExpertSlotsToViewer(slots, 'UTC', 'UTC')).toEqual(slots);
  });

  it('convertExpertSlotsToViewer shifts indices across zones', () => {
    const slots = [18, 19];
    const shifted = convertExpertSlotsToViewer(
      slots,
      'UTC',
      'America/New_York',
      new Date('2026-06-01T12:00:00.000Z'),
    );
    expect(shifted).not.toEqual(slots);
    expect(shifted.length).toBe(2);
  });

  it('convertExpertSlotsToViewer maps 10–11 PM Chicago to 8–9 PM LA on May 28', () => {
    const ref = new Date('2026-05-28T12:00:00.000Z');
    expect(
      convertExpertSlotsToViewer(
        [44, 45],
        'America/Chicago',
        'America/Los_Angeles',
        ref,
      ),
    ).toEqual([40, 41]);
  });

  it('getViewerSlotsForDay uses calendar civil date for DST reference', () => {
    const calendarDate = new Date(2026, 4, 28);
    expect(getViewerYmdFromCalendarDate(calendarDate)).toBe('2026-05-28');
    expect(
      getViewerSlotsForDay(
        calendarDate,
        'America/Los_Angeles',
        [44, 45],
        'America/Chicago',
      ),
    ).toEqual([40, 41]);
  });

  it('getViewerDayStartMs returns midnight in viewer timezone', () => {
    const calendarDate = new Date(2026, 4, 28);
    const startMs = getViewerDayStartMs(calendarDate, 'America/Los_Angeles');
    expect(toYMDInTimeZone(new Date(startMs), 'America/Los_Angeles')).toBe(
      '2026-05-28',
    );
    expect(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).format(new Date(startMs)),
    ).toBe('00:00');
  });

  it('viewerSlotToInstant maps LA 8 PM on May 28 to correct UTC', () => {
    const calendarDate = new Date(2026, 4, 28);
    const instant = viewerSlotToInstant(calendarDate, 40, 'America/Los_Angeles');
    expect(toYMDInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-05-28');
    expect(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(instant),
    ).toMatch(/8:00 PM/i);
  });

  it('zonedLocalToUtc round-trips Chicago 10 PM', () => {
    const instant = zonedLocalToUtc('2026-05-28', 22, 0, 'America/Chicago');
    expect(toYMDInTimeZone(instant, 'America/Chicago')).toBe('2026-05-28');
    expect(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(instant),
    ).toMatch(/10:00 PM/i);
  });

  it('resolveViewerTimeZone respects mode', () => {
    expect(resolveViewerTimeZone('mine', 'Asia/Kolkata', 'UTC')).toBe('Asia/Kolkata');
    expect(resolveViewerTimeZone('expert', 'Asia/Kolkata', 'UTC')).toBe('UTC');
    expect(resolveViewerTimeZone('custom', 'Asia/Kolkata', 'UTC', 'Europe/London')).toBe(
      'Europe/London',
    );
  });

  it('formatSlotLabel returns a time string in viewer timezone', () => {
    const calendarDate = new Date(2026, 4, 28);
    const label = formatSlotLabel(40, calendarDate, 'America/Los_Angeles');
    expect(label).toMatch(/8:00/i);
  });

  it('toYMDInTimeZone formats calendar day in expert zone', () => {
    const ymd = toYMDInTimeZone(
      new Date('2026-05-01T23:30:00.000Z'),
      'America/Los_Angeles',
    );
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ymd).toBe('2026-05-01');
  });

  it('formatBookingConfirmation formats date, time range, and timezone', () => {
    const start = new Date('2026-06-15T14:00:00.000Z');
    const end = new Date('2026-06-15T15:00:00.000Z');
    const result = formatBookingConfirmation(start, end, 'UTC');
    expect(result.date).toMatch(/Jun 15, 2026/);
    expect(result.timeRange).toMatch(/2:00 PM.*3:00 PM/);
    expect(result.timeZone).toBe('UTC');
  });
});
