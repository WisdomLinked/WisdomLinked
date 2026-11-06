import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import {
  WAITLIST_NOTICE_TTL_MS,
  waitlistJoinHeadline,
  type WaitlistJoinNotice,
} from '../../utils/seminarWaitlist';

const hoursLeft = (latestJoinAt: string) =>
  Math.max(
    0,
    Math.ceil(
      (new Date(latestJoinAt).getTime() + WAITLIST_NOTICE_TTL_MS - Date.now()) / (60 * 60 * 1000),
    ),
  );

// Beyond this the banners would push the page itself off the screen.
const COLLAPSED_COUNT = 3;

const formatWhen = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

/** Tells the host who has joined their seminar waitlists. Email remains the durable copy. */
export default function WaitlistJoinNotices({
  notices,
  onOpenWaitlist,
  onDismiss,
}: {
  notices: WaitlistJoinNotice[];
  onOpenWaitlist: (notice: WaitlistJoinNotice) => void;
  onDismiss: (notice: WaitlistJoinNotice) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (notices.length === 0) return null;
  const hidden = notices.length - COLLAPSED_COUNT;
  const visible = expanded ? notices : notices.slice(0, COLLAPSED_COUNT);

  return (
    <section className="space-y-2" aria-label="New students on your waitlists">
      {visible.map(notice => {
        const { maxAttendees, occupied } = notice.seats;
        const remaining = hoursLeft(notice.latestJoinAt);
        const when = formatWhen(notice.start);
        return (
          <div
            key={notice.seminarId}
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3"
          >
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[12px] font-semibold text-emerald-900">
                {waitlistJoinHeadline(notice)}
              </p>
              <p className="mt-1 text-[12px] text-slate-700">
                {when ? `${when} · ` : ''}
                {maxAttendees == null
                  ? `Seats taken: ${occupied}`
                  : `Seats taken: ${occupied} of ${maxAttendees}`}
                {` · ${notice.waiting} waiting`}
              </p>
              <button
                type="button"
                onClick={() => onOpenWaitlist(notice)}
                className="mt-2 rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#122635]"
              >
                Open waitlist
              </button>
              <p className="mt-1 text-[10px] text-slate-500">
                Also sent to your email
                {remaining > 0 ? ` · this message clears in ${remaining}h` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(notice)}
              aria-label={`Dismiss the waitlist message for ${notice.title}${when ? ` on ${when}` : ''}`}
              title="Dismiss"
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/70 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(open => !open)}
          aria-expanded={expanded}
          className="text-[12px] font-semibold text-[#1A3A4A] hover:underline"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more ${hidden === 1 ? 'seminar' : 'seminars'}`}
        </button>
      ) : null}
    </section>
  );
}
