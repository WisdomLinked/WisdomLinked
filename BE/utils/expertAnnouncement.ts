export const TITLE_MAX = 80;
export const MESSAGE_MAX = 400;
export const DETAILS_MAX = 500;
export const MAX_VISIBLE_DAYS = 90;

export type AnnouncementType =
  | 'funded_ra'
  | 'research_project'
  | 'internship'
  | 'workshop'
  | 'other';

export type AnnouncementVisibility = 'profile' | 'profile_and_feed';
export type FeedReview = 'pending' | 'approved' | 'rejected';
export type AnnouncementStatus = 'live' | 'unpublished' | 'expired';

export type FieldError = { field: string; message: string };

const TYPE_SET = new Set<AnnouncementType>([
  'funded_ra',
  'research_project',
  'internship',
  'workshop',
  'other',
]);

const VISIBILITY_SET = new Set<AnnouncementVisibility>(['profile', 'profile_and_feed']);

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getEffectiveStatus(
  status: AnnouncementStatus,
  endsAt: Date | string,
  now: Date = new Date(),
): AnnouncementStatus {
  if (status === 'live' && new Date(endsAt).getTime() <= now.getTime()) return 'expired';
  return status;
}

export function isVisibleToStudents(
  doc: { status?: string; endsAt?: Date | string } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!doc?.endsAt) return false;
  const status = getEffectiveStatus(
    (doc.status as AnnouncementStatus) || 'expired',
    doc.endsAt,
    now,
  );
  return status === 'live' && new Date(doc.endsAt).getTime() > now.getTime();
}

export function validateAnnouncementBody(
  body: {
    title?: unknown;
    message?: unknown;
    type?: unknown;
    link?: unknown;
    visibility?: unknown;
    endsAt?: unknown;
  },
  now: Date = new Date(),
  opts: { requireEndsAt?: boolean } = { requireEndsAt: true },
): FieldError[] {
  const errors: FieldError[] = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';
  const visibility = typeof body.visibility === 'string' ? body.visibility : '';
  const linkRaw = typeof body.link === 'string' ? body.link.trim() : '';

  if (!title) errors.push({ field: 'title', message: 'Add a short title.' });
  else if (title.length > TITLE_MAX) {
    errors.push({ field: 'title', message: `Title can be at most ${TITLE_MAX} characters.` });
  }

  if (!message) errors.push({ field: 'message', message: 'Write a few lines about the opportunity.' });
  else if (message.length > MESSAGE_MAX) {
    errors.push({ field: 'message', message: `Message can be at most ${MESSAGE_MAX} characters.` });
  }

  if (!TYPE_SET.has(type as AnnouncementType)) {
    errors.push({ field: 'type', message: 'Pick a type.' });
  }

  if (!VISIBILITY_SET.has(visibility as AnnouncementVisibility)) {
    errors.push({ field: 'visibility', message: 'Pick where it should appear.' });
  }

  if (linkRaw) {
    if (!isHttpUrl(linkRaw)) {
      errors.push({ field: 'link', message: 'Enter a full link starting with https://' });
    }
  }

  if (opts.requireEndsAt !== false) {
    if (body.endsAt == null || body.endsAt === '') {
      errors.push({ field: 'endsAt', message: 'Pick an end date.' });
    } else {
      const endsAt = new Date(String(body.endsAt));
      if (Number.isNaN(endsAt.getTime())) {
        errors.push({ field: 'endsAt', message: 'Pick an end date.' });
      } else if (endsAt.getTime() <= now.getTime()) {
        errors.push({
          field: 'endsAt',
          message: 'That end date has already passed. Pick a new duration.',
        });
      } else {
        const maxMs = now.getTime() + MAX_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
        if (endsAt.getTime() > maxMs) {
          errors.push({
            field: 'endsAt',
            message: 'Announcements can stay up for 90 days at most.',
          });
        }
      }
    }
  }

  return errors;
}

export function feedContentChanged(
  next: { title?: string; message?: string; link?: string | null },
  current: { title?: string; message?: string; link?: string | null },
): boolean {
  const norm = (v: string | null | undefined) => String(v || '').trim();
  return (
    norm(next.title) !== norm(current.title)
    || norm(next.message) !== norm(current.message)
    || norm(next.link) !== norm(current.link)
  );
}

export function toOwnerAnnouncement(doc: any) {
  if (!doc) return null;
  const now = new Date();
  const status = getEffectiveStatus(doc.status, doc.endsAt, now);
  return {
    id: String(doc._id),
    expertId: String(doc.expertId),
    title: doc.title,
    message: doc.message,
    type: doc.type,
    link: doc.link || undefined,
    visibility: doc.visibility,
    feedReview: doc.feedReview || undefined,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : undefined,
    endsAt: doc.endsAt ? new Date(doc.endsAt).toISOString() : undefined,
    status,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
  };
}

export function toPublicAnnouncement(doc: any, now: Date = new Date()) {
  if (!isVisibleToStudents(doc, now)) return null;
  return {
    id: String(doc._id),
    expertId: String(doc.expertId),
    title: doc.title,
    message: doc.message,
    type: doc.type,
    link: doc.link || undefined,
    visibility: doc.visibility,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : undefined,
    endsAt: doc.endsAt ? new Date(doc.endsAt).toISOString() : undefined,
    status: 'live' as const,
  };
}
