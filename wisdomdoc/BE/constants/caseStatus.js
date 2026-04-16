/** Case status enum - all valid statuses in the workflow */
export const CaseStatus = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ASSIGNED: 'assigned',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFO: 'needs_info',
  RESUBMITTED: 'resubmitted',
  /** Expert recommended approval; admin must finalize */
  PENDING_ADMIN_APPROVAL: 'pending_admin_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  /** Student closed the application; terminal (same upload rules as rejected) */
  WITHDRAWN: 'withdrawn',
  OVERDUE: 'overdue',
});

export const CASE_STATUSES = Object.values(CaseStatus);

/** Allowed status transitions: from -> [to] */
export const STATUS_TRANSITIONS = Object.freeze({
  [CaseStatus.DRAFT]: [CaseStatus.SUBMITTED],
  [CaseStatus.SUBMITTED]: [CaseStatus.ASSIGNED, CaseStatus.OVERDUE, CaseStatus.WITHDRAWN],
  [CaseStatus.ASSIGNED]: [CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.OVERDUE, CaseStatus.PENDING_ADMIN_APPROVAL, CaseStatus.WITHDRAWN],
  [CaseStatus.UNDER_REVIEW]: [CaseStatus.NEEDS_INFO, CaseStatus.REJECTED, CaseStatus.OVERDUE, CaseStatus.PENDING_ADMIN_APPROVAL, CaseStatus.WITHDRAWN],
  [CaseStatus.NEEDS_INFO]: [CaseStatus.RESUBMITTED, CaseStatus.OVERDUE, CaseStatus.WITHDRAWN],
  [CaseStatus.RESUBMITTED]: [CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.REJECTED, CaseStatus.OVERDUE, CaseStatus.PENDING_ADMIN_APPROVAL, CaseStatus.WITHDRAWN],
  [CaseStatus.PENDING_ADMIN_APPROVAL]: [CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.NEEDS_INFO, CaseStatus.WITHDRAWN],
  [CaseStatus.APPROVED]: [CaseStatus.NEEDS_INFO], // admin-only: reopen for supplements
  /** Admin may reopen to submitted to queue a second review (e.g. different professor) */
  [CaseStatus.REJECTED]: [CaseStatus.SUBMITTED],
  [CaseStatus.WITHDRAWN]: [], // terminal
  [CaseStatus.OVERDUE]: [CaseStatus.ASSIGNED, CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.REJECTED, CaseStatus.PENDING_ADMIN_APPROVAL, CaseStatus.WITHDRAWN],
});

/** Statuses that trigger email */
export const EMAIL_TRIGGER_STATUSES = [
  CaseStatus.NEEDS_INFO,
  CaseStatus.ASSIGNED,
  CaseStatus.RESUBMITTED,
  CaseStatus.PENDING_ADMIN_APPROVAL,
  CaseStatus.APPROVED,
  CaseStatus.REJECTED,
  CaseStatus.WITHDRAWN,
];
