import React from 'react';
import { Link } from 'react-router-dom';
import type { ExpertPromoContent } from '../../content/resourcesTimeline';
import { BUTTON_ON_DARK } from './styles';

export default function ExpertPromo({ promo, href }: { promo: ExpertPromoContent; href: string }) {
  const card = (
    <aside className="relative overflow-hidden rounded-[14px] bg-wl-brand p-6 text-white sm:p-7" aria-label={promo.heading}>
      <span
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/5"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-[18rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-res-promo-label">{promo.label}</p>
          <h3 className="mt-2 font-display text-xl font-bold sm:text-2xl">{promo.heading}</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-res-promo-text">{promo.text}</p>
        </div>
        <Link to={href} className={`${BUTTON_ON_DARK} shrink-0`}>
          {promo.cta}
        </Link>
      </div>
    </aside>
  );
  if (!promo.disclaimer) return card;
  return (
    <div>
      {card}
      <p className="mt-2 text-xs italic text-slate-600">{promo.disclaimer}</p>
    </div>
  );
}
