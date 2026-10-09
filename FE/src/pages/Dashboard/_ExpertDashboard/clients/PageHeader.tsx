import React from 'react';
import { UserPlus } from 'lucide-react';
import { DASHBOARD_PAGE_TITLE } from '../../../../components/dashboard/pageTitle';
import { PRIMARY_BUTTON } from './ui';

export default function PageHeader({ subtitle, onInvite }: { subtitle: string; onInvite: () => void }) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#E5E2DB] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className={DASHBOARD_PAGE_TITLE}>Clients</h1>
        <p className="mt-1 text-sm text-[#6B6B63]" aria-live="polite">
          {subtitle}
        </p>
      </div>
      <button type="button" onClick={onInvite} className={`${PRIMARY_BUTTON} h-11 w-full sm:w-auto`}>
        <UserPlus className="h-4 w-4" aria-hidden />
        Invite a client
      </button>
    </header>
  );
}
