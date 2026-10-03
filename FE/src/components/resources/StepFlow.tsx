import React from 'react';
import type { RichText as RichTextParts, Step } from '../../content/resourcesTimeline';
import RichText from './RichText';

export default function StepFlow({ items, note }: { items: Step[]; note?: RichTextParts }) {
  const inset = `${50 / items.length}%`;
  return (
    <div>
      <ol
        className="relative flex flex-col gap-5 min-[760px]:grid min-[760px]:gap-3"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        <span className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-res-line min-[760px]:hidden" aria-hidden />
        <span
          className="absolute top-[15px] hidden h-0.5 bg-res-line min-[760px]:block"
          style={{ left: inset, right: inset }}
          aria-hidden
        />
        {items.map((step, i) => (
          <li
            key={step.title}
            className="relative flex gap-3 min-[760px]:flex-col min-[760px]:items-center min-[760px]:gap-2 min-[760px]:text-center"
          >
            <span
              className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-wl-brand bg-white text-sm font-semibold text-wl-brand"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1 min-[760px]:pt-0">
              <p className="text-sm font-bold text-slate-900">{step.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-slate-600">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {note ? (
        <p className="mt-5 text-xs text-slate-500">
          <RichText parts={note} />
        </p>
      ) : null}
    </div>
  );
}
