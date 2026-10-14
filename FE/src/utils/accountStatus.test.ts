import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_BLOCKED_MESSAGE,
  ACCOUNT_UNDER_REVIEW_MESSAGE,
  accountRestrictionMessage,
  isAccountBlocked,
  isAccountUnderReview,
} from './accountStatus';

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

describe('accountRestrictionMessage', () => {
  it('names the review and blocked states with the dashboard banner copy', () => {
    expect(accountRestrictionMessage('review')).toBe(ACCOUNT_UNDER_REVIEW_MESSAGE);
    expect(accountRestrictionMessage('blocked')).toBe(ACCOUNT_BLOCKED_MESSAGE);
  });

  it('is null for an account that may schedule and book', () => {
    expect(accountRestrictionMessage('active')).toBeNull();
    expect(accountRestrictionMessage(undefined)).toBeNull();
    expect(accountRestrictionMessage(null)).toBeNull();
  });
});
