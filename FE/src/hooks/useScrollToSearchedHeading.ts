import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export type SearchedHeadingState = { searchHeading?: string };

const RETRY_MS = 150;
const MAX_TRIES = 20;

const normalize = (text: string | null | undefined) =>
  String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export function findHeading(title: string, root: ParentNode = document): HTMLElement | null {
  const wanted = normalize(title);
  if (!wanted) return null;
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3'));
  return headings.find((h) => normalize(h.textContent) === wanted) ?? null;
}

export function useScrollToSearchedHeading(): void {
  const location = useLocation();
  const heading = (location.state as SearchedHeadingState | null)?.searchHeading;

  useEffect(() => {
    if (!heading) return undefined;
    let tries = 0;
    let timer: number | undefined;
    const attempt = () => {
      const target = findHeading(heading);
      if (target) {
        const headerBottom = Array.from(document.querySelectorAll<HTMLElement>('[data-wl-header]')).reduce(
          (lowest, el) => Math.max(lowest, el.getBoundingClientRect().bottom),
          0,
        );
        const top = target.getBoundingClientRect().top + window.scrollY - headerBottom - 16;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        return;
      }
      tries += 1;
      if (tries < MAX_TRIES) timer = window.setTimeout(attempt, RETRY_MS);
    };
    attempt();
    return () => window.clearTimeout(timer);
  }, [location.key, heading]);
}
