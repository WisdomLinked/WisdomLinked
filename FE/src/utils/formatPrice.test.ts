import { describe, expect, it } from 'vitest';
import { formatDuration, formatPrice, lowestHourlyRate } from './formatPrice';

describe('formatPrice', () => {
  it('formats whole dollars without cents', () => {
    expect(formatPrice(45)).toBe('$45');
  });

  it('keeps fractional dollars to two places', () => {
    expect(formatPrice(45.5)).toBe('$45.50');
  });

  it('returns Free for 0', () => {
    expect(formatPrice(0)).toBe('Free');
  });

  it('returns null for missing or invalid amounts', () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice(Number.NaN)).toBeNull();
  });
});

describe('lowestHourlyRate', () => {
  it('uses a single hourly rate', () => {
    expect(lowestHourlyRate(50)).toBe(50);
    expect(lowestHourlyRate([75])).toBe(75);
  });

  it('takes the min when multiple rates are stored', () => {
    expect(lowestHourlyRate([80, 45, 60])).toBe(45);
  });

  it('treats 0 as a published free rate and missing as none', () => {
    expect(lowestHourlyRate(0)).toBe(0);
    expect(lowestHourlyRate([0])).toBe(0);
    expect(lowestHourlyRate(undefined)).toBeNull();
    expect(lowestHourlyRate([])).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours the way the card suffix expects', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(90)).toBe('1.5 hr');
  });
});
