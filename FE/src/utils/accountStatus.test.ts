import { describe, expect, it } from 'vitest';
import { isAccountBlocked, isAccountUnderReview } from './accountStatus';

describe('isAccountUnderReview', () => {
  it('is true only for review status', () => {
    expect(isAccountUnderReview('review')).toBe(true);
    expect(isAccountUnderReview('active')).toBe(false);
    expect(isAccountUnderReview('blocked')).toBe(false);
    expect(isAccountUnderReview(undefined)).toBe(false);
    expect(isAccountUnderReview(null)).toBe(false);
  });
});

describe('isAccountBlocked', () => {
  it('is true only for blocked status', () => {
    expect(isAccountBlocked('blocked')).toBe(true);
    expect(isAccountBlocked('review')).toBe(false);
    expect(isAccountBlocked('active')).toBe(false);
    expect(isAccountBlocked(undefined)).toBe(false);
    expect(isAccountBlocked(null)).toBe(false);
  });
});
