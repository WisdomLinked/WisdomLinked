import { useEffect, useRef, useState } from 'react';
import { UserCheck } from 'lucide-react';
import {
  admitConfirmation,
  admitCountFromInput,
  type WaitlistSeminar,
} from '../../utils/seminarWaitlist';

export type WaitlistAdmitRequest = { count: number } | { all: true; expectedCount: number };
export type WaitlistAdmitOutcome = { message: string } | { error: string };

type AdmitHandler = (
  seminar: WaitlistSeminar,
  request: WaitlistAdmitRequest,
) => Promise<WaitlistAdmitOutcome>;

const formatWhen = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

function WaitlistSeminarCard({
  seminar,
  focused,
  onAdmit,
  onAdmitted,
  onRefused,
  onViewStudent,
}: {
  seminar: WaitlistSeminar;
  focused: boolean;
  onAdmit: AdmitHandler;
  onAdmitted: (message: string) => void;
  onRefused: (seminar: WaitlistSeminar, error: string) => void;
  onViewStudent?: (userId: string, name: string) => void;
}) {
  const waiting = seminar.students.length;
  const { maxAttendees, occupied } = seminar.seats;
  const [input, setInput] = useState('');
  const [confirming, setConfirming] = useState<WaitlistAdmitRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) cardRef.current?.scrollIntoView?.({ block: 'start' });
  }, [focused]);
  const numberLabel = `Number of students to admit to ${seminar.title}`;
  const confirmingCount = confirming
    ? 'all' in confirming
      ? waiting
      : confirming.count
    : 0;

  const askToAdmitNumber = () => {
    const count = admitCountFromInput(input, waiting);
    if (count == null) {
      setError('Enter how many students to admit.');
      return;
    }
    setError('');
    setConfirming({ count });
  };

  const admit = async () => {
    if (!confirming) return;
    setBusy(true);
    setError('');
    const outcome = await onAdmit(seminar, confirming);
    if ('error' in outcome) onRefused(seminar, outcome.error);
    setBusy(false);
    setConfirming(null);
    if ('error' in outcome) {
      setError(outcome.error);
      return;
    }
    setInput('');
    onAdmitted(outcome.message);
  };

  return (
    <section
      ref={cardRef}
      aria-label={`Waitlist for ${seminar.title}`}
      className={`scroll-mt-1 rounded-xl border bg-white p-4 ${
        focused ? 'border-[#234C6A] ring-1 ring-[#234C6A]' : 'border-slate-200'
      }`}
    >
      <h4 className="text-sm font-semibold text-slate-900">{seminar.title}</h4>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatWhen(seminar.start)}
        {seminar.recurring ? ' · Recurring' : ''}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {maxAttendees == null ? `Seats taken: ${occupied}` : `Seats taken: ${occupied} of ${maxAttendees}`}
        {` · ${waiting} waiting`}
      </p>

      <ol className="mt-3 space-y-1.5">
        {seminar.students.map((student, index) => (
          <li
            key={student.requestId}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <span className="w-5 shrink-0 text-xs font-semibold text-slate-500">{index + 1}.</span>
            {student.userId && onViewStudent ? (
              <button
                type="button"
                onClick={() => onViewStudent(student.userId, student.name)}
                className="min-w-0 break-all text-left font-medium text-[#234C6A] hover:underline"
              >
                {student.name}
              </button>
            ) : (
              <span className="min-w-0 break-all font-medium text-slate-800">{student.name}</span>
            )}
            {student.joinedAt ? (
              <span className="ml-auto text-xs text-slate-500">
                Joined {formatWhen(student.joinedAt)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {confirming ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{admitConfirmation(seminar.seats, confirmingCount)}</p>
          <p className="mt-1 text-xs">
            Students are emailed. On a paid seminar, the seat is held until they pay by the deadline.
            {seminar.recurring ? ' Max attendees also rises on future dates where needed.' : ''}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void admit()}
              className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {busy ? 'Admitting…' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={input}
            onChange={event => {
              setInput(event.target.value);
              setError('');
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') askToAdmitNumber();
            }}
            aria-label={numberLabel}
            placeholder="Number"
            className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-[#234C6A] focus:outline-none"
          />
          <button
            type="button"
            onClick={askToAdmitNumber}
            className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            Admit
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setConfirming({ all: true, expectedCount: waiting });
            }}
            className="rounded-lg border border-[#234C6A] bg-white px-3 py-1.5 text-xs font-semibold text-[#234C6A] hover:bg-slate-50"
          >
            All
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export default function SeminarWaitlistPanel({
  seminars,
  showEmptyMessage,
  focusSeminarId,
  onAdmit,
  onViewStudent,
}: {
  seminars: WaitlistSeminar[];
  showEmptyMessage: boolean;
  /** Brought into view when the panel opens, e.g. from a "joined the waitlist" banner. */
  focusSeminarId?: string | null;
  onAdmit: AdmitHandler;
  onViewStudent?: (userId: string, name: string) => void;
}) {
  const [notices, setNotices] = useState<string[]>([]);
  const [refusals, setRefusals] = useState<Record<string, string>>({});
  // A refusal can remove the seminar from the list, and its message would go with the card.
  const gone = Object.keys(refusals).filter(id => !seminars.some(s => s.seminarId === id));

  return (
    <>
      {notices.map(notice => (
        <div
          key={notice}
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
        >
          <UserCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{notice}</span>
        </div>
      ))}
      {gone.map(id => (
        <p
          key={id}
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
        >
          {refusals[id]}
        </p>
      ))}
      {seminars.length === 0 && showEmptyMessage ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
          No students are on a waitlist right now.
        </div>
      ) : null}
      {seminars.map(seminar => (
        <WaitlistSeminarCard
          key={seminar.seminarId}
          seminar={seminar}
          focused={seminar.seminarId === focusSeminarId}
          onAdmit={onAdmit}
          onAdmitted={message => {
            setNotices(prev => [message, ...prev.filter(item => item !== message)]);
            // An earlier refusal no longer applies, and must not reappear when the card leaves.
            setRefusals(({ [seminar.seminarId]: _settled, ...rest }) => rest);
          }}
          onRefused={(refused, error) =>
            setRefusals(prev => ({ ...prev, [refused.seminarId]: `“${refused.title}”: ${error}` }))
          }
          onViewStudent={onViewStudent}
        />
      ))}
    </>
  );
}
