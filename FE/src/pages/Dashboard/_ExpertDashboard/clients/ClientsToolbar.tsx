import React from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import FilterDropdown, { type FilterOption } from '../../../../components/ui/FilterDropdown';
import type { ClientSort, ClientStatus, ClientView } from './clientModel';
import { FOCUS_RING } from './ui';

export const SORT_OPTIONS: FilterOption[] = [
  { value: 'next', label: 'Next session' },
  { value: 'recent', label: 'Recent activity' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'sessions', label: 'Most sessions' },
];

const STATUS_PILLS: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Booked' },
  { value: 'pending', label: 'Proposal sent' },
  { value: 'new', label: 'New' },
  { value: 'idle', label: 'No session' },
];

const VIEWS: { value: ClientView; label: string; Icon: typeof List }[] = [
  { value: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { value: 'table', label: 'Table view', Icon: List },
];

export default function ClientsToolbar({
  query,
  onQueryChange,
  field,
  fieldOptions,
  onFieldChange,
  sortBy,
  onSortChange,
  view,
  onViewChange,
  status,
  onStatusChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  field: string;
  fieldOptions: FilterOption[];
  onFieldChange: (f: string) => void;
  sortBy: ClientSort;
  onSortChange: (s: ClientSort) => void;
  view: ClientView;
  onViewChange: (v: ClientView) => void;
  status: ClientStatus | 'all';
  onStatusChange: (s: ClientStatus | 'all') => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="clients-search"
            className="mb-1 block text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72]"
          >
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A7A72]" aria-hidden />
            <input
              id="clients-search"
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Name, school or goal"
              className="h-[34px] w-full rounded-xl border border-[#E5E2DB] bg-white pl-9 pr-9 text-sm text-[#1A3A4A] shadow-sm outline-none placeholder:text-[#B2AEA2] focus:ring-2 focus:ring-[#234C6A]/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="Clear search"
                className={`absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#7A7A72] hover:bg-[#F5F3EF] hover:text-[#1A3A4A] ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:items-end">
          <FilterDropdown label="Field of study" value={field} options={fieldOptions} onChange={onFieldChange} widthClass="md:w-48" />
          <FilterDropdown
            label="Sort by"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(v) => onSortChange(v as ClientSort)}
            widthClass="md:w-44"
          />
          <div
            role="group"
            aria-label="Layout"
            className="hidden h-[34px] items-center rounded-xl border border-[#E5E2DB] bg-white p-0.5 shadow-sm sm:inline-flex"
          >
            {VIEWS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => onViewChange(value)}
                className={`inline-flex h-full w-8 items-center justify-center rounded-lg transition ${FOCUS_RING} ${
                  view === value ? 'bg-[#234C6A] text-white' : 'text-[#7A7A72] hover:text-[#1A3A4A]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div role="group" aria-label="Filter by status" className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {STATUS_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={status === p.value}
            onClick={() => onStatusChange(p.value)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${FOCUS_RING} ${
              status === p.value
                ? 'border-[#234C6A] bg-[#234C6A] text-white'
                : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:border-[#BCD6EA]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
