export const TITLE_MAX = 80;
export const MESSAGE_MAX = 400;
export const DETAILS_MAX = 500;
export const MAX_VISIBLE_DAYS = 90;
export const DURATION_PRESETS = [3, 7, 14, 30] as const;
export const DEFAULT_DURATION_DAYS = 7;

export type AnnouncementType =
  | 'funded_ra'
  | 'research_project'
  | 'internship'
  | 'workshop'
  | 'other';

export type AnnouncementVisibility = 'profile' | 'profile_and_feed';
export type FeedReview = 'pending' | 'approved' | 'rejected';
export type AnnouncementStatus = 'live' | 'unpublished' | 'expired';

export type Announcement = {
  id: string;
  expertId: string;
  title: string;
  message: string;
  type: AnnouncementType;
  link?: string;
  visibility: AnnouncementVisibility;
  feedReview?: FeedReview;
  publishedAt: string;
  endsAt: string;
  status: AnnouncementStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type AnnouncementDraft = {
  title: string;
  message: string;
  type: AnnouncementType;
  link: string;
  visibility: AnnouncementVisibility;
};

export type DurationChoice =
  | { kind: 'keep' }
  | { kind: 'preset'; days: number }
  | { kind: 'custom'; endDate: string };

export type FieldErrors = Partial<Record<'title' | 'message' | 'type' | 'link' | 'endsAt' | 'visibility' | 'general', string>>;

export const TYPE_OPTIONS: { value: AnnouncementType; label: string }[] = [
  { value: 'funded_ra', label: 'Funded RA position' },
  { value: 'research_project', label: 'Research project' },
  { value: 'internship', label: 'Internship' },
  { value: 'workshop', label: 'Workshop or event' },
  { value: 'other', label: 'Other' },
];

export function typeLabel(type: AnnouncementType): string {
  return TYPE_OPTIONS.find(o => o.value === type)?.label || 'Opportunity';
}

function endOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function resolveEndsAt(
  choice: DurationChoice,
  now: Date,
  currentEndsAt?: string | null,
): Date | null {
  if (choice.kind === 'keep') {
    if (!currentEndsAt) return null;
    const d = new Date(currentEndsAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (choice.kind === 'preset') {
    return new Date(now.getTime() + choice.days * 24 * 60 * 60 * 1000);
  }
  if (!choice.endDate) return null;
  return endOfLocalDay(choice.endDate);
}

export function validateDraft(
  draft: AnnouncementDraft,
  choice: DurationChoice,
  now: Date,
  currentEndsAt?: string | null,
): FieldErrors {
  const errors: FieldErrors = {};
  const title = draft.title.trim();
  const message = draft.message.trim();
  const link = draft.link.trim();

  if (!title) errors.title = 'Add a short title.';
  else if (title.length > TITLE_MAX) errors.title = `Title can be at most ${TITLE_MAX} characters.`;

  if (!message) errors.message = 'Write a few lines about the opportunity.';
  else if (message.length > MESSAGE_MAX) errors.message = `Message can be at most ${MESSAGE_MAX} characters.`;

  if (link) {
    try {
      const u = new URL(link);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        errors.link = 'Enter a full link starting with https://';
      }
    } catch {
      errors.link = 'Enter a full link starting with https://';
    }
  }

  const endsAt = resolveEndsAt(choice, now, currentEndsAt);
  if (!endsAt) errors.endsAt = 'Pick an end date.';
  else if (endsAt.getTime() <= now.getTime()) {
    errors.endsAt = 'That end date has already passed. Pick a new duration.';
  } else if (endsAt.getTime() > now.getTime() + MAX_VISIBLE_DAYS * 24 * 60 * 60 * 1000) {
    errors.endsAt = 'Announcements can stay up for 90 days at most.';
  }

  return errors;
}

export function getEffectiveStatus(a: Pick<Announcement, 'status' | 'endsAt'>, now: Date): AnnouncementStatus {
  if (a.status === 'live' && new Date(a.endsAt).getTime() <= now.getTime()) return 'expired';
  return a.status;
}

export function isVisibleToStudents(a: Announcement | null | undefined, now: Date): boolean {
  if (!a) return false;
  return getEffectiveStatus(a, now) === 'live' && new Date(a.endsAt).getTime() > now.getTime();
}

export function isEndingSoon(a: Pick<Announcement, 'endsAt'>, now: Date): boolean {
  const left = new Date(a.endsAt).getTime() - now.getTime();
  return left > 0 && left <= 24 * 60 * 60 * 1000;
}

export function formatTimeLeft(endsAt: string, now: Date): string {
  const ms = Math.max(0, new Date(endsAt).getTime() - now.getTime());
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${Math.max(1, mins)}m left`;
}

export function formatEndDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
}

export function formatPostedAgo(publishedAt: string, now: Date): string {
  const start = new Date(publishedAt);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((startOfLocalDay(now).getTime() - startOfLocalDay(start).getTime()) / dayMs);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  return `Posted ${days} days ago`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function feedReviewWillReset(
  draft: AnnouncementDraft,
  current: Announcement | null,
): boolean {
  if (!current) return false;
  if (current.visibility !== 'profile_and_feed' && draft.visibility !== 'profile_and_feed') return false;
  if (current.feedReview !== 'approved' && draft.visibility === current.visibility) {
    // Switching into feed always needs review; editing approved content resets.
  }
  if (draft.visibility !== 'profile_and_feed') return false;
  if (current.visibility !== 'profile_and_feed') return true;
  if (current.feedReview !== 'approved') return false;
  const norm = (v: string | undefined) => String(v || '').trim();
  return (
    norm(draft.title) !== norm(current.title)
    || norm(draft.message) !== norm(current.message)
    || norm(draft.link) !== norm(current.link)
  );
}

export function progressRemaining(publishedAt: string, endsAt: string, now: Date): number {
  const start = new Date(publishedAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!(end > start)) return 0;
  const left = Math.max(0, end - now.getTime());
  return Math.min(1, left / (end - start));
}

export function firstNameFromDisplayName(name: string): string {
  const cleaned = String(name || '')
    .replace(/^(dr|prof|professor|mr|mrs|ms)\.?\s+/i, '')
    .trim();
  return cleaned.split(/\s+/)[0] || 'expert';
}

export function displayLinkHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/$/, '');
  } catch {
    return url.replace(/^https?:\/\//i, '');
  }
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysLocal(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}
