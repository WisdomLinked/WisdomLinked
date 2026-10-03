import React from 'react';
import { UserPlus } from 'lucide-react';
import { DASHBOARD_PAGE_TITLE } from '../../../../components/dashboard/pageTitle';
import type { ClientScope } from './clientModel';
import { FOCUS_RING, PRIMARY_BUTTON } from './ui';

const SCOPES: { value: ClientScope; label: string }[] = [
  { value: 'mine', label: 'My clients' },
  { value: 'all', label: 'All students' },
];

export default function PageHeader({
  count,
  scope,
  onScopeChange,
  onInvite,
}: {
  count: number;
  scope: ClientScope;
  onScopeChange: (scope: ClientScope) => void;
  onInvite: () => void;
}) {
  const noun = count === 1 ? 'student' : 'students';
  const subtitle = scope === 'mine' ? `${count} ${noun} you mentor` : `${count} ${noun} on WisdomLinked`;
  return (
    <header className="flex flex-col gap-4 border-b border-[#E5E2DB] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className={DASHBOARD_PAGE_TITLE}>Clients</h1>
        <p className="mt-1 text-sm text-[#7A7A72]">{subtitle}</p>
        <div
          role="group"
          aria-label="Which students to show"
          className="mt-3 inline-flex rounded-full border border-[#E5E2DB] bg-white p-0.5"
        >
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={scope === s.value}
              onClick={() => onScopeChange(s.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${FOCUS_RING} ${
                scope === s.value ? 'bg-[#234C6A] text-white' : 'text-[#7A7A72] hover:text-[#1A3A4A]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={onInvite} className={`${PRIMARY_BUTTON} h-10 w-full sm:w-auto`}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Invite a client
      </button>
    </header>
  );
}
