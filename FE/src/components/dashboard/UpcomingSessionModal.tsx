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
  sessions: sessionsProp,
  role = 'student',
}: {
  kind: SessionKind;
  status: SessionStatus;
  onClose: () => void;
  /** Student dashboard: navigate to generic join flow */
  onJoin?: () => void;
  /** Expert (or future): open a specific session (e.g. group chat) */
  onJoinSession?: (session: UpcomingModalSession) => void;
  /** When set (including `[]`), replaces demo data */
  sessions?: UpcomingModalSession[];
  role?: 'student' | 'expert';
}) {
  const baseNow = useMemo(() => Date.now(), []);

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const content = useMemo(() => {
    const expert = role === 'expert';
    if (kind === 'seminar') {
      return {
        title: status === 'pending' ? 'Pending seminar sessions' : 'Upcoming seminars',
        typeLabel: 'Seminar',
        description: expert
          ? status === 'pending'
            ? 'Seminar invites or drafts that are not confirmed yet.'
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

  const sessions = useMemo(() => {
    if (sessionsProp !== undefined) {
      return sessionsProp;
    }
    if (kind === 'seminar') {
      return [
        {
          id: 's1',
          title: 'AI for Healthcare seminar',
          at: baseNow + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
          when: 'Tue · 6:00 PM',
          location: 'Online · WisdomLinked Room A',
          with: 'Prof. Emily Chen',
        },
        {
          id: 's2',
          title: 'Research Methods seminar',
          at: baseNow + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
          when: 'Wed · 7:00 PM',
          location: 'Online · WisdomLinked Room B',
          with: 'Dr. Yuki Tanaka',
        },
        {
          id: 's3',
          title: 'Grad School Strategy seminar',
          at: baseNow + 5 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
          when: 'Fri · 5:30 PM',
          location: 'Online · WisdomLinked Room C',
          with: 'Prof. Daniel Ortiz',
        },
      ];
    }

    return [
      {
        id: 'o1',
        title: '1:1 appointment',
        at: baseNow + 4 * 60 * 60 * 1000,
        when: 'Today · 9:00 PM',
        location: 'Online · WisdomLinked Room 1',
        with: 'Dr. Emily Chen',
      },
      {
        id: 'o2',
        title: '1:1 appointment',
        at: baseNow + 26 * 60 * 60 * 1000,
        when: 'Tomorrow · 7:00 PM',
        location: 'Online · WisdomLinked Room 2',
        with: 'Prof. Daniel Ortiz',
      },
      {
        id: 'o3',
        title: '1:1 appointment',
        at: baseNow + 52 * 60 * 60 * 1000,
        when: 'Thu · 6:00 PM',
        location: 'Online · WisdomLinked Room 4',
        with: 'Dr. Yuki Tanaka',
      },
    ];
  }, [kind, baseNow, sessionsProp]);

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
                        Join meeting
                      </button>
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
    </div>
  );
}

