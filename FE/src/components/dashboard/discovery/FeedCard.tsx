import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2';

export const FEED_CTA_PRIMARY = `inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-800 ${FOCUS_RING}`;

export const FEED_CTA_OUTLINE = `inline-flex h-10 w-full items-center justify-center rounded-lg border border-brand-200 bg-white px-4 text-sm font-medium text-brand-700 transition-colors hover:border-brand-outline-hover hover:bg-brand-25 ${FOCUS_RING}`;

const PAGER_BUTTON = `inline-flex h-7 w-7 items-center justify-center rounded-full border border-brand-pager-border bg-white text-brand-700 transition-colors hover:bg-brand-25 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white ${FOCUS_RING}`;

const MEDIA_BOX = 'relative h-32 w-full shrink-0 overflow-hidden rounded-xl sm:h-36 md:h-40';

type FeedCardProps = {
  title: string;
  /** Singular noun for pager labels, e.g. "seminar" → "Previous seminar". */
  itemNoun: string;
  count: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  fading?: boolean;
  /** Rendered instead of children when `count` is 0. */
  empty?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

/**
 * Shared shell for the student "What's New" cards. `h-full` + the `mt-auto`
 * footer keep cards equal height with CTAs on one baseline in a stretched grid row.
 */
export default function FeedCard({
  title,
  itemNoun,
  count,
  index,
  onPrev,
  onNext,
  fading = false,
  empty,
  footer,
  children,
}: FeedCardProps) {
  const showEmpty = count === 0 && empty != null;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-ring transition duration-200 hover:-translate-y-0.5 hover:shadow-brand-lift hover:ring-brand-ring-hover motion-reduce:transform-none motion-reduce:transition-none md:p-5">
      <header className="mb-3 flex h-7 items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-brand-900">{title}</h3>
        {count > 1 ? (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs tabular-nums text-brand-pager" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={onPrev}
              disabled={index <= 0}
              className={PAGER_BUTTON}
              aria-label={`Previous ${itemNoun}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={index >= count - 1}
              className={PAGER_BUTTON}
              aria-label={`Next ${itemNoun}`}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      {showEmpty ? (
        <div className="flex flex-1 flex-col">{empty}</div>
      ) : (
        <div
          className={`flex flex-1 flex-col transition-opacity duration-200 ease-out ${fading ? 'opacity-0' : 'opacity-100'}`}
        >
          {children}
        </div>
      )}

      {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
    </article>
  );
}

export function FeedMedia({
  children,
  badge,
  className = 'bg-brand-50',
}: {
  children: ReactNode;
  /** Overlaid top-left (see `FeedBadge`). */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${MEDIA_BOX} ${className}`}>
      {children}
      {badge ? <div className="absolute left-2 top-2">{badge}</div> : null}
    </div>
  );
}

export function initialsFor(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => part.match(/[A-Za-z0-9]/)?.[0] ?? '')
    .filter(Boolean);
  if (!letters.length) return '?';
  const last = letters.length > 1 ? letters[letters.length - 1] : '';
  return `${letters[0]}${last}`.toUpperCase();
}

/**
 * Person photo, or an initials fallback: `strong` is a deep navy gradient with a
 * large circle (New experts), `soft` a light gradient with a 56px white circle (Recommended).
 */
export function FeedPersonMedia({
  name,
  image,
  badge,
  fallback = 'strong',
}: {
  name: string;
  image?: string | null;
  badge?: ReactNode;
  fallback?: 'strong' | 'soft';
}) {
  const strong = fallback === 'strong';
  return (
    <FeedMedia
      badge={badge}
      className={strong ? 'bg-gradient-to-br from-brand-deep to-brand-sky' : 'bg-gradient-to-br from-brand-haze to-brand-25'}
    >
      {image ? (
        <img src={image} alt={name} className="h-full w-full object-cover object-center" />
      ) : (
        <div className="flex h-full w-full items-center justify-center" role="img" aria-label={name}>
          {strong ? (
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/15 text-2xl font-semibold text-white ring-1 ring-white/30">
              {initialsFor(name)}
            </span>
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-semibold text-brand-700 ring-4 ring-white/60">
              {initialsFor(name)}
            </span>
          )}
        </div>
      )}
    </FeedMedia>
  );
}

export function FeedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-900/90 px-2.5 py-0.5 text-xs font-medium text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function FeedTitle({ children }: { children: ReactNode }) {
  return <h4 className="mt-3 text-base font-semibold leading-snug text-brand-900 line-clamp-2">{children}</h4>;
}

export function FeedSubtitle({ children }: { children: ReactNode }) {
  return <p className="text-sm text-brand-500 line-clamp-1">{children}</p>;
}

export function FeedTags({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const extra = tags.length - max;
  const pill = 'inline-flex rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800';
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.slice(0, max).map((tag) => (
        <span key={tag} className={pill}>
          {tag}
        </span>
      ))}
      {extra > 0 ? <span className={pill}>+{extra}</span> : null}
    </div>
  );
}

export function DetailPanel({ children, emphasized = false }: { children: ReactNode; emphasized?: boolean }) {
  return (
    <div
      className={`mt-3 flex flex-col gap-1.5 rounded-lg border px-3 py-2 ${
        emphasized ? 'border-brand-150 bg-brand-panel-strong' : 'border-brand-75 bg-brand-50'
      }`}
    >
      {children}
    </div>
  );
}

/** Panel row. Pass `icon={null}` to indent text under the previous row's icon. */
export function DetailRow({
  icon: Icon,
  children,
  className = 'text-brand-400',
  iconClassName = 'text-brand-600',
}: {
  icon: LucideIcon | null;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <p className={`flex min-w-0 items-center gap-2 text-sm ${className}`}>
      {Icon ? (
        <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden="true" />
      ) : (
        <span className="w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * Empty state. Default fills the card body, centered; `compact` sits in a
 * media-sized box so the card keeps the same rhythm as its siblings.
 */
export function FeedEmpty({
  icon: Icon,
  title,
  helper,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  helper?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? `${MEDIA_BOX} flex flex-col items-center justify-center border border-brand-75 bg-brand-50 px-4 text-center`
          : 'flex flex-1 flex-col items-center justify-center py-6 text-center'
      }
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-base font-medium text-brand-900">{title}</p>
      {helper ? <p className="mt-1 max-w-[260px] text-sm text-brand-500">{helper}</p> : null}
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
    <div className="flex h-full animate-pulse flex-col rounded-2xl bg-white p-4 ring-1 ring-brand-ring md:p-5">
      <div className="mb-3 h-6 w-36 rounded bg-brand-100" />
      <div className="h-32 w-full rounded-xl bg-brand-50 sm:h-36 md:h-40" />
      <div className="mt-3 h-5 w-3/4 rounded bg-brand-100" />
      <div className="mt-2 h-4 w-1/2 rounded bg-brand-50" />
      <div className="mt-3 h-20 w-full rounded-lg bg-brand-50" />
      <div className="mt-auto h-10 w-full rounded-lg bg-brand-50" />
    </div>
  );
}
