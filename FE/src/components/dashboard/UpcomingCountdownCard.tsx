import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatSessionDuration, formatSessionWhen } from '../../utils/sessionDuration';
import type { UpcomingModalSession } from './UpcomingSessionModal';

const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand focus-visible:ring-offset-2';

function formatStartsIn(ms: number) {
  const safe = Math.max(0, ms);
  const totalMinutes = Math.floor(safe / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
}

function isLive(session: UpcomingSession, now: number) {
  if (session.pending || session.startAt > now) return false;
  const endAt =
    typeof session.durationMinutes === 'number' && session.durationMinutes > 0
      ? session.startAt + session.durationMinutes * 60_000
      : session.startAt + 60 * 60_000;
  return now < endAt;
}

export type UpcomingSession = {
  title: string;
  startAt: number;
  durationMinutes?: number;
  id?: string;
  peerUserId?: string;
  pending?: boolean;
  detail?: UpcomingModalSession['detail'];
  briefLabel?: string;
};

function SessionRow({
  typeLabel,
  emptyLabel,
  joinLabel,
  session,
  now,
  onJoin,
  onOpenDetails,
}: {
  typeLabel: string;
  emptyLabel: string;
  joinLabel: string;
  session: UpcomingSession | null;
  now: number;
  onJoin?: () => void;
  onOpenDetails?: (session: UpcomingSession) => void;
}) {
  if (!session) {
    return (
      <div className="px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{typeLabel}</p>
        <p className="mt-1 text-sm text-slate-600">{emptyLabel}</p>
      </div>
    );
  }

  const live = isLive(session, now);
  const when = [formatSessionWhen(session.startAt), formatSessionDuration(session.durationMinutes)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{typeLabel}</p>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        ) : null}
        {session.pending ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            <Clock className="h-3 w-3" aria-hidden />
            Pending
          </span>
        ) : null}
      </div>
      {session.detail && onOpenDetails ? (
        <button
          type="button"
          onClick={() => onOpenDetails(session)}
          title={session.briefLabel ? `View ${session.briefLabel.toLowerCase()}` : 'View session details'}
          className={`mt-1 block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:underline ${FOCUS}`}
        >
          {session.title}
        </button>
      ) : (
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{session.title}</p>
      )}
      {when ? <p className="mt-1 text-sm text-slate-600">{when}</p> : null}
      <p className="mt-1 text-sm font-medium text-slate-700">
        {live ? 'In progress' : formatStartsIn(session.startAt - now)}
      </p>
      {!session.pending ? (
        <button
          type="button"
          onClick={() => onJoin?.()}
          className={`mt-4 inline-flex w-full items-center justify-center rounded-lg bg-wl-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60 ${FOCUS}`}
          disabled={!onJoin}
        >
          {joinLabel}
        </button>
      ) : null}
    </div>
  );
}

export default function UpcomingCountdownCard({
  onJoinSeminar,
  onJoinOneToOne,
  nextSeminar = null,
  nextOneToOne = null,
  onOpenDetails,
  onFindExperts,
}: {
  onJoinSeminar?: () => void;
  onJoinOneToOne?: () => void;
  onOpenDetails?: (session: UpcomingSession) => void;
  onFindExperts?: () => void;
  nextSeminar?: UpcomingSession | null;
  nextOneToOne?: UpcomingSession | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const rows = [
    {
      key: 'seminar',
      typeLabel: 'Next seminar',
      emptyLabel: 'No upcoming seminar',
      joinLabel: 'Join seminar chat',
      session: nextSeminar,
      onJoin: onJoinSeminar,
    },
    {
      key: 'oneToOne',
      typeLabel: 'Next 1:1',
      emptyLabel: 'No upcoming 1:1 session',
      joinLabel: 'Join chat',
      session: nextOneToOne,
      onJoin: onJoinOneToOne,
    },
  ];
  const hasSession = Boolean(nextSeminar || nextOneToOne);

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="px-5 pt-5">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming sessions</h2>
      </div>

      {hasSession ? (
        <div className="mt-2 divide-y divide-slate-200">
          {rows.map(row => (
            <SessionRow
              key={row.key}
              typeLabel={row.typeLabel}
              emptyLabel={row.emptyLabel}
              joinLabel={row.joinLabel}
              session={row.session}
              now={now}
              onJoin={row.onJoin}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-8">
          <p className="text-sm font-medium text-slate-900">No upcoming sessions</p>
          <p className="mt-1 text-sm text-slate-500">Book a 1:1 or seminar to see it here.</p>
          {onFindExperts ? (
            <button
              type="button"
              onClick={onFindExperts}
              className={`mt-4 text-sm font-medium text-wl-brand hover:underline ${FOCUS}`}
            >
              Find experts
            </button>
          ) : null}
        </div>
      )}
    </aside>
  );
}
