import { describe, expect, it } from 'vitest';
import {
  appointmentDurationsEqual,
  defaultAppointmentDuration,
  formatOfferedDurationsList,
  normalizeAppointmentDurations,
  previewDurationForSlots,
} from './appointmentDurations';

describe('appointmentDurations', () => {
  it('defaults to all three when missing or invalid', () => {
    expect(normalizeAppointmentDurations(undefined)).toEqual([30, 60, 90]);
    expect(normalizeAppointmentDurations([])).toEqual([30, 60, 90]);
    expect(normalizeAppointmentDurations([45, 120])).toEqual([30, 60, 90]);
  });

  it('normalizes and dedupes valid selections', () => {
    expect(normalizeAppointmentDurations([90, 60, 60])).toEqual([60, 90]);
    expect(normalizeAppointmentDurations(['60', '90'])).toEqual([60, 90]);
  });

  it('compares normalized arrays', () => {
    expect(appointmentDurationsEqual([60, 90], [90, 60])).toBe(true);
    expect(appointmentDurationsEqual([60], [60, 90])).toBe(false);
  });

  it('formats offered duration labels', () => {
    expect(formatOfferedDurationsList([60, 90])).toBe('60 min / 90 min');
  });

  it('picks preview duration for slot pills', () => {
    expect(previewDurationForSlots([60, 90])).toBe(60);
    expect(previewDurationForSlots([90])).toBe(90);
    expect(previewDurationForSlots([30, 60, 90])).toBe(30);
  });

  it('defaults student selection to lowest offered duration', () => {
    expect(defaultAppointmentDuration([60, 90])).toBe(60);
  });
});
