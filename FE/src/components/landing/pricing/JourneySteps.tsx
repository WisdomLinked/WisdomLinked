import type { JourneyStep } from './pricingContent';

/** Tablet shows 3 per row, so the connector after the 3rd and 6th step is hidden there. */
const TABLET_COLUMNS = 3;

export default function JourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="grid grid-cols-1 gap-y-6 md:grid-cols-3 md:gap-y-10 lg:grid-cols-6">
      {steps.map(({ id, label, description, icon: Icon, highlight }, i) => {
        const last = i === steps.length - 1;
        const tabletRowEnd = (i + 1) % TABLET_COLUMNS === 0;
        return (
          <li key={id} className="group relative flex items-start gap-4 md:flex-col md:items-center md:gap-3 md:px-2 md:text-center">
            {!last ? (
              <span className="absolute -bottom-6 left-6 top-12 w-px bg-white/20 md:hidden" aria-hidden="true" />
            ) : null}
            {!last ? (
              <span
                className={`absolute left-[calc(50%+2rem)] top-6 hidden h-px w-[calc(100%-4rem)] bg-white/20 ${
                  tabletRowEnd ? 'md:hidden' : 'md:block'
                } lg:block`}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-shadow duration-200 group-hover:shadow-[0_6px_16px_rgba(0,0,0,0.25)] ${
                highlight ? 'bg-white text-[#234C6A]' : 'bg-white/10 text-white ring-1 ring-white/20'
              }`}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 pt-1 md:pt-0">
              <p className="text-sm font-semibold text-white md:text-base">{label}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
