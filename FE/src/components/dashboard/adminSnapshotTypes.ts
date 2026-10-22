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

export function isSnapshotListType(value: string | undefined): value is SnapshotListType {
  return SNAPSHOT_LIST_TYPES.includes(value as SnapshotListType);
}
