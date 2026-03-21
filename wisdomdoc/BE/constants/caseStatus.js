/** Case status enum - all valid statuses in the workflow */
export const CaseStatus = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ASSIGNED: 'assigned',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFO: 'needs_info',
  RESUBMITTED: 'resubmitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  OVERDUE: 'overdue',
});

export const CASE_STATUSES = Object.values(CaseStatus);

/** Allowed status transitions: from -> [to] */
export const STATUS_TRANSITIONS = Object.freeze({
  [CaseStatus.DRAFT]: [CaseStatus.SUBMITTED],
  [CaseStatus.SUBMITTED]: [CaseStatus.ASSIGNED, CaseStatus.OVERDUE],
  [CaseStatus.ASSIGNED]: [CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.OVERDUE],
  [CaseStatus.UNDER_REVIEW]: [CaseStatus.NEEDS_INFO, CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.OVERDUE],
  [CaseStatus.NEEDS_INFO]: [CaseStatus.RESUBMITTED, CaseStatus.OVERDUE],
  [CaseStatus.RESUBMITTED]: [CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.OVERDUE],
  [CaseStatus.APPROVED]: [], // terminal
  [CaseStatus.REJECTED]: [], // terminal
  [CaseStatus.OVERDUE]: [CaseStatus.ASSIGNED, CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.APPROVED, CaseStatus.REJECTED],
});

/** Statuses that trigger email */
export const EMAIL_TRIGGER_STATUSES = [
  CaseStatus.NEEDS_INFO,
  CaseStatus.ASSIGNED,
  CaseStatus.RESUBMITTED,
  CaseStatus.APPROVED,
  CaseStatus.REJECTED,
];
