import type { Ref } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { homePage } from '../../../content/publicPages';
import JourneySteps from './JourneySteps';
import PricingCard, { CARD_BODY_TEXT } from './PricingCard';
import RateOption from './RateOption';
import RatingsSummary from './RatingsSummary';
import {
  GRATUITY_CARD,
  GUARANTEES,
  JOURNEY_CARD,
  PRICING_EYEBROW,
  PRICING_TRUST_LINE,
  RATES_CARD,
  RATINGS_CARD,
  RESCHEDULING_CARD,
} from './pricingContent';

type Props = {
  sectionRef?: Ref<HTMLDivElement>;
  onBrowseExperts: () => void;
};

export default function PricingSection({ sectionRef, onBrowseExperts }: Props) {
  return (
    <section
      ref={sectionRef}
      className="relative scroll-mt-20 overflow-hidden py-20 md:py-24"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-3xl">
          <p className="section-label mb-4 tracking-widest text-[#234C6A]">{PRICING_EYEBROW}</p>
          <h2 className="mb-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl md:text-5xl">
            {homePage.pricing.titleLead}{' '}
            <span className="whitespace-nowrap">{homePage.pricing.titleNoWrap}</span>
          </h2>
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg">{homePage.pricing.snippet}</p>
          <p className="mt-5 flex items-center gap-2.5 text-[15px] font-medium text-slate-700 md:text-base">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#234C6A] text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
            {PRICING_TRUST_LINE}
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <PricingCard title={RATES_CARD.title} badge={RATES_CARD.badge} className="md:col-span-2">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center lg:gap-8">
              <div className="flex flex-col gap-3">
                <p className={CARD_BODY_TEXT}>
                  {RATES_CARD.body} {RATES_CARD.footer}
                </p>
                <button
                  type="button"
                  onClick={onBrowseExperts}
                  className="group inline-flex items-center gap-1.5 self-start rounded text-[15px] font-semibold text-[#234C6A] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40 md:text-base"
                >
                  {RATES_CARD.footerLink}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {RATES_CARD.options.map(({ id, ...option }) => (
                  <RateOption key={id} {...option} />
                ))}
              </div>
            </div>
          </PricingCard>

          <article className="rounded-2xl bg-[#234C6A] p-6 text-white transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(35,76,106,0.10)] md:col-span-2 md:p-10">
            <header className="mb-8 text-center md:mb-10">
              <p className="section-label tracking-widest text-white/70">{JOURNEY_CARD.eyebrow}</p>
              <h3 className="mt-2 font-display text-xl font-bold md:text-2xl">{JOURNEY_CARD.title}</h3>
              <p className="mt-2 text-[15px] text-white/75 md:text-base">{JOURNEY_CARD.subtext}</p>
            </header>
            <JourneySteps steps={JOURNEY_CARD.steps} />
            <p className="mt-8 border-t border-white/15 pt-6 text-center text-sm text-white/80">{JOURNEY_CARD.note}</p>
          </article>

          {[RESCHEDULING_CARD, GRATUITY_CARD].map((card) => (
            <PricingCard key={card.title} title={card.title} badge={card.badge} compact>
              <p className={CARD_BODY_TEXT}>{card.body}</p>
              {card.comingSoon ? <p className="mt-auto pt-3 text-sm italic text-slate-400">Coming soon</p> : null}
            </PricingCard>
          ))}

          <PricingCard title={RATINGS_CARD.title} badge={RATINGS_CARD.badge} compact className="md:col-span-2">
            <div className="grid gap-5 md:grid-cols-2 md:items-center md:gap-8">
              <p className={CARD_BODY_TEXT}>{RATINGS_CARD.body}</p>
              <RatingsSummary rows={RATINGS_CARD.rows} />
            </div>
          </PricingCard>        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {GUARANTEES.map(({ icon: Icon, iconClass, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
