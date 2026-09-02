import { describe, expect, it } from 'vitest';
import { seminarCapacityLabel, seminarEnrollmentLabel } from './seminarCapacityLabel';

describe('seminarCapacityLabel', () => {
  it('capped seminar shows filled and remaining seats', () => {
    expect(seminarCapacityLabel(0, 10)).toBe('0 of 10 seats filled · 10 left');
    expect(seminarCapacityLabel(3, 10)).toBe('3 of 10 seats filled · 7 left');
    expect(seminarCapacityLabel(9, 10)).toBe('9 of 10 seats filled · 1 left');
  });

  it('a full seminar reads Full instead of a remaining count', () => {
    expect(seminarCapacityLabel(10, 10)).toBe('10 of 10 seats filled · Full');
  });

  it('overflow past the cap still reads Full', () => {
    expect(seminarCapacityLabel(11, 10)).toBe('11 of 10 seats filled · Full');
  });

  it('a zero cap reads Full, since 0 means closed rather than unlimited', () => {
    expect(seminarCapacityLabel(0, 0)).toBe('0 of 0 seats filled · Full');
  });

  it('no cap set shows enrolled count with no limit', () => {
    expect(seminarCapacityLabel(3, null)).toBe('3 enrolled · no limit');
    expect(seminarCapacityLabel(5, undefined)).toBe('5 enrolled · no limit');
  });

  it('omitFullWord drops the Full suffix', () => {
    expect(seminarCapacityLabel(10, 10, { omitFullWord: true })).toBe('10 of 10 seats filled');
  });
});

describe('seminarEnrollmentLabel', () => {
  it('shows enrolled/waiting/cap', () => {
    expect(seminarEnrollmentLabel(18, 4, 15)).toBe('Enrollments/waiting/Cap (18/4/15)');
    expect(seminarEnrollmentLabel(8, 0, 15)).toBe('Enrollments/waiting/Cap (8/0/15)');
  });

  it('uses infinity when no cap is set', () => {
    expect(seminarEnrollmentLabel(8, 0, null)).toBe('Enrollments/waiting/Cap (8/0/∞)');
    expect(seminarEnrollmentLabel(3, 2, undefined)).toBe('Enrollments/waiting/Cap (3/2/∞)');
  });
});
