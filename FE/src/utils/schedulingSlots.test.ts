import { describe, expect, it } from 'vitest';
import {
  formatHourRange,
  formatSubIntervals,
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

  describe('formatHourRange', () => {
    it('formats same-period morning hour', () => {
      expect(formatHourRange(8)).toBe('8:00 AM\u20139:00 AM');
    });

    it('formats AM to PM crossover at 11', () => {
      expect(formatHourRange(11)).toBe('11:00 AM\u201312:00 PM');
    });

    it('formats noon', () => {
      expect(formatHourRange(12)).toBe('12:00 PM\u20131:00 PM');
    });

    it('formats evening hour', () => {
      expect(formatHourRange(20)).toBe('8:00 PM\u20139:00 PM');
    });

    it('formats midnight wrap at 23', () => {
      expect(formatHourRange(23)).toBe('11:00 PM\u201312:00 AM');
    });
  });

  describe('formatSubIntervals', () => {
    it('returns empty string for 60-min duration', () => {
      expect(formatSubIntervals(20, 60)).toBe('');
      expect(formatSubIntervals(0, 60)).toBe('');
    });

    it('collapses period when 30-min halves share AM/PM', () => {
      expect(formatSubIntervals(20, 30)).toBe('8:00\u20138:30 \u00b7 8:30\u20139:00 PM');
    });

    it('keeps both periods when 30-min halves cross noon', () => {
      expect(formatSubIntervals(11, 30)).toBe(
        '11:00\u201311:30 AM \u00b7 11:30 AM\u201312:00 PM',
      );
    });

    it('keeps both periods when 30-min halves cross midnight', () => {
      expect(formatSubIntervals(23, 30)).toBe(
        '11:00\u201311:30 PM \u00b7 11:30 PM\u201312:00 AM',
      );
    });

    it('describes 90-min span into next hour', () => {
      expect(formatSubIntervals(20, 90)).toBe('90 min \u00b7 spans into 9 PM');
    });

    it('describes 90-min span wrapping into 12 AM', () => {
      expect(formatSubIntervals(23, 90)).toBe('90 min \u00b7 spans into 12 AM');
    });
  });
});
