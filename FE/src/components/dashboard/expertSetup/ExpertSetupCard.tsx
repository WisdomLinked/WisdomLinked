import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ChevronDown } from 'lucide-react';
import { useAppSelector } from '../../../store';
import { doSetExpertBookingNoticeHours, doUpdateProfile } from '../../../api/api';
import { getRequiredContracts } from '../../../api/termsApi';
import TermsSignDialog from '../../terms/TermsSignDialog';
import { updateMe } from '../../../actions/authActions';
import { notify } from '../../../utils/notify';
import { detectUserTimeZone } from '../../../utils/schedulingTimezone';
import type { BookingNoticeHours, BufferMinutes } from '../../../types/scheduling';
import type { AppointmentDurationMinutes } from '../../../utils/appointmentDurations';
import { PROFILE_COMPLETION_CARD_CLASS } from '../profileCompletion/profileCompletionStyles';
import SetupProgressBar from './SetupProgressBar';
import SetupStepRow from './SetupStepRow';
import { BookingRulesStepControl, DurationStepControl, FOCUS_RING, RateStepControl } from './StepControls';
import {
  SETUP_STEPS,
  savedBuffer,
  savedDurations,
  savedNotice,
  savedRate,
  type ExpertAvailability,
  type SetupStepId,
} from './setupSteps';

const STEP_LIST_ID = 'expert-setup-steps';

/**
 * Guides a new expert through the availability settings students need before they can book.
 * Completion is read from the saved user record, so it renders nothing once every step is done.
 */
export default function ExpertSetupCard({ onOpenAvailability }: { onOpenAvailability: () => void }) {
  const dispatch = useDispatch();
  const userDetails = useAppSelector((s: any) => s.auth?.userDetails) as
    | (ExpertAvailability & { _id?: string; role?: string })
    | null
    | undefined;
  const [expandedStep, setExpandedStep] = useState<SetupStepId | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [roleTerms, setRoleTerms] = useState<'unknown' | 'signed' | 'unsigned'>('unknown');
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (!userDetails?._id || userDetails.role !== 'expert') return;
    let cancelled = false;
    getRequiredContracts()
      .then((contracts) => {
        if (cancelled) return;
        const unsigned = contracts.some((contract) => contract.audience === 'expert');
        setRoleTerms(unsigned ? 'unsigned' : 'signed');
      })
      .catch(() => {
        if (!cancelled) setRoleTerms('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [userDetails?._id, userDetails?.role, termsOpen]);

  if (!userDetails?._id || userDetails.role !== 'expert') return null;

  const availability: ExpertAvailability = userDetails;
  const status = SETUP_STEPS.map((step) => step.isComplete(availability));
  const includeTerms = roleTerms === 'signed' || roleTerms === 'unsigned';
  const termsDone = roleTerms === 'signed';
  const completed = status.filter(Boolean).length + (includeTerms && termsDone ? 1 : 0);
  const total = SETUP_STEPS.length + (includeTerms ? 1 : 0);
  if (completed === total) return null;
  const currentIndex = status.indexOf(false);

  const persist = async (save: () => Promise<boolean>) => {
    try {
      // API helpers show the error toast themselves and resolve false.
      if (!(await save())) return false;
      await (dispatch as any)(updateMe());
      setExpandedStep(null);
      return true;
    } catch {
      notify.error('Could not save. Please try again.');
      return false;
    }
  };

  const saveRate = (rate: number) =>
    persist(async () => (await doUpdateProfile({ price: rate, timeZone: detectUserTimeZone() })) === true);

  const saveDurations = (durations: AppointmentDurationMinutes[]) =>
    persist(async () => (await doUpdateProfile({ appointmentDurations: durations })) === true);

  const saveRules = (buffer: BufferMinutes, notice: BookingNoticeHours) =>
    persist(async () => {
      if (buffer !== savedBuffer(availability)) {
        if ((await doUpdateProfile({ bufferMinutes: buffer })) !== true) return false;
      }
      if (notice !== savedNotice(availability)) {
        const res = await doSetExpertBookingNoticeHours(notice);
        if (!res) return false;
      }
      return true;
    });

  // Incomplete steps start empty so the expert picks a value instead of accepting a default.
  const renderControl = (id: SetupStepId, done: boolean) => {
    switch (id) {
      case 'rate':
        return <RateStepControl initialRate={done ? savedRate(availability) : undefined} onSave={saveRate} />;
      case 'durations':
        return (
          <DurationStepControl
            initialDurations={done ? savedDurations(availability) : []}
            onSave={saveDurations}
          />
        );
      case 'bookingRules':
        return (
          <BookingRulesStepControl
            initialBuffer={done ? savedBuffer(availability) : null}
            initialNotice={done ? savedNotice(availability) : null}
            onSave={saveRules}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section
      aria-labelledby="expert-setup-heading"
      className={PROFILE_COMPLETION_CARD_CLASS}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Finish your expert profile
          </p>
          <h2 id="expert-setup-heading" className="mt-1 font-serif text-2xl font-medium leading-tight text-[#1A3A4A]">
            Set up your availability
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Students can&apos;t book you until these steps are done. It takes about 5 minutes.
          </p>
          <p className="mt-1 text-sm font-medium text-rose-600">
            Until your profile setup is complete, you won&apos;t be able to schedule 1:1 appointments or seminars.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          aria-expanded={listOpen}
          aria-controls={STEP_LIST_ID}
          aria-label={listOpen ? 'Hide setup steps' : 'Show setup steps'}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#234C6A] ${FOCUS_RING}`}
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${listOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>

      <div className="mt-5">
        <SetupProgressBar completed={completed} total={total} />
      </div>

      {listOpen ? (
        <ol id={STEP_LIST_ID} className="mt-4 space-y-1">
          {SETUP_STEPS.map((step, index) => {
            const done = status[index];
            return (
              <SetupStepRow
                key={step.id}
                step={step}
                index={index}
                done={done}
                summary={done ? step.getSummary(availability) : ''}
                current={index === currentIndex}
                expanded={expandedStep === step.id}
                onAction={() => {
                  if (step.mode === 'link') {
                    onOpenAvailability();
                    return;
                  }
                  setExpandedStep((open) => (open === step.id ? null : step.id));
                }}
              >
                {renderControl(step.id, done)}
              </SetupStepRow>
            );
          })}
          {includeTerms ? (
            <li className={`rounded-xl px-3 py-3 sm:px-4 ${!termsDone && currentIndex === -1 ? 'bg-[#e8f0f8]' : ''}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-800">Terms</h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {termsDone ? 'Current agreement signed' : 'Sign the current expert agreement.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#234C6A] px-4 text-sm font-medium text-white"
                >
                  {termsDone ? 'View agreement' : 'Sign agreement'}
                </button>
              </div>
            </li>
          ) : null}
        </ol>
      ) : null}
      <TermsSignDialog
        open={termsOpen}
        role="expert"
        onClose={() => setTermsOpen(false)}
        onSigned={() => setRoleTerms('signed')}
      />
    </section>
  );
}
