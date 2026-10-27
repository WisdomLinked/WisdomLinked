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
  /** Shown when partially filled (e.g. "4 of 6 fields"). */
  progressBadge?: string;
  /** Quiet action on a finished row: "Edit" or "View". */
  reviewLabel?: string;
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

const PRIMARY_BUTTON = `inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-wl-brand px-4 text-sm font-medium text-white hover:bg-brand-800 ${PROFILE_COMPLETION_FOCUS_RING}`;
const QUIET_LINK = `shrink-0 text-sm font-medium text-wl-brand hover:underline ${PROFILE_COMPLETION_FOCUS_RING}`;

export default function ProfileCompletionCard({
  headingId = 'profile-completion-heading',
  eyebrow = 'Finish your student profile',
  title,
  helperText,
  percent,
  sections,
  onSectionAction,
}: Props) {
  const completedCount = sections.filter(section => section.isComplete).length;
  const ordered = [...sections].sort((a, b) => Number(a.isComplete) - Number(b.isComplete));
  const currentId = ordered.find(section => !section.isComplete)?.id;

  return (
    <section aria-labelledby={headingId} className={PROFILE_COMPLETION_CARD_CLASS}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
        ) : null}
        <h2
          id={headingId}
          className={`${eyebrow ? 'mt-1 ' : ''}font-serif text-2xl font-medium leading-tight text-wl-ink`}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{helperText}</p>
      </div>

      <div className="mt-5">
        <SegmentedProgressBar
          label="Profile completion"
          percent={percent}
          valueText={`${completedCount} of ${sections.length} sections complete`}
          percentText={`${percent}%`}
          ariaValueNow={percent}
          ariaValueMax={100}
          ariaValueText={`${percent}% complete. ${completedCount} of ${sections.length} sections complete`}
        />
      </div>

      <ul className="mt-4">
        {ordered.map((section, index) => {
          const current = section.id === currentId;
          const actionLabel = section.isComplete ? section.reviewLabel || 'Edit' : section.actionLabel;
          return (
            <li
              key={section.id}
              className={`px-3 py-3 ${current ? 'rounded-xl bg-brand-panel-strong' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={[
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      section.isComplete
                        ? 'bg-emerald-600 text-white'
                        : current
                          ? 'bg-wl-brand text-white'
                          : 'border border-slate-300 bg-white text-slate-500',
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
                      <h3 className="text-sm font-semibold text-slate-800">{section.label}</h3>
                      {section.isComplete ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Done
                        </span>
                      ) : section.progressBadge ? (
                        <span className="rounded-full bg-wl-brandSoft px-2 py-0.5 text-xs font-semibold text-wl-brand">
                          {section.progressBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
                  </div>
                </div>
                {actionLabel ? (
                  <button
                    type="button"
                    onClick={() => onSectionAction(section.href)}
                    className={`self-start sm:self-auto ${section.isComplete ? QUIET_LINK : PRIMARY_BUTTON}`}
                    aria-label={`${actionLabel}: ${section.label}`}
                  >
                    {actionLabel}
                    {section.isComplete ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
                  </button>
                ) : null}
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
