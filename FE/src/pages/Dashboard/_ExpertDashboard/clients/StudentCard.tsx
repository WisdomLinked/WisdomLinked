import React from 'react';
import { MapPin } from 'lucide-react';
import ClientAvatar from './ClientAvatar';
import { formatLastSession, formatNextSession, isNewStudent, type ClientRow } from './clientModel';
import { FOCUS_RING, MICRO_LABEL, OUTLINE_BUTTON, PRIMARY_BUTTON, type ClientActions } from './ui';

const EMPTY = '—';

const SERVICE_TAG: Record<string, string> = {
  'Study Abroad': 'bg-sky-50 text-sky-800',
  'Work Abroad': 'bg-emerald-50 text-emerald-800',
  'Research Guidance': 'bg-violet-50 text-violet-800',
};

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#234C6A] px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-white">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'amber'; children: React.ReactNode }) {
  const color = tone === 'green' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {children}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className={MICRO_LABEL}>{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-[#1A3A4A]" title={value || undefined}>
        {value || EMPTY}
      </dd>
    </div>
  );
}

function SessionCell({ label, value, booked }: { label: string; value: string | null; booked?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={MICRO_LABEL}>{label}</div>
      <div
        className={`mt-0.5 truncate text-[13px] font-medium ${
          value ? (booked ? 'text-emerald-700' : 'text-[#1A3A4A]') : 'text-[#6B6B63]'
        }`}
        title={value ?? undefined}
      >
        {value ?? 'Not booked'}
      </div>
    </div>
  );
}

export default function StudentCard({
  row,
  imageUrl,
  actions,
}: {
  row: ClientRow;
  imageUrl: string | null;
  actions: ClientActions;
}) {
  const location = [row.country, row.school].filter(Boolean).join(' · ');
  const standing = [row.gpa && `GPA ${row.gpa}`, row.ranking].filter(Boolean).join(' · ');

  const openProfileFromCard = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    actions.onOpenProfile(row);
  };

  return (
    <article
      onClick={openProfileFromCard}
      className="flex h-full min-w-0 cursor-pointer flex-col gap-4 rounded-2xl border border-[#E5E2DB] bg-white p-5 shadow-sm transition-shadow hover:border-[#BCD6EA] hover:shadow-md"
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <ClientAvatar id={row.id} name={row.name} src={imageUrl} size="md" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => actions.onOpenProfile(row)}
              aria-label={`View ${row.name}'s profile`}
              title={row.name}
              className={`min-w-0 truncate rounded text-left text-[17px] font-semibold leading-snug text-[#1A3A4A] hover:underline ${FOCUS_RING}`}
            >
              {row.name}
            </button>
            {row.isClient ? <Badge tone="green">My client</Badge> : null}
            {isNewStudent(row) ? <Badge tone="amber">New</Badge> : null}
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-[#6B6B63]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate" title={location || undefined}>
              {location || EMPTY}
            </span>
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-[#F8F6F2] p-3.5">
        <Fact label="Intended major" value={row.fields.join(', ')} />
        <Fact label="Degree" value={row.targetDegree} />
        <Fact label="Intake" value={row.intake} />
        <Fact label="GPA · Ranking" value={standing} />
      </dl>

      <div>
        <div className={MICRO_LABEL}>Services required</div>
        {row.services.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {row.services.map((s) => (
              <li
                key={s}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SERVICE_TAG[s] ?? 'bg-slate-100 text-slate-700'}`}
              >
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-[#1A3A4A]">{EMPTY}</p>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-4 border-t border-[#E5E2DB] pt-3">
        <SessionCell label="Last session" value={formatLastSession(row.lastSessionAt)} />
        <SessionCell label="Next session" value={formatNextSession(row.nextSessionAt)} booked />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => actions.onMessage(row)}
          aria-label={row.unread > 0 ? `Chat with ${row.name}, ${row.unread} unread` : `Chat with ${row.name}`}
          className={`${OUTLINE_BUTTON} relative h-11 shrink-0 px-5`}
        >
          Chat
          <UnreadBadge count={row.unread} />
        </button>
        <button
          type="button"
          onClick={() => actions.onPropose(row)}
          disabled={row.raw?.status === 'review'}
          className={`${PRIMARY_BUTTON} h-11 min-w-0 flex-1`}
        >
          Propose session
        </button>
      </div>
    </article>
  );
}
