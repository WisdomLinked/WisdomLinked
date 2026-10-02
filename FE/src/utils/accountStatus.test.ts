import { describe, expect, it } from 'vitest';
import { isAccountUnderReview } from './accountStatus';

describe('isAccountUnderReview', () => {
  it('is true only for review status', () => {
    expect(isAccountUnderReview('review')).toBe(true);
    expect(isAccountUnderReview('active')).toBe(false);
    expect(isAccountUnderReview('blocked')).toBe(false);
    expect(isAccountUnderReview(undefined)).toBe(false);
    expect(isAccountUnderReview(null)).toBe(false);
  });
});
