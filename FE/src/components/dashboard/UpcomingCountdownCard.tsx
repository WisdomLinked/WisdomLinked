import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, UserCheck } from 'lucide-react';
import { formatSessionDuration } from '../../utils/sessionDuration';

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

export type UpcomingSession = {
  title: string;
  startAt: number; // epoch ms
  durationMinutes?: number;
  id?: string;
  peerUserId?: string;
  pending?: boolean;
};

function CountdownRow({
  icon: Icon,
  iconClass,
  label,
  emptyLabel,
  joinLabel,
  session,
  now,
  onJoin,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  iconClass: string;
  label: string;
  emptyLabel: string;
  joinLabel: string;
  session: UpcomingSession | null;
  now: number;
  onJoin?: () => void;
}) {
  return (
    <div className="relative rounded-xl border-2 border-[#234C6A]/60 bg-[#F8FAFC] p-4">
      {session?.pending && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          <Clock className="h-3 w-3" aria-hidden />
          Pending
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${iconClass}`}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <p className="truncate text-[12px] font-semibold text-slate-700">
                {session ? session.title : emptyLabel}
              </p>
              {session && formatSessionDuration(session.durationMinutes) ? (
                <p className="text-[11px] text-slate-500">
                  {formatSessionDuration(session.durationMinutes)}
                </p>
              ) : null}
            </div>
          </div>

          {session ? (
            <div className="mt-3">
              <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Clock className="h-3 w-3" aria-hidden />
                Starts in
              </p>
              <div className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-[#234C6A]">
                {formatDuration(session.startAt - now)}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-slate-500">Nothing scheduled yet.</p>
          )}
        </div>

        {session && !session.pending && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onJoin?.()}
              className="inline-flex items-center justify-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
              disabled={!onJoin}
            >
              {joinLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UpcomingCountdownCard({
  onJoinSeminar,
  onJoinOneToOne,
  nextSeminar = null,
  nextOneToOne = null,
}: {
  onJoinSeminar?: () => void;
  onJoinOneToOne?: () => void;
  nextSeminar?: UpcomingSession | null;
  nextOneToOne?: UpcomingSession | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <aside className="flex flex-col min-h-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Upcoming sessions
          </h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E8EEF4] px-3 py-1 text-[11px] font-semibold text-[#234C6A]">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <CountdownRow
          icon={BookOpen}
          iconClass="bg-emerald-50 text-emerald-700"
          label="Next seminar"
          emptyLabel="No upcoming seminar"
          joinLabel="Join seminar chat"
          session={nextSeminar}
          now={now}
          onJoin={onJoinSeminar}
        />
        <CountdownRow
          icon={UserCheck}
          iconClass="bg-blue-50 text-[#234C6A]"
          label="Next 1:1"
          emptyLabel="No upcoming 1:1 session"
          joinLabel="Join chat"
          session={nextOneToOne}
          now={now}
          onJoin={onJoinOneToOne}
        />
      </div>
    </aside>
  );
}
