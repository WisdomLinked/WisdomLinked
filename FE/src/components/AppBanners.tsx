import React, { useEffect, useRef } from 'react';
import ImpersonationBanner from './ImpersonationBanner';
import AnnouncementBanner from './AnnouncementBanner';
import { syncHeaderHeight } from '../hooks/useSyncHeaderHeight';

const OFFSET_VAR = '--wl-banner-offset';

export default function AppBanners() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty(OFFSET_VAR, `${h}px`);
      syncHeaderHeight();
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(OFFSET_VAR);
    };
  }, []);

  return (
    <>
      <div ref={ref} data-wl-header className="fixed top-0 inset-x-0 z-[100]">
        <ImpersonationBanner />
        <AnnouncementBanner />
      </div>
      <div aria-hidden className="shrink-0" style={{ height: 'var(--wl-banner-offset, 0px)' }} />
    </>
  );
}
