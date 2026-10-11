import { describe, expect, it } from 'vitest';
import { isExpertSetupComplete } from './setupSteps';

const complete = (overrides: Record<string, unknown> = {}) => ({
  price: [25],
  appointmentDurations: [30, 60],
  bufferMinutes: 15,
  bookingNoticeHours: 24,
  availabilityMode: 'common',
  timeSlots: [18, 19],
  ...overrides,
}) as any;

describe('isExpertSetupComplete', () => {
  it('is true only when all four steps are done', () => {
    expect(isExpertSetupComplete(complete())).toBe(true);
    expect(isExpertSetupComplete(null)).toBe(false);
    expect(isExpertSetupComplete(undefined)).toBe(false);
  });

  it('hourly rate: needs at least $5 and not still pending', () => {
    expect(isExpertSetupComplete(complete({ price: [4] }))).toBe(false);
    expect(isExpertSetupComplete(complete({ price: [] }))).toBe(false);
    expect(isExpertSetupComplete(complete({ price: [5] }))).toBe(true);
    expect(isExpertSetupComplete(complete({ pendingSetupSteps: ['rate'] }))).toBe(false);
  });

  it('session lengths: still pending blocks', () => {
    expect(isExpertSetupComplete(complete({ pendingSetupSteps: ['durations'] }))).toBe(false);
    expect(isExpertSetupComplete(complete({ pendingSetupSteps: [] }))).toBe(true);
  });

  it('booking rules: an expert who never picked a buffer is incomplete', () => {
    expect(isExpertSetupComplete(complete({ bufferMinutes: undefined }))).toBe(false);
    expect(isExpertSetupComplete(complete({ bufferMinutes: 20 }))).toBe(false);
    expect(isExpertSetupComplete(complete({ bufferMinutes: 0 }))).toBe(true);
    expect(isExpertSetupComplete(complete({ bufferMinutes: '30' }))).toBe(true);
  });

  it('booking rules: notice must be 24, 48 or 72 hours', () => {
    expect(isExpertSetupComplete(complete({ bookingNoticeHours: 12 }))).toBe(false);
    expect(isExpertSetupComplete(complete({ bookingNoticeHours: undefined }))).toBe(false);
    expect(isExpertSetupComplete(complete({ bookingNoticeHours: 72 }))).toBe(true);
  });

  it('weekly time slots: same-every-day mode needs at least one hour', () => {
    expect(isExpertSetupComplete(complete({ timeSlots: [] }))).toBe(false);
    expect(isExpertSetupComplete(complete({ timeSlots: [99] }))).toBe(false);
    expect(isExpertSetupComplete(complete({ timeSlots: undefined }))).toBe(false);
  });

  it('weekly time slots: per-weekday mode reads the weekly map, not timeSlots', () => {
    const daily = { availabilityMode: 'daily', timeSlots: [] };
    expect(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: { Tue: [20] } }))).toBe(true);
    expect(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: { Tue: [] } }))).toBe(false);
    expect(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: undefined, timeSlots: [18] }))).toBe(false);
  });
});
