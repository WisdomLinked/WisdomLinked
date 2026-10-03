import React, { useEffect, useRef } from 'react';
import type { TimelineStage } from '../../content/resourcesTimeline';
import { FOCUS_RING, MOTION } from './styles';

type Props = {
  label: string;
  stages: TimelineStage[];
  activeId: string;
  onSelect: (id: string) => void;
};

export default function TimelinePills({ label, stages, activeId, onSelect }: Props) {
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    const pill = list?.querySelector<HTMLElement>(`[data-stage="${activeId}"]`);
    if (!list || !pill || typeof list.scrollTo !== 'function') return;
    const left = pill.offsetLeft - list.offsetLeft - 16;
    list.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
  }, [activeId]);

  return (
    <nav aria-label={label} className="min-w-0">
      <ol ref={listRef} className="scrollbar-thin flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
        {stages.map((stage) => {
          const active = stage.id === activeId;
          return (
            <li key={stage.id} className="shrink-0">
              <a
                href={`#${stage.id}`}
                data-stage={stage.id}
                aria-current={active ? 'step' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(stage.id);
                }}
                className={`inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${MOTION} ${FOCUS_RING} ${
                  active
                    ? 'border-wl-brand bg-wl-brand text-white'
                    : 'border-res-line bg-white text-slate-700 hover:bg-res-tint hover:text-wl-brand'
                }`}
              >
                {stage.number}. {stage.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
