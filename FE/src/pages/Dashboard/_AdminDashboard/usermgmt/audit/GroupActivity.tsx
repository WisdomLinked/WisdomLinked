import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AUDIT_FOCUS, AUDIT_PILL } from './auditUi';
import {
  communityMemberTag,
  formatAfterAppointment,
  formatCallTime,
  formatCount,
  formatPerWeek,
  formatStarted,
  type ConversationKind,
  type GroupActivityData,
} from './auditModel';

export type GroupActivityState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: GroupActivityData };

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-audit-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-audit-ink">{value}</dd>
    </div>
  );
}

/** Full heading once the chat panel is wide; the short one keeps all five columns visible when it is narrow. */
function ColumnHeading({ full, short, last = false }: { full: string; short: string; last?: boolean }) {
  return (
    <th scope="col" className={`whitespace-nowrap py-1.5 text-right font-medium ${last ? '' : 'pr-2 min-[1360px]:pr-3'}`}>
      <abbr title={full} className="no-underline min-[1360px]:hidden">{short}</abbr>
      <span className="hidden min-[1360px]:inline">{full}</span>
    </th>
  );
}

export default function GroupActivity({
  state,
  kind,
  auditedUserId,
  onRetry,
}: {
  state: GroupActivityState;
  kind: ConversationKind;
  auditedUserId?: string;
  onRetry: () => void;
}) {
  const [membersOpen, setMembersOpen] = useState(true);

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-audit-line bg-audit-sunken p-4 text-sm text-audit-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading activity…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-audit-line bg-audit-sunken p-4">
        <p className="text-sm text-audit-muted">Couldn&apos;t load activity for this {kind === 'seminar' ? 'seminar' : kind === 'private' ? 'appointment' : 'community'}.</p>
        <button
          type="button"
          onClick={onRetry}
          className={`${AUDIT_FOCUS} rounded-lg bg-audit-surface px-3 py-1.5 text-sm font-medium text-audit-ink hover:bg-audit-canvas`}
        >
          Retry
        </button>
      </div>
    );
  }

  const { totals, members, messagesAvailable, messagesCapped, community, appointment } = state.data;
  const since = totals.since ? formatStarted(totals.since) : '';
  const sessions = community?.sessionCount ?? 1;

  return (
    <section className="rounded-xl border border-audit-line bg-audit-sunken px-3 py-3 xl:px-4" aria-label="Activity">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-audit-muted">Activity</p>
        <p className="text-xs text-audit-muted">{since ? `Since ${since} · averages per week` : 'Averages per week'}</p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Total label="Video calls" value={formatCount(totals.calls)} />
        <Total label="Calls per week" value={formatPerWeek(totals.callsPerWeek)} />
        <Total label="Messages" value={formatCount(totals.messages)} />
        <Total label="Messages per week" value={formatPerWeek(totals.messagesPerWeek)} />
      </dl>

      {appointment ? (
        <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-audit-line pt-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wider text-audit-muted">Call time vs booked</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums text-audit-ink">
              {formatCallTime(appointment)}
              {appointment.timeStatus === 'unconfirmed' ? (
                <span className={`${AUDIT_PILL} bg-audit-warn-soft text-audit-warn`}>Unconfirmed</span>
              ) : null}
            </dd>
            {appointment.timeStatus === 'unconfirmed' ? (
              <p className="mt-0.5 text-xs text-audit-muted">A call wasn&apos;t ended properly, so its length isn&apos;t known.</p>
            ) : null}
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wider text-audit-muted">After the appointment</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-audit-ink">{formatAfterAppointment(appointment)}</dd>
          </div>
        </dl>
      ) : null}

      {sessions > 1 ? (
        <p className="mt-3 text-xs text-audit-muted">Covers all {sessions} sessions of this recurring seminar, which share one chat.</p>
      ) : null}
      {!messagesAvailable ? (
        <p className="mt-3 text-xs text-audit-warn">Message counts are unavailable right now — the chat server could not be reached.</p>
      ) : messagesCapped ? (
        <p className="mt-3 text-xs text-audit-muted">Message counts cover the most recent 5,000 messages.</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-audit-muted">Per member</p>
        <button
          type="button"
          onClick={() => setMembersOpen(open => !open)}
          aria-expanded={membersOpen}
          aria-controls="audit-activity-members"
          className={`${AUDIT_FOCUS} rounded px-1.5 py-0.5 text-xs font-medium text-audit-brand hover:bg-audit-surface`}
        >
          {membersOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      <div id="audit-activity-members" hidden={!membersOpen} className="mt-1 max-h-36 overflow-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Activity per member</caption>
          <thead>
            <tr className="sticky top-0 border-b border-audit-line bg-audit-sunken text-xs uppercase text-audit-muted min-[1360px]:tracking-wider">
              <th scope="col" className="py-1.5 pr-2 font-medium min-[1360px]:pr-3">Member</th>
              <ColumnHeading full="Calls joined" short="Calls" />
              <ColumnHeading full="Calls / week" short="Calls/wk" />
              <ColumnHeading full="Messages" short="Msgs" />
              <ColumnHeading full="Messages / week" short="Msgs/wk" last />
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const name = member.username || member.email || 'Member';
              const tag = communityMemberTag(member, auditedUserId, kind);
              return (
                <tr key={member._id} className="border-b border-audit-line last:border-0">
                  <th scope="row" className="max-w-[76px] truncate py-1.5 pr-2 font-normal text-audit-ink min-[1360px]:max-w-[220px] min-[1360px]:pr-3">
                    {name}
                    {tag ? <span className="text-xs text-audit-muted"> · {tag}</span> : null}
                  </th>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-audit-ink min-[1360px]:pr-3">{formatCount(member.callsJoined)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-audit-ink min-[1360px]:pr-3">{formatPerWeek(member.callsPerWeek)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-audit-ink min-[1360px]:pr-3">{formatCount(member.messages)}</td>
                  <td className="py-1.5 text-right tabular-nums text-audit-ink">{formatPerWeek(member.messagesPerWeek)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {messagesAvailable && totals.messagesFromOthers ? (
        <p className="mt-2 text-xs text-audit-muted">
          {formatCount(totals.messagesFromOthers)} more {totals.messagesFromOthers === 1 ? 'message was' : 'messages were'} sent by people who are no longer members.
        </p>
      ) : null}
    </section>
  );
}
