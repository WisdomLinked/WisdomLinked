import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import Dropdown, { type DropdownOption } from '../../../../components/ui/Dropdown';
import { SERVICE_LABELS } from '../../../../constants/serviceOptions';
import ActiveFilterChip from './ActiveFilterChip';
import ServicePill from './ServicePill';
import { hasActiveFilters, type ClientScope, type StudentFilters, type StudentSort } from './clientModel';
import { FIELD_LABEL, FOCUS_RING, TOUCH_TARGET } from './ui';
import type { FilterPatch } from './useClientFilters';

const SCOPES: { value: ClientScope; label: string }[] = [
  { value: 'mine', label: 'My clients' },
  { value: 'all', label: 'All students' },
];

const SORT_OPTIONS: { value: StudentSort; label: string }[] = [
  { value: 'joined', label: 'Recently joined' },
  { value: 'intake', label: 'Nearest intake' },
  { value: 'name', label: 'Name A–Z' },
];

const SEARCH_DEBOUNCE_MS = 250;
const CONTROL_WIDTH = 'w-full sm:w-44';

type Patch = FilterPatch;

/** "All countries" plus each value; keeps the current value listed even if no student has it any more. */
function withAny(anyLabel: string, values: string[], current: string): DropdownOption[] {
  const list = current && !values.includes(current) ? [current, ...values] : values;
  return [{ value: '', label: anyLabel }, ...list.map((v) => ({ value: v, label: v }))];
}

export default function FilterPanel({
  scope,
  filters,
  options,
  onChange,
  onClear,
}: {
  scope: ClientScope;
  filters: StudentFilters;
  options: { countries: string[]; majors: string[]; degrees: string[] };
  onChange: (patch: Patch, opts?: { replace?: boolean }) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(filters.query);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setDraft(filters.query), [filters.query]);

  useEffect(() => {
    if (draft === filters.query) return undefined;
    const t = window.setTimeout(() => onChangeRef.current({ query: draft }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const toggleService = (s: string) =>
    onChange({ services: filters.services.includes(s) ? filters.services.filter((x) => x !== s) : [...filters.services, s] });

  const chips: { key: string; label: string; clear: Patch }[] = [
    ...(filters.query.trim() ? [{ key: 'q', label: `“${filters.query.trim()}”`, clear: { query: '' } }] : []),
    ...(filters.country ? [{ key: 'country', label: filters.country, clear: { country: '' } }] : []),
    ...(filters.major ? [{ key: 'major', label: filters.major, clear: { major: '' } }] : []),
    ...(filters.degree ? [{ key: 'degree', label: filters.degree, clear: { degree: '' } }] : []),
    ...filters.services.map((s) => ({
      key: `svc-${s}`,
      label: s,
      clear: { services: filters.services.filter((x) => x !== s) },
    })),
  ];

  return (
    <section aria-label="Filter students" className="rounded-2xl border border-[#E5E2DB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <span id="clients-scope-label" className={FIELD_LABEL}>
            Show
          </span>
          <div
            role="group"
            aria-labelledby="clients-scope-label"
            className="flex h-11 rounded-full border border-[#D9D4CB] bg-white p-1"
          >
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={scope === s.value}
                onClick={() => onChange({ scope: s.value })}
                className={`flex-1 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition sm:flex-none ${FOCUS_RING} ${
                  scope === s.value ? 'bg-[#234C6A] text-white' : 'text-[#6B6B63] hover:text-[#1A3A4A]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full min-w-0 sm:min-w-[240px] sm:flex-1">
          <label htmlFor="clients-search" className={FIELD_LABEL}>
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B63]" aria-hidden />
            <input
              id="clients-search"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Name, university or major"
              className="h-11 w-full rounded-[10px] border border-[#D9D4CB] bg-white pl-9 pr-10 text-sm text-[#1A3A4A] outline-none transition placeholder:text-[#8A867C] hover:border-[#B8B2A6] focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {draft ? (
              <button
                type="button"
                onClick={() => {
                  setDraft('');
                  onChange({ query: '' }, { replace: true });
                }}
                aria-label="Clear search"
                className={`absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#6B6B63] hover:bg-[#F5F3EF] hover:text-[#1A3A4A] ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <Dropdown
          label="Country"
          value={filters.country}
          options={withAny('All countries', options.countries, filters.country)}
          onChange={(v) => onChange({ country: v })}
          className={CONTROL_WIDTH}
        />
        <Dropdown
          label="Intended major"
          value={filters.major}
          options={withAny('All majors', options.majors, filters.major)}
          onChange={(v) => onChange({ major: v })}
          className={CONTROL_WIDTH}
        />
        <Dropdown
          label="Degree"
          value={filters.degree}
          options={withAny('Any degree', options.degrees, filters.degree)}
          onChange={(v) => onChange({ degree: v })}
          className={CONTROL_WIDTH}
        />
        <Dropdown
          label="Sort by"
          value={filters.sortBy}
          options={SORT_OPTIONS}
          onChange={(v) => onChange({ sortBy: v as StudentSort })}
          className={CONTROL_WIDTH}
        />
      </div>

      <div role="group" aria-labelledby="clients-services-label" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <span id="clients-services-label" className="text-xs font-semibold uppercase tracking-wide text-[#6B6B63]">
          Services required
        </span>
        {SERVICE_LABELS.map((s) => (
          <ServicePill key={s} label={s} pressed={filters.services.includes(s)} onToggle={() => toggleService(s)} />
        ))}
      </div>

      {hasActiveFilters(filters) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E5E2DB] pt-4">
          <span className="mr-1 text-xs font-semibold text-[#6B6B63]">Active:</span>
          {chips.map((c) => (
            <ActiveFilterChip key={c.key} label={c.label} onRemove={() => onChange(c.clear)} />
          ))}
          <button
            type="button"
            onClick={onClear}
            className={`${TOUCH_TARGET} ml-1 h-8 rounded-md px-1.5 text-sm font-semibold text-[#234C6A] underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </section>
  );
}
