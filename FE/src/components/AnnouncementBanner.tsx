import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { getActiveAnnouncement, type SiteAnnouncement } from '../api/api';

export const DISMISSED_ANNOUNCEMENT_ID_KEY = 'dismissedAnnouncementId';

export function isExternalAnnouncementLink(link: string): boolean {
  return /^(https?:)?\/\//i.test(link) || /^mailto:/i.test(link);
}

function readDismissedId(): string | null {
  try {
    return localStorage.getItem(DISMISSED_ANNOUNCEMENT_ID_KEY);
  } catch {
    return null;
  }
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<SiteAnnouncement | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(() => readDismissedId());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getActiveAnnouncement()
        .then(data => {
          if (!cancelled) setAnnouncement(data);
        })
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });
    };
    load();
    window.addEventListener('wl-announcement-change', load);
    return () => {
      cancelled = true;
      window.removeEventListener('wl-announcement-change', load);
    };
  }, []);

  if (!loaded) return null;
  if (!announcement?.id || !announcement.message || announcement.active === false) return null;
  if (dismissedId === announcement.id) return null;

  const link = (announcement.link || '').trim();
  const linkLabel = (announcement.linkLabel || '').trim() || 'Learn more';

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_ANNOUNCEMENT_ID_KEY, announcement.id);
    } catch {
      // ignore
    }
    setDismissedId(announcement.id);
  };

  const linkClassName =
    'hidden sm:inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/90 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm';

  return (
    <div role="region" aria-label="Announcement" className="bg-wl-ink text-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4">
        <span className="inline-flex shrink-0 items-center rounded-full bg-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          NEW
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-white sm:text-sm md:whitespace-normal md:overflow-visible">
          {announcement.message}
        </p>
        {link ? (
          isExternalAnnouncementLink(link) ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
            >
              <span>{linkLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <Link to={link} className={linkClassName}>
              <span>{linkLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )
        ) : null}
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
