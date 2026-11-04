import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDashboardAnnouncements, profileImageFetch } from '../api/api';
import { resolveProfileImageSrc } from '../utils/profileImage';
import type { DiscoveryExpert } from '../utils/studentDiscovery';
import { isVisibleToStudents, type Announcement } from '../utils/expertAnnouncement';
import type {
  DashboardAnnouncementItem,
  RecommendedCarouselItem,
} from '../components/dashboard/discovery/recommendationTypes';
import useNow from './useNow';

const DEFAULT_LIMIT = 5;
const REFETCH_MS = 60_000;

function asAnnouncement(row: unknown): DashboardAnnouncementItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Partial<Announcement> & {
    expert?: Partial<DashboardAnnouncementItem['expert']>;
  };
  if (
    !r.id
    || !r.expertId
    || !r.title
    || !r.message
    || !r.type
    || !r.publishedAt
    || !r.endsAt
    || !r.status
    || !r.expert?.id
    || !r.expert?.name
  ) {
    return null;
  }
  return {
    id: String(r.id),
    expertId: String(r.expertId),
    title: String(r.title),
    message: String(r.message),
    type: r.type,
    link: r.link ? String(r.link) : undefined,
    visibility: r.visibility || 'profile',
    feedReview: r.feedReview,
    publishedAt: String(r.publishedAt),
    endsAt: String(r.endsAt),
    status: r.status,
    expert: {
      id: String(r.expert.id),
      name: String(r.expert.name),
      title: String(r.expert.title || ''),
      field: String(r.expert.field || ''),
      image: r.expert.image ?? null,
    },
  };
}

async function withExpertImages(
  announcements: DashboardAnnouncementItem[],
): Promise<DashboardAnnouncementItem[]> {
  return Promise.all(
    announcements.map(async (a) => {
      if (!a.expert.image) return a;
      const src = await resolveProfileImageSrc(
        a.expert.image,
        'small',
        profileImageFetch as Parameters<typeof resolveProfileImageSrc>[2],
      );
      return src ? { ...a, expert: { ...a.expert, image: src } } : a;
    }),
  );
}

type Args = {
  experts: DiscoveryExpert[];
  popular: boolean;
  /** When false, skip network (e.g. parent still loading experts). */
  enabled?: boolean;
  limit?: number;
};

/**
 * Builds the Recommended carousel: live announcements first, then expert
 * recommendations, capped at `limit`. Refetches announcements on window focus
 * and every 60s so unpublish/delete/expiry drop out without a full page reload.
 */
export default function useDashboardRecommendations({
  experts,
  popular,
  enabled = true,
  limit = DEFAULT_LIMIT,
}: Args) {
  const now = useNow(REFETCH_MS);
  const [announcements, setAnnouncements] = useState<DashboardAnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      setAnnouncementsLoading(true);
      setError(null);
      try {
        const res = await getDashboardAnnouncements();
        if (cancelled) return;
        const rows = Array.isArray(res?.announcements) ? res.announcements : [];
        const now = new Date();
        const parsed = rows
          .map(asAnnouncement)
          .filter((a): a is DashboardAnnouncementItem => Boolean(a))
          .filter((a) => isVisibleToStudents(a, now));
        setAnnouncements(await withExpertImages(parsed));
      } catch {
        if (!cancelled) {
          setAnnouncements([]);
          // Keep expert slides; only surface an error when the card would otherwise be empty.
          setError('Could not load recommendations. Try again.');
        }
      } finally {
        if (!cancelled) setAnnouncementsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(refetch, REFETCH_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [enabled, refetch]);

  const items = useMemo((): RecommendedCarouselItem[] => {
    const announcementSlides: RecommendedCarouselItem[] = announcements
      .filter((a) => isVisibleToStudents(a, now))
      .map((a) => ({
        type: 'announcement' as const,
        id: `announcement-${a.id}`,
        announcement: a,
      }));
    const expertSlides: RecommendedCarouselItem[] = experts.map((expert) => ({
      type: 'expert' as const,
      id: `expert-${expert.id}`,
      expert,
      popular,
    }));
    return [...announcementSlides, ...expertSlides].slice(0, limit);
  }, [announcements, experts, popular, limit, now]);

  return {
    items,
    popular,
    announcementsLoading,
    error,
    refetch,
  };
}
