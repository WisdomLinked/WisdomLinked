import React, { useMemo } from 'react';
import { SearchX, Users } from 'lucide-react';
import PageHeader from './PageHeader';
import FilterPanel from './FilterPanel';
import StudentCard from './StudentCard';
import useClientFilters from './useClientFilters';
import { applyStudentFilters, buildClientRows, filterOptions, hasActiveFilters } from './clientModel';
import { OUTLINE_BUTTON, type ClientActions } from './ui';

const plural = (n: number) => `${n} ${n === 1 ? 'student' : 'students'}`;

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
  const { scope, filters, update, clearFilters } = useClientFilters();

  const allRows = useMemo(
    () => buildClientRows({ directory, userDetails, unreadByRid, scope }),
    [directory, userDetails, unreadByRid, scope],
  );
  const options = useMemo(() => filterOptions(allRows), [allRows]);
  const rows = useMemo(() => applyStudentFilters(allRows, filters), [allRows, filters]);

  const filtered = hasActiveFilters(filters);
  const subtitle = filtered
    ? `Showing ${rows.length} of ${plural(allRows.length)}`
    : scope === 'mine'
      ? `${plural(allRows.length)} you mentor`
      : `${plural(allRows.length)} on WisdomLinked`;

  return (
    <div className="w-full min-w-0 space-y-5">
      <PageHeader subtitle={subtitle} onInvite={onInvite} />

      <FilterPanel scope={scope} filters={filters} options={options} onChange={update} onClear={clearFilters} />

      {allRows.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9D4CB] bg-white px-6 py-14 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E8EEF4] text-[#234C6A]">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-serif text-lg text-[#1A3A4A]">No clients yet</h2>
          <p className="mt-1 max-w-sm text-sm text-[#6B6B63]">
            Students you book or chat with will show up here. Use "Invite a client" to propose a first session.
          </p>
        </section>
      ) : rows.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9D4CB] bg-white px-6 py-14 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E8EEF4] text-[#234C6A]">
            <SearchX className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-serif text-lg text-[#1A3A4A]">No students match these filters</h2>
          <p className="mt-1 max-w-sm text-sm text-[#6B6B63]">Try removing a service or widening the country.</p>
          <button type="button" onClick={clearFilters} className={`${OUTLINE_BUTTON} mt-5 h-11 px-5`}>
            Clear filters
          </button>
        </section>
      ) : (
        <div className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-5">
          {rows.map((row) => (
            <StudentCard key={row.id} row={row} imageUrl={imageUrls[row.id] ?? null} actions={actions} />
          ))}
        </div>
      )}
    </div>
  );
}
