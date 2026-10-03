import React from 'react';
import { MessageSquare } from 'lucide-react';
import ClientAvatar from './ClientAvatar';
import { formatLastSession, formatNextSession, type ClientRow } from './clientModel';
import { FOCUS_RING, ICON_BUTTON, PRIMARY_BUTTON, type ClientActions } from './ui';

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#234C6A] px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-white">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function SessionCell({ label, value, booked }: { label: string; value: string | null; booked?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A7A72]">{label}</div>
      <div
        className={`mt-0.5 truncate text-[13px] font-medium ${
          value ? (booked ? 'text-emerald-700' : 'text-[#1A3A4A]') : 'text-[#7A7A72]'
        }`}
      >
        {value ?? 'Not booked'}
      </div>
    </div>
  );
}

export default function ClientCard({
  row,
  imageUrl,
  actions,
}: {
  row: ClientRow;
  imageUrl: string | null;
  actions: ClientActions;
}) {
  const next = formatNextSession(row.nextSessionAt);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#E5E2DB] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => actions.onOpenProfile(row)}
        aria-label={`View ${row.name}'s profile`}
        className={`mx-auto flex max-w-full flex-col items-center gap-3 rounded-xl p-1 ${FOCUS_RING}`}
      >
        <ClientAvatar id={row.id} name={row.name} src={imageUrl} />
        <span className="block max-w-full truncate text-[15px] font-semibold text-[#1A3A4A] hover:underline">
          {row.name}
        </span>
      </button>

      <div className="mt-4 grid grid-cols-2 divide-x divide-[#E5E2DB] rounded-xl bg-[#F5F3EF]">
        <SessionCell label="Last session" value={formatLastSession(row.lastSessionAt)} />
        <SessionCell label="Next session" value={next} booked />
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={() => actions.onMessage(row)}
          aria-label={row.unread > 0 ? `Chat with ${row.name}, ${row.unread} unread` : `Chat with ${row.name}`}
          className={`${ICON_BUTTON} h-10 gap-1.5 px-3.5 text-sm font-semibold`}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          Chat
          <UnreadBadge count={row.unread} />
        </button>
        <button
          type="button"
          onClick={() => actions.onPropose(row)}
          disabled={row.raw?.status === 'review'}
          className={`${PRIMARY_BUTTON} h-10 min-w-0 flex-1`}
        >
          Propose session
        </button>
      </div>
    </article>
  );
}
