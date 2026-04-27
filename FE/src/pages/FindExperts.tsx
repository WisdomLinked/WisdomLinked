import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, ChevronDown, Check } from 'lucide-react';
import MentorCard, { MentorCardProps } from '../components/MentorCard';
import { doFilterExperts, doGetKeywordsAndServices } from '../api/api';
import { SetLoadingStatus } from '../actions/appActions';

/** Placeholder follower UI until a backend endpoint exists. */
export const INITIAL_FOLLOWER_COUNTS: Record<string, number> = {};

function mapExpertToMentor(expert: any): MentorCardProps {
  const kw = (expert.keywords || []).map((k: any) => k?.value).filter(Boolean);
  const svc = (expert.services || []).map((s: any) => s?.value ?? s?.name).filter(Boolean);
  const field = kw[0] || 'General';
  const created = expert.createdAt ? new Date(expert.createdAt).getTime() : 0;
  const isNew = created > 0 && Date.now() - created < 30 * 24 * 60 * 60 * 1000;
  return {
    id: String(expert._id),
    name: expert.username || expert.email || 'Expert',
    title: expert.title || 'Expert',
    institution:
      (expert.description && String(expert.description).slice(0, 80)) ||
      expert.specialNote ||
      'WisdomLinked expert',
    field,
    experience:
      typeof expert.rating === 'number' && expert.rating > 0
        ? `${expert.rating.toFixed(1)}★`
        : '—',
    services: svc.length ? svc : ['1:1 session'],
    image: expert.image || null,
    isNew,
  };
}

type FilterOption = { value: string; label: string };

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  widthClass = 'md:w-44',
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const triggerId = `${label.replace(/\s+/g, '-').toLowerCase()}-trigger`;
  const panelId = `${label.replace(/\s+/g, '-').toLowerCase()}-panel`;

  const selected = useMemo(
    () => options.find(o => o.value === value) ?? options[0],
    [options, value],
  );

  useEffect(() => {
    const idx = options.findIndex(o => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [options, value, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openAndFocusSelected = () => {
    setOpen(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAndFocusSelected();
      if (event.key === 'ArrowDown') {
        setActiveIndex(prev => Math.min(prev + 1, options.length - 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAndFocusSelected();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(prev => (prev + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(prev => (prev - 1 + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        onChange(option.value);
        setOpen(false);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={widthClass}>
      <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72]">
        {label}
      </div>
      <div className="relative">
        <button
          id={triggerId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(v => !v)}
          onKeyDown={onTriggerKeyDown}
          className="group flex w-full items-center gap-2 rounded-xl border border-[#E5E2DB] bg-white px-3 py-2 text-left text-xs text-[#1A3A4A] shadow-sm transition hover:border-[#BCD6EA] focus:outline-none focus:ring-2 focus:ring-[#234C6A]/20"
        >
          <Filter className="h-3.5 w-3.5 shrink-0 text-[#7A7A72]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? options[0]?.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[#7A7A72] transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <div
          id={panelId}
          role="listbox"
          aria-labelledby={triggerId}
          ref={listRef}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-[#E5E2DB] bg-white p-1 shadow-[0_14px_28px_rgba(15,23,42,0.12)] transition-all duration-200 ${
            open
              ? 'pointer-events-auto translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-1 opacity-0'
          }`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isActive = idx === activeIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-option-index={idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                  isActive ? 'bg-[#E8EEF4] text-[#234C6A]' : 'text-[#1A3A4A] hover:bg-[#E8EEF4]/70'
                }`}
              >
                <span className="truncate">{option.label}</span>
                <span className="ml-2 w-4 text-right">
                  {isSelected ? <Check className="h-3.5 w-3.5 text-[#234C6A]" aria-hidden /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function FindExpertsPage({
  onViewExpert,
  followedMentorIds,
  followerCounts,
  onToggleFollow,
}: {
  onViewExpert?: (mentor: MentorCardProps) => void;
  followedMentorIds: Array<string | number>;
  followerCounts: Record<string, number>;
  onToggleFollow: (mentorId: string | number) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMajor, setSelectedMajor] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [mentors, setMentors] = useState<MentorCardProps[]>([]);
  const [keywordOptions, setKeywordOptions] = useState<Array<{ _id: string; value: string }>>([]);
  const [serviceOptions, setServiceOptions] = useState<Array<{ _id: string; value: string }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const majorOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'all', label: 'All majors' },
      ...keywordOptions.map(k => ({ value: k._id, label: k.value })),
    ],
    [keywordOptions],
  );
  const serviceDropdownOptions = useMemo<FilterOption[]>(
    () => [
      { value: 'all', label: 'All services' },
      ...serviceOptions.map(s => ({ value: s._id, label: s.value })),
    ],
    [serviceOptions],
  );

  const loadKeywordsAndServices = useCallback(async () => {
    const res: any = await doGetKeywordsAndServices();
    if (res?.keywords) {
      setKeywordOptions(
        res.keywords.map((k: any) => ({ _id: String(k._id), value: k.value || '' })),
      );
    }
    if (res?.services) {
      setServiceOptions(
        res.services.map((s: any) => ({ _id: String(s._id), value: s.value || s.name || '' })),
      );
    }
  }, []);

  const fetchExperts = useCallback(async () => {
    setLoadError(null);
    SetLoadingStatus(true);
    try {
      const keywordsPayload =
        selectedMajor !== 'all' ? [{ _id: selectedMajor }] : [];
      const servicesPayload =
        selectedService !== 'all' ? [{ _id: selectedService }] : [];
      const res: any = await doFilterExperts({
        username: searchQuery.trim(),
        keywords: keywordsPayload,
        services: servicesPayload,
        sortBy: 'Name in ASC',
      });
      if (res?.result && Array.isArray(res.result)) {
        setMentors(res.result.map(mapExpertToMentor));
      } else {
        setMentors([]);
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load experts');
      setMentors([]);
    } finally {
      SetLoadingStatus(false);
    }
  }, [searchQuery, selectedMajor, selectedService]);

  useEffect(() => {
    loadKeywordsAndServices();
  }, [loadKeywordsAndServices]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchExperts();
    }, 320);
    return () => window.clearTimeout(t);
  }, [fetchExperts]);

  const newlyJoined = mentors.filter(m => m.isNew);
  const others = mentors.filter(m => !m.isNew);

  const hasResults = mentors.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]">
      <header className="mb-6 border-b border-[#E5E2DB] pb-5">
        <h1 className="font-serif text-[2.5rem] font-medium leading-tight text-[#1A3A4A]">
          Find Experts
        </h1>
        <p className="mt-2 max-w-xl text-sm font-sans text-[#7A7A72]">
          Browse mentors for 1-on-1 sessions, seminars, and research guidance.
        </p>
      </header>

      <section className="mb-8 border-b border-[#E5E2DB] pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 border-b border-[#E5E2DB] pb-2">
              <Search className="h-4 w-4 text-[#7A7A72]" aria-hidden />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, institution, or field..."
                className="w-full bg-transparent text-sm font-sans text-[#1A3A4A] placeholder:text-[#B2AEA2] outline-none"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 md:flex-row md:justify-end md:gap-4">
            <FilterDropdown
              label="Filter by major"
              value={selectedMajor}
              options={majorOptions}
              onChange={setSelectedMajor}
              widthClass="md:w-44"
            />

            <FilterDropdown
              label="Filter by service"
              value={selectedService}
              options={serviceDropdownOptions}
              onChange={setSelectedService}
              widthClass="md:w-44"
            />
          </div>
        </div>
      </section>

      {loadError && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {loadError}
        </p>
      )}

      {!hasResults && (
        <section className="mt-16 flex flex-col items-center justify-center text-center text-[#7A7A72]">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[#E5E2DB]">
            <Search className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-serif text-lg text-[#1A3A4A]">No mentors found</h2>
          <p className="mt-1 max-w-sm text-xs font-sans text-[#7A7A72]">
            Try adjusting your search, clearing a filter, or exploring a
            different field or service.
          </p>
        </section>
      )}

      {hasResults && (
        <>
          <section className="mb-10">
            <header className="mb-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7A7A72]">
                Newly joined
              </p>
              <h2 className="mt-1 font-serif text-xl font-medium text-[#1A3A4A]">
                Fresh Expertise
              </h2>
            </header>

            <div className="md:grid md:grid-cols-2 md:gap-4 lg:gap-6 md:space-x-0 -mx-2 flex gap-4 overflow-x-auto pb-2 md:mx-0 md:overflow-visible snap-x md:snap-none">
              {newlyJoined.map(mentor => (
                <div
                  key={String(mentor.id)}
                  className="snap-start min-w-[260px] md:min-w-0 md:w-auto"
                >
                  <MentorCard
                    {...mentor}
                    followerCount={followerCounts[String(mentor.id)] ?? 0}
                    onViewProfile={onViewExpert}
                    isFollowing={followedMentorIds.some(
                      id => String(id) === String(mentor.id),
                    )}
                    onToggleFollow={onToggleFollow}
                  />
                </div>
              ))}
              {newlyJoined.length === 0 && (
                <p className="text-xs font-sans text-[#7A7A72]">
                  No newly joined mentors match your filters.
                </p>
              )}
            </div>
          </section>

          <section className="pb-10">
            <header className="mb-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7A7A72]">
                More mentors
              </p>
              <h2 className="mt-1 font-serif text-xl font-medium text-[#1A3A4A]">
                Available for Sessions
              </h2>
            </header>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {others.map(mentor => (
                <MentorCard
                  key={String(mentor.id)}
                  {...mentor}
                  compact
                  followerCount={followerCounts[String(mentor.id)] ?? 0}
                  onViewProfile={onViewExpert}
                  isFollowing={followedMentorIds.some(
                    id => String(id) === String(mentor.id),
                  )}
                  onToggleFollow={onToggleFollow}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
