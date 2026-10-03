import React from 'react';
import { Link } from 'react-router-dom';
import type { GuidePreview } from '../../content/resourcesTimeline';
import { BUTTON_OUTLINE } from './styles';

export default function GuideCards({
  items,
  footnote,
  ctaHref,
  ctaLabel,
}: {
  items: GuidePreview[];
  footnote: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((guide) => (
          <li key={guide.title} className="min-w-0 rounded-xl border border-dashed border-res-dash p-[18px]">
            <span className="inline-flex items-center rounded-full bg-res-gold-soft px-2.5 py-0.5 text-[11px] font-semibold text-res-gold">
              Coming soon
            </span>
            <h3 className="mt-3 font-display text-lg font-bold text-slate-900">{guide.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{guide.description}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link to={ctaHref} className={BUTTON_OUTLINE}>
          {ctaLabel}
        </Link>
        <span className="min-w-0 text-sm text-slate-600">{footnote}</span>
      </div>
    </div>
  );
}
