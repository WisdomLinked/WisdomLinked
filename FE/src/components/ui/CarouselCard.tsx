import React, { useEffect, useRef, useState } from 'react';
import Badge from './Badge';

type CarouselItem = {
  sectionTitle: string;
  title: string;
  description: string;
  tag?: string;
  metaLabel?: string;
  experience?: string;
  location?: string;
  cta: string;
  image?: string;
};

type CarouselCardProps = {
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  items: CarouselItem[];
};

export default function CarouselCard({ category, icon: Icon, items }: CarouselCardProps) {
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const fadeTimeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const item = items[index] || items[0];

  const safeLen = items?.length || 0;

  const goTo = (getNextIndex: (current: number, len: number) => number) => {
    if (safeLen <= 1) return;
    setIsFading(true);
    if (fadeTimeoutRef.current !== null) window.clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = window.setTimeout(() => {
      setIndex(i => getNextIndex(i, safeLen));
      setIsFading(false);
    }, 220);
  };

  const next = () => goTo((i, len) => (i + 1) % len);

  const prev = () => goTo((i, len) => (i - 1 + len) % len);

  useEffect(() => {
    if (safeLen <= 1) return undefined;
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      next();
    }, 5000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (fadeTimeoutRef.current !== null) window.clearTimeout(fadeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeLen]);

  return (
    <div className="flex min-h-[18rem] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`transition-opacity duration-500 ease-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {item.sectionTitle}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prev}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Previous item"
            >
              ❮
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Next item"
            >
              ❯
            </button>
          </div>
        </div>
        <div className="mb-4 aspect-video w-full overflow-hidden rounded-xl bg-slate-100">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Icon size={32} />
            </div>
          )}
        </div>
        <div className="mb-2 flex items-center justify-between">
          <Badge category={category}>{item.tag || category}</Badge>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8f0f8] text-[#234c6a]">
            <Icon size={18} aria-hidden="true" />
          </div>
        </div>
        <h4 className="mb-1 text-base font-semibold text-slate-900">
          {item.title}
        </h4>
        <p className="text-sm text-slate-500 leading-relaxed">
          {item.description}
        </p>
        {(item.experience || item.location) && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
            {item.experience && (
              <span className="mr-2">
                {item.metaLabel ? `${item.metaLabel}: ` : 'Experience: '}
                {item.experience}
              </span>
            )}
            {item.location && (
              <span className="ml-auto text-right">📍 {item.location}</span>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[#234c6a] px-3 py-1.5 text-[11px] font-semibold text-[#234c6a] transition-colors hover:bg-[#234c6a] hover:text-white"
      >
        {item.cta}
      </button>
    </div>
  );
}

