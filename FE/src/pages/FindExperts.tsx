import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import ExpertCard, { ExpertCardProps } from '../components/ExpertCard';
import FilterDropdown, { type FilterOption } from '../components/ui/FilterDropdown';
import { doFilterExperts, doGetKeywordsAndServices } from '../api/api';
import { serviceDropdownRowsFromApi } from '../constants/serviceOptions';
import { SetLoadingStatus } from '../actions/appActions';
import { mapExpertToMentorWithImage } from '../utils/mapExpertToMentor';

export default function FindExpertsPage({
  onViewExpert,
  followedMentorIds,
  followerCounts,
  onToggleFollow,
}: {
  onViewExpert?: (mentor: ExpertCardProps) => void;
  followedMentorIds: Array<string | number>;
  followerCounts: Record<string, number>;
  onToggleFollow: (mentorId: string | number) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMajor, setSelectedMajor] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [mentors, setMentors] = useState<ExpertCardProps[]>([]);
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
      setServiceOptions(serviceDropdownRowsFromApi(res.services));
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
        const mentors = await Promise.all(
          res.result.map((expert: any) => mapExpertToMentorWithImage(expert, 'small')),
        );
        setMentors(mentors);
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
          Browse mentors for Study Abroad, Work Abroad, and Research Guidance.
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
                  <ExpertCard
                    {...mentor}
                    followerCount={
                      followerCounts[String(mentor.id)] ?? mentor.followerCount ?? 0
                    }
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
                <ExpertCard
                  key={String(mentor.id)}
                  {...mentor}
                  compact
                  followerCount={
                    followerCounts[String(mentor.id)] ?? mentor.followerCount ?? 0
                  }
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
