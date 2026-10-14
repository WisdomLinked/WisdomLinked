/** Admin profile approval lives on User.status (`review` until approved as `active`). */
export function isAccountUnderReview(status?: string | null): boolean {
  return status === 'review';
}

export function isAccountBlocked(status?: string | null): boolean {
  return status === 'blocked';
}

export const ACCOUNT_UNDER_REVIEW_MESSAGE =
  "Your profile is under review. You'll have full access to sessions, seminars, and other features once it's approved.";

export const ACCOUNT_BLOCKED_MESSAGE = 'Your profile is blocked. Contact admin for more details.';

export function accountRestrictionMessage(status?: string | null): string | null {
  if (isAccountBlocked(status)) return ACCOUNT_BLOCKED_MESSAGE;
  if (isAccountUnderReview(status)) return ACCOUNT_UNDER_REVIEW_MESSAGE;
  return null;
}
