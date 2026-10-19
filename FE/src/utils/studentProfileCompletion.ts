import { canonicalLabelsFromMixedServiceEntries } from '../constants/serviceOptions';

/** Weights sum to 100 so `percent` is a direct weighted sum of section fill ratios. */
export const STUDENT_PROFILE_SECTION_WEIGHTS = {
  academic: 40,
  preferences: 30,
  resume: 30,
} as const;

export type StudentProfileSectionId = keyof typeof STUDENT_PROFILE_SECTION_WEIGHTS;

export const STUDENT_PROFILE_SECTION_HREFS: Record<StudentProfileSectionId, string> = {
  academic: '#profile-academic',
  preferences: '#profile-preferences',
  resume: '#profile-resume',
};

export type StudentProfileCompletionInput = {
  degreeSought?: unknown;
  intendedIntake?: unknown;
  currentUniversity?: unknown;
  gpa?: unknown;
  targetUniversities?: unknown;
  country?: unknown;
  services?: unknown;
  keywords?: unknown;
  customKeywords?: unknown;
  resume?: unknown;
};

export type StudentProfileSectionCompletion = {
  id: StudentProfileSectionId;
  label: string;
  weight: number;
  filled: number;
  total: number;
  isComplete: boolean;
  href: string;
};

export type StudentProfileCompletion = {
  percent: number;
  sections: StudentProfileSectionCompletion[];
};

const ACADEMIC_FIELDS = [
  'degreeSought',
  'intendedIntake',
  'currentUniversity',
  'gpa',
  'targetUniversities',
  'country',
] as const;

function coerceText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
  if (value && typeof value === 'object') {
    const doc = value as { label?: unknown; value?: unknown; name?: unknown };
    return String(doc.label ?? doc.value ?? doc.name ?? '').trim();
  }
  return '';
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => coerceText(entry).length > 0);
  return coerceText(value).length > 0;
}

/** Same canonical service matching the student profile page uses for checkboxes. */
function hasCanonicalService(services: unknown): boolean {
  return canonicalLabelsFromMixedServiceEntries(Array.isArray(services) ? services : []).length > 0;
}

function hasInterest(keywords: unknown, customKeywords: unknown): boolean {
  const lists = [keywords, customKeywords];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (isFilled(entry)) return true;
    }
  }
  return false;
}

export function getStudentProfileCompletion(
  profile: StudentProfileCompletionInput | null | undefined,
): StudentProfileCompletion {
  const source = profile ?? {};

  const academicFilled = ACADEMIC_FIELDS.filter((key) => isFilled(source[key])).length;
  const academicTotal = ACADEMIC_FIELDS.length;
  const academicRatio = academicTotal ? academicFilled / academicTotal : 0;

  const serviceDone = hasCanonicalService(source.services);
  const interestDone = hasInterest(source.keywords, source.customKeywords);
  const preferencesFilled = Number(serviceDone) + Number(interestDone);
  const preferencesTotal = 2;
  const preferencesRatio = preferencesFilled / preferencesTotal;

  const hasResume = isFilled(source.resume);
  const resumeFilled = hasResume ? 1 : 0;
  const resumeTotal = 1;
  const resumeRatio = resumeFilled / resumeTotal;

  const sections: StudentProfileSectionCompletion[] = [
    {
      id: 'academic',
      label: 'Academic background',
      weight: STUDENT_PROFILE_SECTION_WEIGHTS.academic,
      filled: academicFilled,
      total: academicTotal,
      isComplete: academicFilled === academicTotal,
      href: STUDENT_PROFILE_SECTION_HREFS.academic,
    },
    {
      id: 'preferences',
      label: 'Preferences and services',
      weight: STUDENT_PROFILE_SECTION_WEIGHTS.preferences,
      filled: preferencesFilled,
      total: preferencesTotal,
      isComplete: preferencesFilled === preferencesTotal,
      href: STUDENT_PROFILE_SECTION_HREFS.preferences,
    },
    {
      id: 'resume',
      label: 'Resume',
      weight: STUDENT_PROFILE_SECTION_WEIGHTS.resume,
      filled: resumeFilled,
      total: resumeTotal,
      isComplete: hasResume,
      href: STUDENT_PROFILE_SECTION_HREFS.resume,
    },
  ];

  const percent = Math.round(
    STUDENT_PROFILE_SECTION_WEIGHTS.academic * academicRatio +
      STUDENT_PROFILE_SECTION_WEIGHTS.preferences * preferencesRatio +
      STUDENT_PROFILE_SECTION_WEIGHTS.resume * resumeRatio,
  );

  return { percent, sections };
}
