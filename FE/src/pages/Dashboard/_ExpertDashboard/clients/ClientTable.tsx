import React from 'react';
import { MessageSquare } from 'lucide-react';
import ClientAvatar from './ClientAvatar';
import StatusBadge from './StatusBadge';
import { UnreadBadge } from './ClientCard';
import { formatLastSession, formatNextSession, type ClientRow } from './clientModel';
import { FOCUS_RING, ICON_BUTTON, PRIMARY_BUTTON, type ClientActions } from './ui';

const TH = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A7A72]';
const TD = 'px-4 py-3 align-middle text-sm text-[#1A3A4A]';

export default function ClientTable({
  rows,
  imageUrls,
  actions,
}: {
  rows: ClientRow[];
  imageUrls: Record<string, string | null>;
  actions: ClientActions;
}) {
  return (
    <div className="scrollbar-thin w-full overflow-x-auto rounded-2xl border border-[#E5E2DB] bg-white shadow-sm">
      <table className="w-full min-w-[760px] border-collapse">
        <caption className="sr-only">Clients</caption>
        <thead className="border-b border-[#E5E2DB] bg-[#F5F3EF]">
          <tr>
            <th scope="col" className={TH}>Client</th>
            <th scope="col" className={TH}>Status</th>
            <th scope="col" className={TH}>Sessions</th>
            <th scope="col" className={TH}>Last session</th>
            <th scope="col" className={TH}>Next session</th>
            <th scope="col" className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E2DB]">
          {rows.map((row) => {
            const next = formatNextSession(row.nextSessionAt);
            const last = formatLastSession(row.lastSessionAt);
            return (
              <tr key={row.id} className="transition-colors hover:bg-[#F5F3EF]/60">
                <td className={TD}>
                  <div className="flex min-w-0 items-center gap-3">
                    <ClientAvatar id={row.id} name={row.name} src={imageUrls[row.id] ?? null} size="sm" />
                    <button
                      type="button"
                      onClick={() => actions.onOpenProfile(row)}
                      className={`max-w-[14rem] truncate rounded font-semibold hover:underline ${FOCUS_RING}`}
                    >
                      {row.name}
                    </button>
                  </div>
                </td>
                <td className={TD}>
                  <StatusBadge status={row.status} />
                </td>
                <td className={`${TD} tabular-nums`}>{row.sessionsCount}</td>
                <td className={`${TD} whitespace-nowrap ${last ? '' : 'text-[#7A7A72]'}`}>{last ?? 'Not booked'}</td>
                <td className={`${TD} whitespace-nowrap ${next ? 'font-medium text-emerald-700' : 'text-[#7A7A72]'}`}>
                  {next ?? 'Not booked'}
                </td>
                <td className={TD}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => actions.onMessage(row)}
                      aria-label={row.unread > 0 ? `Message ${row.name}, ${row.unread} unread` : `Message ${row.name}`}
                      className={`${ICON_BUTTON} h-9 w-9`}
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden />
                      <UnreadBadge count={row.unread} />
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.onPropose(row)}
                      disabled={row.raw?.status === 'review'}
                      className={`${PRIMARY_BUTTON} h-9 whitespace-nowrap`}
                    >
                      Propose session
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
