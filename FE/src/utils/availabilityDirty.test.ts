import { describe, expect, it } from 'vitest';
import { computeAvailabilityChanges, type AvailabilityDraft } from './availabilityDirty';

const saved = {
  price: [50],
  timeSlots: [18, 19, 20, 21],
  appointmentDurations: [30, 60, 90],
  availabilityMode: 'common',
  weeklyTimeSlots: null,
};

const draft = (over: Partial<AvailabilityDraft> = {}): AvailabilityDraft => ({
  hourlyRate: '50',
  mode: 'common',
  timeSlots: [18, 19, 20, 21],
  weeklyTimeSlots: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
  appointmentDurations: [30, 60, 90],
  ...over,
});

describe('computeAvailabilityChanges', () => {
  it('reports no change for a freshly loaded form', () => {
    expect(computeAvailabilityChanges(draft(), saved).anyChanged).toBe(false);
  });

  it('ignores time slot ordering', () => {
    const changes = computeAvailabilityChanges(draft({ timeSlots: [21, 18, 20, 19] }), saved);
    expect(changes.slotsChanged).toBe(false);
    expect(changes.anyChanged).toBe(false);
  });

  it('detects an hourly rate change', () => {
    const changes = computeAvailabilityChanges(draft({ hourlyRate: '75' }), saved);
    expect(changes.rateChanged).toBe(true);
    expect(changes.anyChanged).toBe(true);
  });

  it('detects a time slot change', () => {
    const changes = computeAvailabilityChanges(draft({ timeSlots: [18, 19] }), saved);
    expect(changes.slotsChanged).toBe(true);
    expect(changes.availabilityChanged).toBe(true);
  });

  it('detects an appointment duration change', () => {
    const changes = computeAvailabilityChanges(draft({ appointmentDurations: [60, 90] }), saved);
    expect(changes.durationsChanged).toBe(true);
    expect(changes.anyChanged).toBe(true);
  });

  it('detects a mode change', () => {
    const changes = computeAvailabilityChanges(draft({ mode: 'daily' }), saved);
    expect(changes.modeChanged).toBe(true);
    expect(changes.availabilityChanged).toBe(true);
  });

  it('ignores weekday picks while in common mode', () => {
    const changes = computeAvailabilityChanges(
      draft({ weeklyTimeSlots: { Mon: [10, 11], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] } }),
      saved,
    );
    expect(changes.weeklyChanged).toBe(false);
  });

  it('counts weekday picks in daily mode', () => {
    const dailySaved = { ...saved, availabilityMode: 'daily' };
    const changes = computeAvailabilityChanges(
      draft({
        mode: 'daily',
        weeklyTimeSlots: { Mon: [10, 11], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] },
      }),
      dailySaved,
    );
    expect(changes.weeklyChanged).toBe(true);
    expect(changes.anyChanged).toBe(true);
  });

  it('treats an empty rate input as unchanged when no price is stored', () => {
    const noPrice = { ...saved, price: [] };
    const changes = computeAvailabilityChanges(draft({ hourlyRate: '' }), noPrice);
    expect(changes.rateChanged).toBe(false);
    expect(changes.anyChanged).toBe(false);
  });

  it('treats a cleared rate as a change when a price is stored', () => {
    const changes = computeAvailabilityChanges(draft({ hourlyRate: '' }), saved);
    expect(changes.rateChanged).toBe(true);
  });

  it('does not confuse a stored zero price with an empty input', () => {
    const zeroPrice = { ...saved, price: [0] };
    expect(computeAvailabilityChanges(draft({ hourlyRate: '0' }), zeroPrice).rateChanged).toBe(false);
    expect(computeAvailabilityChanges(draft({ hourlyRate: '' }), zeroPrice).rateChanged).toBe(true);
  });

  it('ignores surrounding whitespace in the rate input', () => {
    expect(computeAvailabilityChanges(draft({ hourlyRate: ' 50 ' }), saved).rateChanged).toBe(false);
  });

  it('survives a missing saved user', () => {
    const changes = computeAvailabilityChanges(draft({ hourlyRate: '', timeSlots: [] }), null);
    expect(changes.anyChanged).toBe(false);
  });
});
