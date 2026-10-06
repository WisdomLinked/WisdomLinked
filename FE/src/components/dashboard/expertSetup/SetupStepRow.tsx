import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { FOCUS_RING, PRIMARY_BUTTON } from './StepControls';
import type { SetupStep } from './setupSteps';

const SECONDARY_BUTTON = `inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#234C6A]/30 bg-white px-4 text-sm font-medium text-[#234C6A] transition-colors hover:bg-[#e8f0f8] ${FOCUS_RING}`;
const QUIET_BUTTON = `inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#234C6A] transition-colors hover:bg-[#e8f0f8] ${FOCUS_RING}`;

export default function SetupStepRow({
  step,
  index,
  done,
  summary,
  current,
  expanded,
  onAction,
  children,
}: {
  step: SetupStep;
  index: number;
  done: boolean;
  summary: string;
  /** First incomplete step: highlighted with the primary button. */
  current: boolean;
  expanded: boolean;
  onAction: () => void;
  /** Inline control, rendered when expanded. */
  children?: ReactNode;
}) {
  const panelId = `setup-step-${step.id}-panel`;
  const isLink = step.mode === 'link';
  const label = isLink ? (done ? 'Edit' : 'Go to Availability') : expanded ? 'Cancel' : done ? 'Edit' : 'Set up';
  const buttonClass = expanded
    ? SECONDARY_BUTTON
    : done
      ? QUIET_BUTTON
      : current
        ? PRIMARY_BUTTON
        : SECONDARY_BUTTON;

  return (
    <li className={`rounded-xl px-3 py-3 sm:px-4 ${current ? 'bg-[#e8f0f8]' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={[
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              done
                ? 'bg-emerald-600 text-white'
                : current
                  ? 'bg-[#234C6A] text-white'
                  : 'border border-gray-300 bg-white text-gray-500',
            ].join(' ')}
          >
            {done ? (
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
            <h3 className="text-sm font-semibold text-gray-800">{step.title}</h3>
            <p className={`mt-0.5 text-sm ${done ? 'text-gray-700' : 'text-gray-500'}`}>
              {done ? summary : step.description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAction}
          className={`ml-10 self-start sm:ml-0 sm:self-auto ${buttonClass}`}
          {...(isLink ? {} : { 'aria-expanded': expanded, 'aria-controls': panelId })}
          aria-label={`${label}: ${step.title}`}
        >
          {label}
          {isLink && !done ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </button>
      </div>
      {!isLink && expanded ? (
        <div id={panelId} className="mt-4 border-t border-gray-200 pt-4 sm:ml-10">
          {children}
        </div>
      ) : null}
    </li>
  );
}
