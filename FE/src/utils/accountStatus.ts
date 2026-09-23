/** Admin profile approval lives on User.status (`review` until approved as `active`). */
export function isAccountUnderReview(status?: string | null): boolean {
  return status === 'review';
}
