import React, { useMemo, useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import MentorCard, { MentorCardProps } from '../components/MentorCard';

type Mentor = MentorCardProps;

const mentors: Mentor[] = [
  {
    id: 1,
    name: 'Dr. Emily Chen',
    title: 'Assistant Professor of Computer Science',
    institution: 'Stanford University',
    field: 'Computer Science',
    experience: '8+ yrs',
    services: ['1-on-1 session', 'Research guidance', 'Grad school mentoring'],
    image: null,
    isNew: true,
  },
  {
    id: 2,
    name: 'Prof. Daniel Ortiz',
    title: 'Senior Lecturer in Civil Engineering',
    institution: 'MIT',
    field: 'Civil Engineering',
    experience: '15+ yrs',
    services: ['1-on-1 session', 'Career planning'],
    image: null,
    isNew: true,
  },
  {
    id: 3,
    name: 'Dr. Yuki Tanaka',
    title: 'Research Scientist, AI for Healthcare',
    institution: 'Tokyo Institute of Technology',
    field: 'Biomedical Engineering',
    experience: '10+ yrs',
    services: ['Research guidance', 'Seminar'],
    image: null,
    isNew: false,
  },
  {
    id: 4,
    name: 'Sarah Johnson',
    title: 'Senior Software Engineer',
    institution: 'Google',
    field: 'Computer Science',
    experience: '7+ yrs',
    services: ['1-on-1 session', 'Career planning', 'Interview prep'],
    image: null,
    isNew: false,
  },
  {
    id: 5,
    name: 'Ahmed Hassan',
    title: 'Structural Engineer',
    institution: 'Arup',
    field: 'Civil Engineering',
    experience: '9+ yrs',
    services: ['1-on-1 session', 'Work abroad guidance'],
    image: null,
    isNew: false,
  },
];

/** Baseline follower counts (mock); parent owns state and passes counts + toggle. */
export const INITIAL_FOLLOWER_COUNTS: Record<number, number> = {
  1: 142,
  2: 89,
  3: 256,
  4: 67,
  5: 198,
};

export default function FindExpertsPage({
  onViewExpert,
  followedMentorIds,
  followerCounts,
  onToggleFollow,
}: {
  onViewExpert?: (mentor: MentorCardProps) => void;
  followedMentorIds: number[];
  followerCounts: Record<number, number>;
  onToggleFollow: (mentorId: number) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMajor, setSelectedMajor] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  const majors = useMemo(
    () => Array.from(new Set(mentors.map(m => m.field))).sort(),
    [],
  );

  const services = useMemo(
    () =>
      Array.from(
        new Set(
          mentors.flatMap(m => m.services),
        ),
      ).sort(),
    [],
  );

  const filteredMentors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mentors.filter(m => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.institution.toLowerCase().includes(q) ||
        m.field.toLowerCase().includes(q);

      const matchesMajor =
        selectedMajor === 'all' ||
        m.field.toLowerCase() === selectedMajor.toLowerCase();

      const matchesService =
        selectedService === 'all' ||
        m.services.some(
          s => s.toLowerCase() === selectedService.toLowerCase(),
        );

      return matchesSearch && matchesMajor && matchesService;
    });
  }, [searchQuery, selectedMajor, selectedService]);

  const newlyJoined = filteredMentors.filter(m => m.isNew);
  const others = filteredMentors.filter(m => !m.isNew);

  const hasResults = filteredMentors.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]">
      {/* Page header */}
      <header className="mb-6 border-b border-[#E5E2DB] pb-5">
        <h1 className="font-serif text-[2.5rem] font-medium leading-tight text-[#1A3A4A]">
          Find Experts
        </h1>
        <p className="mt-2 max-w-xl text-sm font-sans text-[#7A7A72]">
          Browse mentors for 1-on-1 sessions, seminars, and research guidance.
        </p>
      </header>

      {/* Filter bar */}
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
                  {majors.map(major => (
                    <option key={major} value={major}>
                      {major}
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
                  {services.map(service => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-[#7A7A72]" />
              </div>
            </div>
          </div>
        </div>
      </section>

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
          {/* Newly joined mentors */}
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
                  key={mentor.id}
                  className="snap-start min-w-[260px] md:min-w-0 md:w-auto"
                >
                  <MentorCard
                    {...mentor}
                    followerCount={followerCounts[mentor.id] ?? 0}
                    onViewProfile={onViewExpert}
                    isFollowing={followedMentorIds.includes(mentor.id)}
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

          {/* Other mentors */}
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
                  key={mentor.id}
                  {...mentor}
                  compact
                  followerCount={followerCounts[mentor.id] ?? 0}
                  onViewProfile={onViewExpert}
                  isFollowing={followedMentorIds.includes(mentor.id)}
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

