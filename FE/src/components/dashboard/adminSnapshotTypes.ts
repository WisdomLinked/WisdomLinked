export type SnapshotListType =
  | 'experts'
  | 'students'
  | 'sessions'
  | 'seminars'
  | 'payments'
  | 'refunds';

export const SNAPSHOT_LIST_TYPES: SnapshotListType[] = [
  'experts',
  'students',
  'sessions',
  'seminars',
  'payments',
  'refunds',
];

/** Activity metrics under Analytics (People + Sessions). */
export const ANALYTICS_SNAPSHOT_TYPES: SnapshotListType[] = [
  'experts',
  'students',
  'sessions',
  'seminars',
];

/** Money metrics that stay on Overview. */
export const PAYMENT_SNAPSHOT_TYPES: SnapshotListType[] = ['payments', 'refunds'];

export function isSnapshotListType(value: string | undefined): value is SnapshotListType {
  return SNAPSHOT_LIST_TYPES.includes(value as SnapshotListType);
}

export function isAnalyticsSnapshotType(value: string | undefined): boolean {
  return ANALYTICS_SNAPSHOT_TYPES.includes(value as SnapshotListType);
}

export function snapshotTabTypes(listType: SnapshotListType): SnapshotListType[] {
  return isAnalyticsSnapshotType(listType) ? ANALYTICS_SNAPSHOT_TYPES : PAYMENT_SNAPSHOT_TYPES;
}
