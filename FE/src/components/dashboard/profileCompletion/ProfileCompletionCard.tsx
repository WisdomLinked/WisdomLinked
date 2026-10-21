import { ArrowRight, Check } from 'lucide-react';
import SegmentedProgressBar from './SegmentedProgressBar';
import {
  PROFILE_COMPLETION_CARD_CLASS,
  PROFILE_COMPLETION_FOCUS_RING,
} from './profileCompletionStyles';

export type ProfileCompletionSectionView = {
  id: string;
  label: string;
  description: string;
  weight: number;
  filled: number;
  total: number;
  isComplete: boolean;
  href: string;
  actionLabel: string;
  /** Shown when partially filled (e.g. "3 of 6"). */
  progressBadge?: string;
};

type Props = {
  headingId?: string;
  /** Small uppercase label above the title (matches expert setup card). */
  eyebrow?: string;
  title: string;
  helperText: string;
  percent: number;
  sections: ProfileCompletionSectionView[];
  onSectionAction: (href: string) => void;
};

/** Match expert setup step buttons so both dashboards share the same CTA language. */
const PRIMARY_BUTTON = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#234C6A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1b3c53] ${PROFILE_COMPLETION_FOCUS_RING}`;
const SECONDARY_BUTTON = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#234C6A]/30 bg-white px-4 text-sm font-medium text-[#234C6A] transition-colors hover:bg-[#e8f0f8] ${PROFILE_COMPLETION_FOCUS_RING}`;

export default function ProfileCompletionCard({
  headingId = 'profile-completion-heading',
  eyebrow = 'Finish your student profile',
  title,
  helperText,
  percent,
  sections,
  onSectionAction,
}: Props) {
  const completedCount = sections.filter((section) => section.isComplete).length;
  const currentIndex = sections.findIndex((section) => !section.isComplete);

  return (
    <section aria-labelledby={headingId} className={PROFILE_COMPLETION_CARD_CLASS}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={headingId}
          className={`${eyebrow ? 'mt-1 ' : ''}font-serif text-2xl font-medium leading-tight text-[#1A3A4A]`}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      </div>

      <div className="mt-5">
        <SegmentedProgressBar
          label="Profile completion"
          segments={sections.map((section) => ({
            // Weighted flex so filled area tracks the single under-bar percent.
            ratio: section.total ? section.filled / section.total : 0,
            weight: section.weight,
          }))}
          valueText={`${completedCount} of ${sections.length} complete`}
          percentText={`${percent}%`}
          ariaValueNow={percent}
          ariaValueMax={100}
          ariaValueText={`${percent}% complete`}
        />
      </div>

      <ul className="mt-4 space-y-1">
        {sections.map((section, index) => {
          const current = index === currentIndex;
          const buttonClass = current ? PRIMARY_BUTTON : SECONDARY_BUTTON;
          return (
            <li
              key={section.id}
              className={`rounded-xl px-3 py-3 sm:px-4 ${current ? 'bg-[#e8f0f8]' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={[
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      section.isComplete
                        ? 'bg-emerald-600 text-white'
                        : current
                          ? 'bg-[#234C6A] text-white'
                          : 'border border-gray-300 bg-white text-gray-500',
                    ].join(' ')}
                  >
                    {section.isComplete ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Done:</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden>{index + 1}</span>
                        <span className="sr-only">Not done:</span>
                      </>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">{section.label}</h3>
                      {section.isComplete ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Done
                        </span>
                      ) : section.progressBadge ? (
                        <span className="rounded-full bg-[#E8EEF4] px-2 py-0.5 text-[11px] font-semibold text-[#234C6A]">
                          {section.progressBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-0.5 text-sm ${section.isComplete ? 'text-gray-700' : 'text-gray-500'}`}>
                      {section.description}
                    </p>
                  </div>
                </div>
                {section.isComplete ? null : (
                  <button
                    type="button"
                    onClick={() => onSectionAction(section.href)}
                    className={`ml-10 self-start sm:ml-0 sm:self-auto ${buttonClass}`}
                    aria-label={`${section.actionLabel}: ${section.label}`}
                  >
                    {section.actionLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProfileCompletionCardSkeleton() {
  return (
    <div
      className={`${PROFILE_COMPLETION_CARD_CLASS} animate-pulse`}
      aria-hidden
      data-testid="profile-completion-skeleton"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-40 rounded bg-slate-100" />
        <div className="h-7 w-56 rounded bg-slate-200" />
        <div className="h-4 w-full max-w-md rounded bg-slate-100" />
      </div>
      <div className="mt-5 h-1.5 rounded-full bg-slate-100" />
      <div className="mt-4 space-y-3">
        <div className="h-14 rounded-xl bg-slate-50" />
        <div className="h-14 rounded-xl bg-slate-50" />
        <div className="h-14 rounded-xl bg-slate-50" />
      </div>
    </div>
  );
}
