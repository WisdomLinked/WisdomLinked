import type { LucideIcon } from 'lucide-react';
import { Check, FileText, GraduationCap, Target, X } from 'lucide-react';
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
  title: string;
  helperText: string;
  percent: number;
  sections: ProfileCompletionSectionView[];
  complete?: boolean;
  onSectionAction: (href: string) => void;
  onDismiss?: () => void;
};

const SECTION_ICONS: Record<string, LucideIcon> = {
  academic: GraduationCap,
  preferences: Target,
  resume: FileText,
};

const ACTION_BUTTON = `inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#234C6A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1b3c53] ${PROFILE_COMPLETION_FOCUS_RING}`;

export default function ProfileCompletionCard({
  headingId = 'profile-completion-heading',
  title,
  helperText,
  percent,
  sections,
  complete = false,
  onSectionAction,
  onDismiss,
}: Props) {
  return (
    <section aria-labelledby={headingId} className={PROFILE_COMPLETION_CARD_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-serif text-2xl font-medium leading-tight text-[#1A3A4A]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <p className="pt-0.5 text-3xl font-semibold tabular-nums text-[#234C6A]" aria-hidden>
            {percent}%
          </p>
          {complete && onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss profile completion card"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 ${PROFILE_COMPLETION_FOCUS_RING}`}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <SegmentedProgressBar
          label="Profile completion"
          segments={sections.map((section) => ({
            ratio: section.total ? section.filled / section.total : 0,
            weight: section.weight,
          }))}
          percentText={`${percent}%`}
          ariaValueNow={percent}
          ariaValueMax={100}
          ariaValueText={`${percent}% complete`}
        />
      </div>

      <ul className="mt-4 space-y-1">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.id] ?? Target;
          return (
            <li
              key={section.id}
              className={`rounded-xl px-3 py-3 sm:px-4 ${
                section.isComplete ? '' : 'sm:bg-transparent'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {section.isComplete ? (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Done:</span>
                    </span>
                  ) : (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[#234C6A]">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
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
                    <p className="mt-0.5 text-sm text-gray-500">{section.description}</p>
                  </div>
                </div>
                {section.isComplete ? null : (
                  <button
                    type="button"
                    onClick={() => onSectionAction(section.href)}
                    className={`ml-10 self-start sm:ml-0 sm:self-auto ${ACTION_BUTTON}`}
                  >
                    {section.actionLabel}
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-7 w-56 rounded bg-slate-200" />
          <div className="h-4 w-full max-w-md rounded bg-slate-100" />
        </div>
        <div className="h-9 w-14 rounded bg-slate-200" />
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
