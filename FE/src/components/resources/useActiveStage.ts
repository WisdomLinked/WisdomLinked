import { useCallback, useEffect, useRef, useState } from 'react';

export const stageHeadingId = (id: string) => `${id}-title`;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tracks which stage is in the reading band near the middle of the viewport, and scrolls to stages on request. */
export function useActiveStage(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0]);
  const visible = useRef(new Set<string>());

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.current.add(entry.target.id);
          else visible.current.delete(entry.target.id);
        }
        const latest = [...ids].reverse().find((id) => visible.current.has(id));
        if (latest) setActiveId(latest);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  const scrollToStage = useCallback((id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    setActiveId(id);
    document.getElementById(stageHeadingId(id))?.focus({ preventScroll: true });
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  return { activeId, scrollToStage };
}
