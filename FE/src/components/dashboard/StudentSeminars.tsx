import React, { useMemo, useState } from 'react';
import { Search, Filter, ChevronDown, CalendarDays, Clock, MapPin } from 'lucide-react';

type Seminar = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  major: string;
  tags: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  imageUrl: string;
};

const SEMINARS: Seminar[] = [
  {
    id: 's1',
    title: 'Breaking into AI research',
    description: 'How to start publishing in ML conferences and find a research advisor.',
    date: '2024-03-22',
    time: '18:00',
    major: 'Computer Science',
    tags: ['Research', 'Grad school'],
    level: 'Intermediate',
    imageUrl:
      'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 's2',
    title: 'Designing sustainable bridges',
    description: 'Real-world case studies from structural engineers working on long-span bridges.',
    date: '2024-03-28',
    time: '16:30',
    major: 'Civil Engineering',
    tags: ['Industry', 'Work abroad'],
    level: 'Intermediate',
    imageUrl:
      'https://images.pexels.com/photos/5583970/pexels-photo-5583970.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 's3',
    title: 'Writing a winning Statement of Purpose',
    description: 'What top programs look for in SoPs and how to tell your story.',
    date: '2024-04-02',
    time: '19:00',
    major: 'Other',
    tags: ['Grad school'],
    level: 'Beginner',
    imageUrl:
      'https://images.pexels.com/photos/4145190/pexels-photo-4145190.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 's4',
    title: 'From undergrad to PhD in the US',
    description: 'Funding, applications, and picking advisors for PhD programs.',
    date: '2024-04-10',
    time: '17:30',
    major: 'Computer Science',
    tags: ['Grad school', 'Research'],
    level: 'Beginner',
    imageUrl:
      'https://images.pexels.com/photos/1181395/pexels-photo-1181395.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 's5',
    title: 'Portfolio & CV for engineering roles',
    description: 'How to present your projects and research for top-tier companies.',
    date: '2024-04-15',
    time: '15:00',
    major: 'Other Engineering',
    tags: ['Career', 'Work abroad'],
    level: 'Intermediate',
    imageUrl:
      'https://images.pexels.com/photos/1181463/pexels-photo-1181463.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
];

const USER_INTERESTS = ['Computer Science', 'Civil Engineering'];

const containerClass = 'min-h-screen bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]';

export default function StudentSeminars() {
  const [searchQuery, setSearchQuery] = useState('');
  const [majorFilter, setMajorFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const majors = useMemo(
    () => Array.from(new Set(SEMINARS.map(s => s.major))).sort(),
    [],
  );

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          SEMINARS.flatMap(s => s.tags),
        ),
      ).sort(),
    [],
  );

  const matchesFilters = (seminar: Seminar) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      seminar.title.toLowerCase().includes(q) ||
      seminar.description.toLowerCase().includes(q) ||
      seminar.major.toLowerCase().includes(q);

    const matchesMajor =
      majorFilter === 'all' ||
      seminar.major.toLowerCase() === majorFilter.toLowerCase();

    const matchesTag =
      tagFilter === 'all' ||
      seminar.tags.some(t => t.toLowerCase() === tagFilter.toLowerCase());

    return matchesSearch && matchesMajor && matchesTag;
  };

  const recommended = useMemo(
    () =>
      SEMINARS.filter(
        s =>
          USER_INTERESTS.includes(s.major) ||
          s.tags.some(t =>
            USER_INTERESTS.some(interest =>
              t.toLowerCase().includes(interest.toLowerCase().split(' ')[0]),
            ),
          ),
      ).filter(matchesFilters),
    [searchQuery, majorFilter, tagFilter],
  );

  const others = useMemo(
    () =>
      SEMINARS.filter(s => !recommended.includes(s)).filter(matchesFilters),
    [searchQuery, majorFilter, tagFilter, recommended],
  );

  const tagClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('research')) {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (t.includes('grad')) {
      return 'bg-indigo-50 text-indigo-700';
    }
    if (t.includes('career')) {
      return 'bg-amber-50 text-amber-700';
    }
    if (t.includes('work abroad')) {
      return 'bg-sky-50 text-sky-700';
    }
    if (t.includes('industry')) {
      return 'bg-rose-50 text-rose-700';
    }
    return 'bg-[#F3F4F6] text-slate-700';
  };

  const renderSeminarCard = (s: Seminar) => (
    <article
      key={s.id}
      className="group flex h-full flex-col rounded-2xl border border-[#e8e6e1] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] overflow-hidden transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(15,23,42,0.25)]"
    >
      <div className="relative h-40 w-full overflow-hidden bg-slate-200 sm:h-48">
        <img
          src={s.imageUrl}
          alt={`AI generated illustration for ${s.title}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/35 via-slate-900/5 to-transparent" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-slate-50 backdrop-blur">
          <CalendarDays className="h-3 w-3 text-emerald-300" aria-hidden />
          <span>{s.level}</span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#234C6A]">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] md:text-base font-semibold text-slate-900 leading-snug line-clamp-2">
              {s.title}
            </h3>
            <p className="mt-2 text-xs text-slate-600 line-clamp-3">
              {s.description}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
          <Clock className="h-3 w-3 text-[#234C6A]" aria-hidden />
          <span>
            {s.date} · {s.time}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
          <MapPin className="h-3 w-3 text-[#234C6A]" aria-hidden />
          <span>Online · WisdomLinked</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{s.major}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#234C6A]" />
          <span>{s.level}</span>
        </span>
      </div>
      <div className="px-5 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">
          Topics
        </p>
        <div className="flex flex-wrap gap-1.5">
          {s.tags.map(tag => (
            <span
              key={tag}
              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${tagClass(
                tag,
              )}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-auto px-5 pb-4 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
        >
          View details
        </button>
      </div>
    </article>
  );

  return (
    <div className={containerClass}>
      {/* Page header */}
      <header className="mb-6 border-b border-[#E5E2DB] pb-5">
        <h1 className="font-serif text-[2.2rem] font-medium leading-tight text-[#1A3A4A]">
          Seminars
        </h1>
        <p className="mt-2 max-w-xl text-sm font-sans text-[#7A7A72]">
          Discover upcoming sessions that match your interests, plus other
          seminars available on WisdomLinked.
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
                placeholder="Search by seminar title, description, or field…"
                className="w-full bg-transparent text-sm font-sans text-[#1A3A4A] placeholder:text-[#B2AEA2] outline-none"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:justify-end md:gap-4">
            <div className="md:w-40">
              <div className="mb-1 flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72]">
                <span>Filter by major</span>
              </div>
              <div className="relative flex items-center border-b border-[#E5E2DB] pb-1">
                <Filter className="mr-1 h-3.5 w-3.5 text-[#7A7A72]" aria-hidden />
                <select
                  value={majorFilter}
                  onChange={e => setMajorFilter(e.target.value)}
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
              <div className="mb-1 flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72]">
                <span>Filter by topic</span>
              </div>
              <div className="relative flex items-center border-b border-[#E5E2DB] pb-1">
                <Filter className="mr-1 h-3.5 w-3.5 text-[#7A7A72]" aria-hidden />
                <select
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                  className="w-full bg-transparent text-xs font-sans text-[#1A3A4A] outline-none appearance-none pr-5"
                >
                  <option value="all">All topics</option>
                  {tags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-[#7A7A72]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seminars based on interests */}
      <section className="mb-8">
        <div className="mb-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7A7A72]">
            Based on your interests
          </p>
          <h2 className="mt-1 font-serif text-xl font-medium text-[#1A3A4A]">
            Recommended seminars
          </h2>
          <p className="mt-1 text-xs font-sans text-[#7A7A72]">
            Curated from your fields like {USER_INTERESTS.join(', ')}.
          </p>
        </div>
        {recommended.length === 0 ? (
          <p className="text-xs text-slate-500">
            No seminars match your interests with the current filters.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommended.map(renderSeminarCard)}
          </div>
        )}
      </section>

      {/* Other seminars */}
      <section className="pb-8">
        <div className="mb-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7A7A72]">
            More seminars
          </p>
          <h2 className="mt-1 font-serif text-xl font-medium text-[#1A3A4A]">
            Other available sessions
          </h2>
          <p className="mt-1 text-xs font-sans text-[#7A7A72]">
            Additional sessions you can join across all fields and topics.
          </p>
        </div>
        {others.length === 0 ? (
          <p className="text-xs text-slate-500">
            No seminars match your search and filters. Try clearing a filter.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map(renderSeminarCard)}
          </div>
        )}
      </section>
    </div>
  );
}

