import React, { useMemo, useState } from 'react';
import { Search, GraduationCap, Briefcase, MapPin, Filter, ChevronDown } from 'lucide-react';
import { SERVICE_LABELS } from '../../constants/serviceOptions';

type Mentor = {
  id: string;
  name: string;
  title: string;
  institution: string;
  yearsExperience: number;
  major: string;
  services: string[];
  isNew: boolean;
  photoUrl: string;
};

const MENTORS: Mentor[] = [
  {
    id: '1',
    name: 'Dr. Emily Chen',
    title: 'Assistant Professor of Computer Science',
    institution: 'Stanford University',
    yearsExperience: 8,
    major: 'Computer Science',
    services: [SERVICE_LABELS[0], SERVICE_LABELS[2]],
    isNew: true,
    photoUrl:
      'https://images.pexels.com/photos/1704488/pexels-photo-1704488.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: '2',
    name: 'Prof. Daniel Ortiz',
    title: 'Senior Lecturer in Civil Engineering',
    institution: 'MIT',
    yearsExperience: 15,
    major: 'Civil Engineering',
    services: [SERVICE_LABELS[1]],
    isNew: true,
    photoUrl:
      'https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: '3',
    name: 'Dr. Yuki Tanaka',
    title: 'Research Scientist, AI for Healthcare',
    institution: 'Tokyo Institute of Technology',
    yearsExperience: 10,
    major: 'Biomedical Engineering',
    services: [SERVICE_LABELS[2]],
    isNew: false,
    photoUrl:
      'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: '4',
    name: 'Sarah Johnson',
    title: 'Senior Software Engineer',
    institution: 'Google',
    yearsExperience: 7,
    major: 'Computer Science',
    services: [SERVICE_LABELS[0], SERVICE_LABELS[1]],
    isNew: false,
    photoUrl:
      'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: '5',
    name: 'Ahmed Hassan',
    title: 'Structural Engineer',
    institution: 'Arup',
    yearsExperience: 9,
    major: 'Civil Engineering',
    services: [SERVICE_LABELS[1]],
    isNew: false,
    photoUrl:
      'https://images.pexels.com/photos/1181715/pexels-photo-1181715.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

const containerClass = 'h-[calc(100vh-56px)] overflow-y-auto px-6 py-7';

export default function FindExperts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [majorFilter, setMajorFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  const majors = useMemo(
    () => Array.from(new Set(MENTORS.map(m => m.major))).sort(),
    [],
  );

  const services = useMemo(
    () =>
      Array.from(
        new Set(
          MENTORS.flatMap(m => m.services),
        ),
      ).sort(),
    [],
  );

  const matchesFilters = (mentor: Mentor) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      mentor.name.toLowerCase().includes(q) ||
      mentor.title.toLowerCase().includes(q) ||
      mentor.institution.toLowerCase().includes(q);

    const matchesMajor =
      majorFilter === 'all' || mentor.major.toLowerCase() === majorFilter.toLowerCase();

    const matchesService =
      serviceFilter === 'all' ||
      mentor.services.some(s => s.toLowerCase() === serviceFilter.toLowerCase());

    return matchesSearch && matchesMajor && matchesService;
  };

  const newMentors = useMemo(
    () => MENTORS.filter(m => m.isNew).filter(matchesFilters),
    [searchQuery, majorFilter, serviceFilter],
  );

  const otherMentors = useMemo(
    () => MENTORS.filter(m => !m.isNew).filter(matchesFilters),
    [searchQuery, majorFilter, serviceFilter],
  );

  const serviceClass = (service: string) => {
    const s = service.toLowerCase();
    if (s.includes('research')) {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (s.includes('grad')) {
      return 'bg-indigo-50 text-indigo-700';
    }
    if (s.includes('career')) {
      return 'bg-amber-50 text-amber-700';
    }
    if (s.includes('work abroad')) {
      return 'bg-sky-50 text-sky-700';
    }
    if (s.includes('interview')) {
      return 'bg-rose-50 text-rose-700';
    }
    if (s.includes('seminar')) {
      return 'bg-teal-50 text-teal-700';
    }
    return 'bg-[#F3F4F6] text-slate-700';
  };

  const renderMentorCard = (mentor: Mentor) => (
    <article
      key={mentor.id}
      className="group flex flex-col rounded-2xl border border-[#e8e6e1] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.15)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_18px_55px_rgba(15,23,42,0.22)]"
    >
      <div className="flex items-stretch gap-4">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A] font-semibold text-sm">
              {mentor.name
                .split(' ')
                .map(p => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] md:text-base font-semibold text-slate-900 leading-snug line-clamp-2">
                  {mentor.name}
                </h3>
                {mentor.isNew && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    New
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-slate-700 line-clamp-2">
                {mentor.title}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <MapPin className="h-3 w-3" aria-hidden />
                <span className="truncate">{mentor.institution}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
              <GraduationCap className="h-3 w-3 text-[#234C6A]" aria-hidden />
              <span>{mentor.major}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
              <Briefcase className="h-3 w-3 text-[#234C6A]" aria-hidden />
              <span>{mentor.yearsExperience}+ yrs experience</span>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
              Provides
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mentor.services.map(service => (
                <span
                  key={service}
                  className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${serviceClass(
                    service,
                  )}`}
                >
                  {service}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex w-24 md:w-28 shrink-0 items-center justify-center">
          <div className="relative h-24 w-24 md:h-28 md:w-28 overflow-hidden rounded-2xl bg-slate-100">
            <img
              src={mentor.photoUrl}
              alt={`AI generated headshot of ${mentor.name}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
        >
          View profile
        </button>
      </div>
    </article>
  );

  return (
    <div className={containerClass}>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Find experts
        </h1>
        <p className="text-sm text-slate-500">
          Browse mentors for 1-1 sessions, seminars, and research guidance.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
              Search
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by mentor name, institution, or field…"
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-wrap gap-3 md:pl-4">
            <div className="flex-1 min-w-[140px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
                Filter by major
              </p>
              <div className="relative inline-flex w-full items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden />
                <select
                  value={majorFilter}
                  onChange={e => setMajorFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none pr-5 appearance-none cursor-pointer w-full"
                >
                  <option value="all">All majors</option>
                  {majors.map(major => (
                    <option key={major} value={major}>
                      {major}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
              </div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
                Filter by service
              </p>
              <div className="relative inline-flex w-full items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden />
                <select
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none pr-5 appearance-none cursor-pointer w-full"
                >
                  <option value="all">All services</option>
                  {services.map(service => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Newly joined mentors
            </h2>
            <p className="text-xs text-slate-500">
              Experts who recently joined WisdomLinked.
            </p>
          </div>
        </div>
        {newMentors.length === 0 ? (
          <p className="text-xs text-slate-500">
            No newly joined mentors match your filters.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {newMentors.map(renderMentorCard)}
          </div>
        )}
      </section>

      <section className="pb-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Other available mentors
            </h2>
            <p className="text-xs text-slate-500">
              More experts available for sessions and seminars.
            </p>
          </div>
        </div>
        {otherMentors.length === 0 ? (
          <p className="text-xs text-slate-500">
            No mentors match your search and filters. Try clearing a filter.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {otherMentors.map(renderMentorCard)}
          </div>
        )}
      </section>
    </div>
  );
}

