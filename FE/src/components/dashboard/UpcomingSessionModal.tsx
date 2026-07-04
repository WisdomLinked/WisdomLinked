import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, BookOpen, UserCheck } from 'lucide-react';

type SessionKind = 'seminar' | 'oneToOne';
type SessionStatus = 'booked' | 'pending';

/** Real or mock row for the modal list */
export type UpcomingModalSession = {
  id: string;
  title: string;
  at: number;
  when: string;
  location?: string;
  with?: string;
  /** Pending 1:1 the student must pay to confirm (expert-proposed). */
  payable?: boolean;
  price?: number;
  peerUserId?: string;
  /** Optional student context (academic background + purpose/note) shown to experts. */
  studentBrief?: Array<{ label: string; value: string }>;
  /** Set for overflow seminar seat requests the expert can approve/decline. */
  seatRequestId?: string;
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
  /** Expert approves an overflow seminar seat request. */
  onAcceptSeatRequest?: (session: UpcomingModalSession) => void | Promise<void>;
  /** Expert declines an overflow seminar seat request. */
  onDeclineSeatRequest?: (session: UpcomingModalSession) => void | Promise<void>;
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

  const decideSeatRequest = async (
    session: UpcomingModalSession,
    action: 'accept' | 'decline',
  ) => {
    const handler = action === 'accept' ? onAcceptSeatRequest : onDeclineSeatRequest;
    if (!handler) return;
    setSeatBusyId(session.id);
    try {
      await handler(session);
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
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
                No sessions in this view for the selected time range.
              </div>
            ) : null}
            {sessions.map(session => (
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
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {session.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{session.with}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        <span>{session.when}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        <span>{session.location}</span>
                      </p>
                      {(session.metaLines || []).map(line => (
                        <p key={line} className="text-slate-500">{line}</p>
                      ))}
                    </div>
                    {session.studentBrief && session.studentBrief.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setBriefSession(session)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#234C6A]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#234C6A] hover:bg-[#234C6A]/5"
                      >
                        <UserCheck className="h-3.5 w-3.5" aria-hidden />
                        Student background
                      </button>
                    ) : null}
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
                    ) : (
                      <span className="mt-2 inline-flex rounded-lg border border-[#234C6A]/30 px-2 py-1 text-[10px] font-semibold text-[#234C6A]">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Student background
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">
                  {briefSession.with || briefSession.title}
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
            <dl className="space-y-2 px-5 py-4">
              {(briefSession.studentBrief || []).map(row => (
                <div key={row.label} className="flex justify-between gap-4 text-sm">
                  <dt className="shrink-0 text-slate-500">{row.label}</dt>
                  <dd className="text-right font-medium text-slate-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

