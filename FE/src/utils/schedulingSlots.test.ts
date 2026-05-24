import { describe, expect, it } from 'vitest';
import {
  halfHourIndicesToHours,
  hoursToHalfHourIndices,
  normalizeExpertPrice,
} from './schedulingSlots';

describe('schedulingSlots', () => {
  it('hoursToHalfHourIndices maps hour 9 to 18 and 19', () => {
    expect(hoursToHalfHourIndices([9])).toEqual([18, 19]);
  });

  it('hoursToHalfHourIndices merges multiple hours', () => {
    expect(hoursToHalfHourIndices([9, 10])).toEqual([18, 19, 20, 21]);
  });

  it('hoursToHalfHourIndices ignores invalid hours', () => {
    expect(hoursToHalfHourIndices([-1, 24, 9])).toEqual([18, 19]);
  });

  it('halfHourIndicesToHours collapses pairs', () => {
    expect(halfHourIndicesToHours([18, 19])).toEqual([9]);
    expect(halfHourIndicesToHours([18, 20])).toEqual([9, 10]);
  });

  it('round-trip hours to indices to hours', () => {
    const hours = [8, 9, 17];
    expect(halfHourIndicesToHours(hoursToHalfHourIndices(hours))).toEqual(hours);
  });

  it('normalizeExpertPrice handles number and array', () => {
    expect(normalizeExpertPrice(25)).toBe(25);
    expect(normalizeExpertPrice([30])).toBe(30);
    expect(normalizeExpertPrice('x')).toBeUndefined();
  });
});
