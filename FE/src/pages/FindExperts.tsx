import React, { useCallback, useEffect, useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
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
            <div className="md:w-40">
              <div className="flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72] mb-1">
                <span>Filter by major</span>
              </div>
              <div className="relative flex items-center border-b border-[#E5E2DB] pb-1">
                <Filter className="mr-1 h-3.5 w-3.5 text-[#7A7A72]" aria-hidden />
                <select
                  value={selectedMajor}
                  onChange={e => setSelectedMajor(e.target.value)}
                  className="w-full bg-transparent text-xs font-sans text-[#1A3A4A] outline-none appearance-none pr-5"
                >
                  <option value="all">All majors</option>
                  {keywordOptions.map(k => (
                    <option key={k._id} value={k._id}>
                      {k.value}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-[#7A7A72]" />
              </div>
            </div>

            <div className="md:w-44">
              <div className="flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72] mb-1">
                <span>Filter by service</span>
              </div>
              <div className="relative flex items-center border-b border-[#E5E2DB] pb-1">
                <Filter className="mr-1 h-3.5 w-3.5 text-[#7A7A72]" aria-hidden />
                <select
                  value={selectedService}
                  onChange={e => setSelectedService(e.target.value)}
                  className="w-full bg-transparent text-xs font-sans text-[#1A3A4A] outline-none appearance-none pr-5"
                >
                  <option value="all">All services</option>
                  {serviceOptions.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.value}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-[#7A7A72]" />
              </div>
            </div>
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
