export const SITE_SEARCH_DEBOUNCE_MS = 300;

export type SiteSearchAudience = 'public' | 'student' | 'expert' | 'admin';

export type SiteSearchPerson = {
  id: string;
  name: string;
  image?: string;
};

export type SiteSearchResponse = {
  experts: Array<{
    id: string;
    name: string;
    title?: string;
    bio?: string;
    image?: string;
    bookable?: boolean;
    hourlyRate?: number;
  }>;
  seminars: Array<{
    id: string;
    name: string;
    description?: string;
    image?: string;
    hostImage?: string;
    price?: number;
    seats?: string;
    full?: boolean;
  }>;
  students: Array<{
    id: string;
    name: string;
    image?: string;
    degreeSought?: string;
    currentUniversity?: string;
    intendedIntake?: string;
  }>;
  yours: Array<{
    id: string;
    name: string;
    start?: string | null;
    end?: string | null;
    student?: SiteSearchPerson;
    expert?: SiteSearchPerson;
  }>;
  pages: Array<{
    title: string;
    snippet: string;
    route: string;
  }>;
};

const asList = (value: unknown): any[] => (Array.isArray(value) ? value : []);

export function normalizeSiteSearchResponse(data: unknown): SiteSearchResponse {
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    experts: asList(row.experts),
    seminars: asList(row.seminars),
    students: asList(row.students),
    yours: asList(row.yours),
    pages: asList(row.pages),
  };
}

/** https objects under a chatFiles path are seminar covers, not profile filenames. */
export function isSeminarCoverUrl(value: unknown): value is string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return url.pathname.split('/').filter(Boolean).includes('chatFiles');
}

export function isEmailQuery(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function siteSearchAudienceForRole(role: unknown): Exclude<SiteSearchAudience, 'public'> {
  if (role === 'admin') return 'admin';
  if (role === 'expert') return 'expert';
  return 'student';
}

export function studentDashboardPath(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/user/studentdashboard?${qs}` : '/user/studentdashboard';
}

/** Puts the dashboard path inside redirect so its query is not a sibling of redirect. */
export function loginRedirect(path: string): string {
  const search = new URLSearchParams();
  search.set('redirect', path);
  return `/login?${search.toString()}`;
}

export function loggedOutExpertHref(expertId: string): string {
  return loginRedirect(studentDashboardPath({ expert: expertId }));
}

export function loggedOutSeminarHref(seminarId: string): string {
  return loginRedirect(studentDashboardPath({ seminar: seminarId }));
}

export function adminUserMgmtEmailHref(email: string): string {
  const search = new URLSearchParams();
  search.set('email', email.trim());
  return `/user/admindashboard/usermgmt?${search.toString()}`;
}

export type StudentSearchAction =
  | { type: 'open-expert'; expertId: string }
  | { type: 'open-seminar'; seminarId: string }
  | { type: 'prefill-experts'; query: string }
  | { type: 'prefill-seminars'; query: string };

export function readStudentDashboardSearch(search: string): {
  expertId: string | null;
  seminarId: string | null;
  expertsQuery: string | null;
  seminarsQuery: string | null;
} {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  return {
    expertId: params.get('expert'),
    seminarId: params.get('seminar'),
    expertsQuery: params.has('expertsQuery') ? params.get('expertsQuery') ?? '' : null,
    seminarsQuery: params.has('seminarsQuery') ? params.get('seminarsQuery') ?? '' : null,
  };
}

/**
 * Student dashboard mount actions for a global-search landing URL.
 * A seminar id is never an expert id, so getExpertById is not implied for it.
 * This list does not set wl_open_seminar_id or student_booking.
 */
export function studentSearchActions(search: string): StudentSearchAction[] {
  const intent = readStudentDashboardSearch(search);
  const actions: StudentSearchAction[] = [];
  if (intent.expertId) actions.push({ type: 'open-expert', expertId: intent.expertId });
  if (intent.seminarId) actions.push({ type: 'open-seminar', seminarId: intent.seminarId });
  if (intent.expertsQuery != null) actions.push({ type: 'prefill-experts', query: intent.expertsQuery });
  if (intent.seminarsQuery != null) actions.push({ type: 'prefill-seminars', query: intent.seminarsQuery });
  return actions;
}

export function hrefForExpertHit(audience: SiteSearchAudience, expertId: string): string | null {
  const path = studentDashboardPath({ expert: expertId });
  if (audience === 'public') return loginRedirect(path);
  if (audience === 'student') return path;
  return null;
}

export function hrefForSeminarHit(audience: SiteSearchAudience, seminarId: string): string | null {
  const path = studentDashboardPath({ seminar: seminarId });
  if (audience === 'public') return loginRedirect(path);
  if (audience === 'student') return path;
  return null;
}

export function hrefForFindExperts(audience: SiteSearchAudience, query: string): string | null {
  if (audience !== 'public' && audience !== 'student') return null;
  const path = studentDashboardPath({ expertsQuery: query });
  return audience === 'public' ? loginRedirect(path) : path;
}

export function hrefForStudentSeminars(audience: SiteSearchAudience, query: string): string | null {
  if (audience !== 'public' && audience !== 'student') return null;
  const path = studentDashboardPath({ seminarsQuery: query });
  return audience === 'public' ? loginRedirect(path) : path;
}
