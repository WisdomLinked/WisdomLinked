import { describe, it, expect } from 'vitest';
import { recurrenceLabel, recurrenceSentence, weekdayList } from './recurrenceLabel';

describe('recurrenceLabel', () => {
  it('says nothing for a seminar that does not repeat', () => {
    expect(recurrenceLabel(null)).toBeUndefined();
    expect(recurrenceLabel({ isRecurring: false, recurrenceUnit: 'day', recurrenceInterval: 1 })).toBeUndefined();
  });

  it('keeps familiar names for familiar cadences', () => {
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1 })).toBe('Daily');
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1 })).toBe('Weekly');
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 2 })).toBe('Biweekly');
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'month', recurrenceInterval: 1 })).toBe('Monthly');
  });

  it('describes a custom interval', () => {
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 3 })).toBe('Every 3 days');
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 5 })).toBe('Every 5 weeks');
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'month', recurrenceInterval: 2 })).toBe('Every 2 months');
  });

  it('falls back to the legacy frequency on older seminars', () => {
    expect(recurrenceLabel({ isRecurring: true, recurrenceFrequency: 'biweekly' })).toBe('Biweekly');
    expect(recurrenceLabel({ isRecurring: true, recurrenceFrequency: 'monthly' })).toBe('Monthly');
    expect(recurrenceLabel({ isRecurring: true, recurrenceFrequency: 'quarterly' })).toBeUndefined();
  });

  it('ignores a malformed rule rather than rendering it', () => {
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'fortnight', recurrenceInterval: 2 })).toBeUndefined();
    expect(recurrenceLabel({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 0 })).toBeUndefined();
  });

  it('names the weekdays a seminar runs on', () => {
    expect(
      recurrenceLabel({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceWeekdays: [1, 5] }),
    ).toBe('Weekly on Mon & Fri');
    expect(
      recurrenceLabel({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 2, recurrenceWeekdays: [1, 3, 5] }),
    ).toBe('Every 2 weeks on Mon, Wed & Fri');
  });

  it('ignores a weekday set that says nothing the cadence does not', () => {
    // One day is just the plain weekly rule the start date already implies.
    expect(
      recurrenceLabel({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceWeekdays: [3] }),
    ).toBe('Weekly');
    // Weekdays are meaningless on a daily rule.
    expect(
      recurrenceLabel({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 2, recurrenceWeekdays: [1, 5] }),
    ).toBe('Every 2 days');
  });

  it('lists weekdays for a reader', () => {
    expect(weekdayList([1, 5])).toBe('Mon & Fri');
    expect(weekdayList([1, 3, 5])).toBe('Mon, Wed & Fri');
    expect(weekdayList([2])).toBe('Tue');
  });

  it('reads as a sentence fragment', () => {
    expect(recurrenceSentence({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 3 })).toBe('Repeats every 3 days');
    expect(recurrenceSentence({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1 })).toBe('Repeats weekly');
    expect(
      recurrenceSentence({ isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceWeekdays: [1, 5] }),
    ).toBe('Repeats weekly on Mon & Fri');
  });
});
