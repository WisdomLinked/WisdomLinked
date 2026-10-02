import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  title: string;
  count: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  fading?: boolean;
};

/**
 * Shared chrome for discovery carousels: white card, title, prev/next (disabled at ends),
 * and a "i / n" indicator. Matches legacy New experts card styling.
 */
export default function DiscoveryCarouselShell({
  title,
  count,
  index,
  onPrev,
  onNext,
  children,
  footer,
  empty,
  fading = false,
}: Props) {
  const atStart = index <= 0;
  const atEnd = count <= 0 || index >= count - 1;

  return (
    <div className="flex h-full min-h-[22rem] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <div className="flex items-center gap-1">
            {count > 0 ? (
              <span className="mr-0.5 text-xs font-medium tabular-nums text-slate-400">
                {index + 1} / {count}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onPrev}
              disabled={atStart || count <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:cursor-default disabled:opacity-40"
              aria-label="Previous"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={atEnd || count <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 disabled:cursor-default disabled:opacity-40"
              aria-label="Next"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {count === 0 && empty ? (
          empty
        ) : (
          <div
            className={`transition-opacity duration-200 ease-out ${fading ? 'opacity-0' : 'opacity-100'}`}
          >
            {children}
          </div>
        )}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

export function useDiscoveryCarousel(length: number) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const fadeRef = useRef<number | null>(null);

  useEffect(() => {
    setIndex((i) => (length <= 0 ? 0 : Math.min(i, length - 1)));
  }, [length]);

  useEffect(
    () => () => {
      if (fadeRef.current != null) window.clearTimeout(fadeRef.current);
    },
    [],
  );

  const go = (next: number) => {
    if (length <= 1) return;
    const clamped = Math.max(0, Math.min(length - 1, next));
    if (clamped === index) return;
    setFading(true);
    if (fadeRef.current != null) window.clearTimeout(fadeRef.current);
    fadeRef.current = window.setTimeout(() => {
      setIndex(clamped);
      setFading(false);
    }, 180);
  };

  return {
    index,
    fading,
    prev: () => go(index - 1),
    next: () => go(index + 1),
  };
}

export function DiscoveryCardSkeleton() {
  return (
    <div className="min-h-[22rem] animate-pulse rounded-2xl border border-slate-200 bg-white/60 p-5">
      <div className="mb-3 h-6 w-40 rounded bg-slate-200" />
      <div className="mb-3 h-48 w-full rounded-xl bg-slate-100" />
      <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
      <div className="h-3 w-1/2 rounded bg-slate-100" />
    </div>
  );
}
