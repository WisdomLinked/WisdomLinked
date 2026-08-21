import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, MapPin, BookOpen, UserCheck } from 'lucide-react';
import SeminarDetails from '../../pages/Dashboard/seminarDetails';
import { formatSessionDuration } from '../../utils/sessionDuration';
import DecisionNoteField from './DecisionNoteField';

type SessionKind = 'seminar' | 'oneToOne';
type SessionStatus = 'booked' | 'pending';

/** Real or mock row for the modal list */
export type UpcomingModalSession = {
  id: string;
  title: string;
  at: number;
  when: string;
  durationMinutes?: number;
  location?: string;
  with?: string;
  /** Pending 1:1 the student must pay to confirm (expert-proposed). */
  payable?: boolean;
  price?: number;
  /** How this booking must be paid — 'wallet' bookings cannot settle by card. */
  paymentMode?: string;
  peerUserId?: string;
  /** Optional per-session detail rows shown behind a button (expert: student
   * background; student: their own booking details). */
  studentBrief?: Array<{ label: string; value: string }>;
  /** Button + popup heading for studentBrief. Defaults to "Student background". */
  briefLabel?: string;
  /** Full session detail (calendar-style) rendered behind the details button.
   * Takes precedence over studentBrief when present. */
  detail?: {
    title: string;
    description?: string;
    start?: string;
    end?: string;
    duration?: number;
    price?: number;
    admin: any;
    participants: any[];
    keywords?: any[];
    services?: any[];
    purposeOther?: string;
    type?: string;
    isRecurring?: boolean;
    recurrenceFrequency?: string;
  };
  /** Set for overflow seminar seat requests the expert can approve/decline. */
  seatRequestId?: string;
  /** Pending student-initiated 1:1 the expert can accept directly. */
  canAccept?: boolean;
  /** Pending expert-proposed 1:1 the expert can withdraw while it is unpaid. */
  canWithdraw?: boolean;
  /** Extra small lines under the date (e.g. "$20.00 held", "Decide by …"). */
  metaLines?: string[];
};

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / (60 * 60)) % 24;
  const days = Math.floor(totalSeconds / (60 * 60 * 24));

  return days > 0
    ? `${days}d ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
    : `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export default function UpcomingSessionModal({
  kind,
  status,
  onClose,
  onJoin,
  onJoinSession,
  onPay,
  onAcceptSeatRequest,
  onDeclineSeatRequest,
  onAcceptSession,
  onDeclineSession,
  onWithdrawSession,
  onViewProfile,
  sessions,
  role = 'student',
}: {
  kind: SessionKind;
  status: SessionStatus;
  onClose: () => void;
  /** Student dashboard: navigate to generic join flow */
  onJoin?: () => void;
  /** Expert (or future): open a specific session (e.g. group chat) */
  onJoinSession?: (session: UpcomingModalSession) => void;
  /** Student pays to confirm an expert-proposed pending 1:1. */
  onPay?: (session: UpcomingModalSession) => void;
  /** Open the peer's full profile card (needs session.peerUserId). */
  onViewProfile?: (session: UpcomingModalSession) => void;
  /** Expert approves an overflow seminar seat request. Resolving a string shows
   * it as a transient in-card confirmation. */
  onAcceptSeatRequest?: (session: UpcomingModalSession, note: string) => void | Promise<void | string>;
  /** Expert declines an overflow seminar seat request. Resolving a string shows
   * it as a transient in-card confirmation. */
  onDeclineSeatRequest?: (session: UpcomingModalSession, note: string) => void | Promise<void | string>;
  /** Expert accepts a pending student-initiated 1:1 request. Resolving `true`
   * shows a transient in-card confirmation before the row clears. */
  onAcceptSession?: (session: UpcomingModalSession, note: string) => void | Promise<void | boolean>;
  /** Expert declines a pending student-initiated 1:1, refunding the student. */
  onDeclineSession?: (session: UpcomingModalSession, note: string) => void | Promise<void | boolean>;
  /** Expert withdraws their own unpaid 1:1 offer. Resolving `false` leaves the row. */
  onWithdrawSession?: (session: UpcomingModalSession, note: string) => void | Promise<void | boolean>;
  sessions: UpcomingModalSession[];
  role?: 'student' | 'expert';
}) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const [briefSession, setBriefSession] = useState<UpcomingModalSession | null>(null);
  const [seatBusyId, setSeatBusyId] = useState<string | null>(null);
  const [acceptBusyId, setAcceptBusyId] = useState<string | null>(null);
  const [withdrawBusyId, setWithdrawBusyId] = useState<string | null>(null);
  const [withdrawConfirmId, setWithdrawConfirmId] = useState<string | null>(null);
  const [declineBusyId, setDeclineBusyId] = useState<string | null>(null);
  const [declineConfirmId, setDeclineConfirmId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const noteFor = (id: string) => notes[id] ?? '';
  const setNoteFor = (id: string, next: string) => {
    setNotes(prev => ({ ...prev, [id]: next }));
    if (next.trim()) setNoteErrors(prev => ({ ...prev, [id]: '' }));
  };
  const requireNote = (id: string) => {
    if (noteFor(id).trim()) return true;
    setNoteErrors(prev => ({
      ...prev,
      [id]: 'Please add a short note so the student knows what to do next.',
    }));
    return false;
  };
  const [acceptedNotices, setAcceptedNotices] = useState<
    Record<string, { message: string; session: UpcomingModalSession }>
  >({});
  const noticeTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      noticeTimers.current.forEach(id => window.clearTimeout(id));
    },
    [],
  );

  // Show a confirmation in place of the row for a few seconds, then clear it.
  const flashNotice = (session: UpcomingModalSession, message: string) => {
    setAcceptedNotices(prev => ({ ...prev, [session.id]: { message, session } }));
    const timer = window.setTimeout(() => {
      setAcceptedNotices(prev => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
    }, 7000);
    noticeTimers.current.push(timer);
  };

  const acceptSession = async (session: UpcomingModalSession) => {
    if (!onAcceptSession) return;
    setAcceptBusyId(session.id);
    try {
      const ok = await onAcceptSession(session, noteFor(session.id).trim());
      if (ok === false) return;
      flashNotice(
        session,
        `${session.with || 'The student'} has been accepted for the 1:1 session${
          session.title ? ` “${session.title}”` : ''
        }.`,
      );
    } finally {
      setAcceptBusyId(null);
    }
  };

  const withdrawSession = async (session: UpcomingModalSession) => {
    if (!onWithdrawSession) return;
    setWithdrawBusyId(session.id);
    try {
      const ok = await onWithdrawSession(session, noteFor(session.id).trim());
      if (ok === false) return;
      setWithdrawConfirmId(null);
      flashNotice(
        session,
        `Your session offer${session.title ? ` “${session.title}”` : ''} has been withdrawn. ${
          session.with || 'The student'
        } was not charged.`,
      );
    } finally {
      setWithdrawBusyId(null);
    }
  };

  const declineSession = async (session: UpcomingModalSession) => {
    if (!onDeclineSession) return;
    if (!requireNote(session.id)) return;
    setDeclineBusyId(session.id);
    try {
      const ok = await onDeclineSession(session, noteFor(session.id).trim());
      if (ok === false) return;
      setDeclineConfirmId(null);
      flashNotice(
        session,
        `${session.with || 'The student'}'s request${
          session.title ? ` for “${session.title}”` : ''
        } was declined and their payment authorization released. They were not charged.`,
      );
    } finally {
      setDeclineBusyId(null);
    }
  };

  const decideSeatRequest = async (
    session: UpcomingModalSession,
    action: 'accept' | 'decline',
  ) => {
    const handler = action === 'accept' ? onAcceptSeatRequest : onDeclineSeatRequest;
    if (!handler) return;
    if (action === 'decline' && !requireNote(session.id)) return;
    setSeatBusyId(session.id);
    try {
      const result = await handler(session, noteFor(session.id).trim());
      if (typeof result === 'string' && result) flashNotice(session, result);
    } finally {
      setSeatBusyId(null);
    }
  };

  const content = useMemo(() => {
    const expert = role === 'expert';
    if (kind === 'seminar') {
      return {
        title: status === 'pending' ? 'Pending seminar seat requests' : 'Upcoming seminars',
        typeLabel: 'Seminar',
        description: expert
          ? status === 'pending'
            ? 'Students who registered past the seminar capacity. Accept to admit them (charging any held payment); decline to release the hold.'
            : 'Seminars you are hosting — join to open the meeting room in chat.'
          : status === 'pending'
            ? 'These seminar requests are waiting for mentor approval.'
            : 'These are your upcoming booked seminar sessions.',
        icon: <BookOpen className="h-4 w-4" aria-hidden />,
      };
    }
    return {
      title: status === 'pending' ? 'Pending individual sessions' : 'Upcoming 1:1 sessions',
      typeLabel: '1-1 session',
      description: expert
        ? status === 'pending'
          ? '1:1 requests waiting for you or the student to confirm.'
          : 'Confirmed 1:1 sessions — join opens the session in chat.'
        : status === 'pending'
          ? 'These 1:1 requests are waiting for mentor approval.'
          : 'These are your upcoming booked 1:1 sessions.',
      icon: <UserCheck className="h-4 w-4" aria-hidden />,
    };
  }, [kind, status, role]);

  const showJoin = status === 'booked';

  // Keep just-accepted rows on screen for the notice window even after the
  // parent drops them from `sessions` (its list refreshes on accept).
  const displaySessions = useMemo(() => {
    const present = new Set(sessions.map(s => s.id));
    const lingering = Object.values(acceptedNotices)
      .filter(n => !present.has(n.session.id))
      .map(n => n.session);
    return [...sessions, ...lingering];
  }, [sessions, acceptedNotices]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {content.typeLabel}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 truncate">
              {content.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">{content.description}</p>

          <div className="max-h-[52vh] overflow-y-auto space-y-3 pr-1">
            {displaySessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
                No sessions in this view for the selected time range.
              </div>
            ) : null}
            {displaySessions.map(session => {
              const notice = acceptedNotices[session.id];
              if (notice) {
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
                  >
                    <UserCheck className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{notice.message}</span>
                  </div>
                );
              }
              return (
              <div key={session.id} className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                          kind === 'seminar'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-blue-50 text-[#234C6A]'
                        }`}
                      >
                        {content.icon}
                      </span>
                      <div className="min-w-0">
                        {session.detail ||
                        (session.studentBrief && session.studentBrief.length > 0) ? (
                          <button
                            type="button"
                            onClick={() => setBriefSession(session)}
                            className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:underline"
                            title={session.detail ? 'View session details' : 'View details'}
                          >
                            {session.title}
                          </button>
                        ) : (
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {session.title}
                          </p>
                        )}
                        {session.with && onViewProfile && session.peerUserId ? (
                          <button
                            type="button"
                            onClick={() => onViewProfile(session)}
                            className="max-w-full truncate text-left text-[11px] font-medium text-[#234C6A] hover:underline"
                            title={role === 'expert' ? 'View student card' : 'View profile'}
                          >
                            {session.with}
                          </button>
                        ) : (
                          <p className="text-[11px] text-slate-500 truncate">{session.with}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        <span>{session.when}</span>
                      </p>
                      {formatSessionDuration(session.durationMinutes) ? (
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          <span>{formatSessionDuration(session.durationMinutes)}</span>
                        </p>
                      ) : null}
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        <span>{session.location}</span>
                      </p>
                      {(session.metaLines || []).map(line => (
                        <p key={line} className="text-slate-500">{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Starts in
                    </p>
                    <div className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-[#234C6A]">
                      {formatDuration(session.at - tick)}
                    </div>
                    {showJoin ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (onJoinSession) onJoinSession(session);
                          else onJoin?.();
                        }}
                        className="mt-2 rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
                      >
                        {kind === 'seminar' ? 'Join seminar chat' : 'Join chat'}
                      </button>
                    ) : session.payable && onPay ? (
                      <button
                        type="button"
                        onClick={() => onPay(session)}
                        className="mt-2 rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
                      >
                        {typeof session.price === 'number' ? `Pay $${session.price}` : 'Pay'}
                      </button>
                    ) : session.seatRequestId && (onAcceptSeatRequest || onDeclineSeatRequest) ? (
                      <div className="mt-2 flex flex-col items-stretch gap-1.5">
                        <button
                          type="button"
                          disabled={seatBusyId === session.id}
                          onClick={() => decideSeatRequest(session, 'accept')}
                          className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                        >
                          {seatBusyId === session.id ? '…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          disabled={seatBusyId === session.id}
                          onClick={() => decideSeatRequest(session, 'decline')}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {seatBusyId === session.id ? '…' : 'Decline'}
                        </button>
                      </div>
                    ) : session.canAccept && onAcceptSession ? (
                      declineConfirmId === session.id ? (
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={declineBusyId === session.id}
                            onClick={() => setDeclineConfirmId(null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={declineBusyId === session.id}
                            onClick={() => declineSession(session)}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                          >
                            {declineBusyId === session.id ? 'Declining…' : 'Release & decline'}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={acceptBusyId === session.id}
                            onClick={() => acceptSession(session)}
                            className="rounded-lg bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                          >
                            {acceptBusyId === session.id ? 'Accepting…' : 'Accept'}
                          </button>
                          {onDeclineSession ? (
                            <button
                              type="button"
                              disabled={acceptBusyId === session.id}
                              onClick={() => setDeclineConfirmId(session.id)}
                              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Decline
                            </button>
                          ) : null}
                        </div>
                      )
                    ) : session.canWithdraw && onWithdrawSession ? (
                      withdrawConfirmId === session.id ? (
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={withdrawBusyId === session.id}
                            onClick={() => setWithdrawConfirmId(null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={withdrawBusyId === session.id}
                            onClick={() => withdrawSession(session)}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                          >
                            {withdrawBusyId === session.id ? 'Withdrawing…' : 'Confirm'}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Awaiting payment
                          </span>
                          <button
                            type="button"
                            onClick={() => setWithdrawConfirmId(session.id)}
                            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Withdraw offer
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="mt-2 inline-flex rounded-lg border border-[#234C6A]/30 px-2 py-1 text-[10px] font-semibold text-[#234C6A]">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                {(() => {
                  const seatDecision =
                    !showJoin &&
                    !!session.seatRequestId &&
                    !!(onAcceptSeatRequest || onDeclineSeatRequest);
                  const oneToOneDecision =
                    !showJoin && !!session.canAccept && !!onAcceptSession;
                  const withdrawing =
                    !showJoin &&
                    !!session.canWithdraw &&
                    !!onWithdrawSession &&
                    withdrawConfirmId === session.id;
                  if (!seatDecision && !oneToOneDecision && !withdrawing) return null;
                  const noteRequired =
                    (oneToOneDecision && declineConfirmId === session.id) || seatDecision;
                  const busy =
                    seatBusyId === session.id ||
                    acceptBusyId === session.id ||
                    declineBusyId === session.id ||
                    withdrawBusyId === session.id;
                  return (
                    <div className="mt-3 border-t border-slate-100 pt-2.5">
                      <DecisionNoteField
                        id={`decision-note-${session.id}`}
                        value={noteFor(session.id)}
                        onChange={next => setNoteFor(session.id, next)}
                        required={noteRequired}
                        disabled={busy}
                        label={
                          noteRequired
                            ? 'Note to the student (required to decline)'
                            : 'Note to the student (optional)'
                        }
                      />
                      {noteErrors[session.id] ? (
                        <p className="mt-1 text-[10px] font-semibold text-rose-600">
                          {noteErrors[session.id]}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${
                showJoin ? '' : 'border-[#234C6A] text-[#234C6A]'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {briefSession ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setBriefSession(null);
          }}
        >
          <div
            className={`w-full ${
              briefSession.detail ? 'max-w-[460px]' : 'max-w-sm'
            } max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {briefSession.briefLabel ||
                    (briefSession.detail ? 'Session details' : 'Student background')}
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">
                  {briefSession.detail
                    ? briefSession.title
                    : briefSession.with || briefSession.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBriefSession(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {briefSession.detail ? (
              <div className="px-5 py-4">
                <SeminarDetails
                  {...briefSession.detail}
                  theme="light"
                  hideParticipants={role === 'student'}
                />
              </div>
            ) : (
              <dl className="space-y-2 px-5 py-4">
                {(briefSession.studentBrief || []).map(row => (
                  <div key={row.label} className="flex justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-slate-500">{row.label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-slate-800">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

