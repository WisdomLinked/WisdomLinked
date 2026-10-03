import React, { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import PageHeader from './PageHeader';
import ClientCard from './ClientCard';
import { ALL_FIELDS, buildClientRows, filterAndSort, type ClientScope } from './clientModel';
import type { ClientActions } from './ui';

export default function ClientsPage({
  directory,
  userDetails,
  unreadByRid,
  imageUrls,
  actions,
  onInvite,
}: {
  directory: any[];
  userDetails: any;
  unreadByRid: Record<string, number>;
  imageUrls: Record<string, string | null>;
  actions: ClientActions;
  onInvite: () => void;
}) {
  const [scope, setScope] = useState<ClientScope>('mine');

  const rows = useMemo(
    () =>
      filterAndSort(buildClientRows({ directory, userDetails, unreadByRid, scope }), {
        query: '',
        status: 'all',
        field: ALL_FIELDS,
        sortBy: 'next',
      }),
    [directory, userDetails, unreadByRid, scope],
  );

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader count={rows.length} scope={scope} onScopeChange={setScope} onInvite={onInvite} />

      {rows.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E2DB] bg-white px-6 py-14 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E8EEF4] text-[#234C6A]">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-serif text-lg text-[#1A3A4A]">No clients yet</h2>
          <p className="mt-1 max-w-sm text-sm text-[#7A7A72]">
            Students you book or chat with will show up here. Use "Invite a client" to propose a first session.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((row) => (
            <ClientCard key={row.id} row={row} imageUrl={imageUrls[row.id] ?? null} actions={actions} />
          ))}
        </div>
      )}
    </div>
  );
}
