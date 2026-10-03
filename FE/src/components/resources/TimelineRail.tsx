import React, { useLayoutEffect, useRef, useState } from 'react';
import type { TimelineStage } from '../../content/resourcesTimeline';
import { EYEBROW, FOCUS_RING, MOTION } from './styles';

type Props = {
  label: string;
  stages: TimelineStage[];
  activeId: string;
  onSelect: (id: string) => void;
};

export default function TimelineRail({ label, stages, activeId, onSelect }: Props) {
  const activeIndex = Math.max(0, stages.findIndex((s) => s.id === activeId));
  const wrapper = useRef<HTMLDivElement | null>(null);
  const circles = useRef<(HTMLSpanElement | null)[]>([]);
  const [track, setTrack] = useState({ top: 0, height: 0, fill: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const box = wrapper.current?.getBoundingClientRect();
      const centre = (el: HTMLSpanElement | null | undefined) => {
        if (!el || !box) return null;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 - box.top;
      };
      const top = centre(circles.current[0]);
      const bottom = centre(circles.current[stages.length - 1]);
      const active = centre(circles.current[activeIndex]);
      if (top == null || bottom == null || active == null) return;
      setTrack({ top, height: bottom - top, fill: active - top });
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer && wrapper.current) observer.observe(wrapper.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [activeIndex, stages.length]);

  return (
    <nav aria-label={label} className="sticky top-28">
      <p className={EYEBROW}>{label}</p>
      <div ref={wrapper} className="relative mt-4">
        <span
          className="absolute left-[11px] w-0.5 bg-res-line"
          style={{ top: track.top, height: track.height }}
          aria-hidden
        />
        <span
          className="absolute left-[11px] w-0.5 bg-wl-brand transition-[height] duration-300 motion-reduce:transition-none"
          style={{ top: track.top, height: track.fill }}
          aria-hidden
        />
        <ol className="relative">
          {stages.map((stage, i) => {
            const state = i === activeIndex ? 'active' : i < activeIndex ? 'done' : 'todo';
            return (
              <li key={stage.id} className={i < stages.length - 1 ? 'pb-5' : ''}>
                <a
                  href={`#${stage.id}`}
                  aria-current={state === 'active' ? 'step' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(stage.id);
                  }}
                  className={`group relative flex gap-3 rounded-lg ${FOCUS_RING}`}
                >
                  <span
                    ref={(el) => {
                      circles.current[i] = el;
                    }}
                    className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors ${MOTION} ${
                      state === 'active'
                        ? 'border-wl-brand bg-wl-brand text-white'
                        : state === 'done'
                          ? 'border-wl-brand bg-white text-wl-brand'
                          : 'border-slate-300 bg-white text-slate-400'
                    }`}
                    aria-hidden
                  >
                    {stage.number}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span
                      className={`block text-sm leading-snug transition-colors ${MOTION} group-hover:text-wl-brand ${
                        state === 'active'
                          ? 'font-bold text-slate-900'
                          : state === 'done'
                            ? 'font-medium text-slate-700'
                            : 'font-medium text-slate-500'
                      }`}
                    >
                      {stage.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">{stage.timeRange}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
