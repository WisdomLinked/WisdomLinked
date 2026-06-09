import { describe, expect, it } from 'vitest';
import {
  convertExpertSlotsToViewer,
  detectUserTimeZone,
  formatSlotLabel,
  resolveViewerTimeZone,
  toYMDInTimeZone,
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

  it('resolveViewerTimeZone respects mode', () => {
    expect(resolveViewerTimeZone('mine', 'Asia/Kolkata', 'UTC')).toBe(detectUserTimeZone());
    expect(resolveViewerTimeZone('expert', 'Asia/Kolkata', 'UTC')).toBe('UTC');
    expect(resolveViewerTimeZone('custom', 'Asia/Kolkata', 'UTC', 'Europe/London')).toBe(
      'Europe/London',
    );
  });

  it('formatSlotLabel returns a time string', () => {
    const label = formatSlotLabel(18, new Date('2026-05-01'), 'UTC');
    expect(label).toMatch(/\d/);
  });

  it('toYMDInTimeZone formats calendar day in expert zone', () => {
    const ymd = toYMDInTimeZone(
      new Date('2026-05-01T23:30:00.000Z'),
      'America/Los_Angeles',
    );
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ymd).toBe('2026-05-01');
  });
});
