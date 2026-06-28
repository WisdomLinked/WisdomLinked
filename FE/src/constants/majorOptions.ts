export const MAJOR_OPTIONS: string[] = [
  'Aerospace Engineering',
  'Biomedical Engineering',
  'Chemical Engineering',
  'Civil Engineering',
  'Computer Engineering',
  'Electrical Engineering',
  'Environmental Engineering',
  'Industrial Engineering',
  'Mechanical Engineering',
  'Materials Science & Engineering',
  'Nuclear Engineering',
  'Petroleum Engineering',
  'Software Engineering',
  'Systems Engineering',
];

export const OTHER_MAJOR = 'Other';

export const MAJOR_OPTIONS_WITH_OTHER: string[] = [...MAJOR_OPTIONS, OTHER_MAJOR];

export function isBaselineMajor(value: string): boolean {
  const v = String(value || '').trim().toLowerCase();
  return MAJOR_OPTIONS.some((m) => m.toLowerCase() === v);
}
