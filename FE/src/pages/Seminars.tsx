import React, { useMemo, useState } from 'react';
import { Search, Filter, ChevronDown, CalendarX } from 'lucide-react';
import SeminarCard, { SeminarCardProps } from '../components/SeminarCard';
import { SERVICE_LABELS } from '../constants/serviceOptions';

type Seminar = SeminarCardProps;

const seminars: Seminar[] = [
  {
    id: 1,
    title: 'Breaking into AI Research',
    description:
      'How to start publishing in ML conferences and find a research advisor.',
    date: '2024-03-22',
    time: '18:00',
    location: 'Online · WisdomLinked',
    field: 'Computer Science',
    level: 'Intermediate',
    topics: [SERVICE_LABELS[2], SERVICE_LABELS[0]],
    image: null,
    isRecommended: true,
  },
  {
    id: 2,
    title: 'Designing Sustainable Bridges',
    description:
      'Real-world case studies from structural engineers working on long-span bridges.',
    date: '2024-03-28',
    time: '16:30',
    location: 'Online · WisdomLinked',
    field: 'Civil Engineering',
    level: 'Intermediate',
    topics: [SERVICE_LABELS[1]],
    image: null,
    isRecommended: true,
  },
  {
    id: 3,
    title: 'From Undergrad to PhD in the US',
    description:
      'Funding, applications, and picking advisors for PhD programs.',
    date: '2024-04-10',
    time: '17:30',
    location: 'Online · WisdomLinked',
    field: 'Computer Science',
    level: 'Beginner',
    topics: [SERVICE_LABELS[0], SERVICE_LABELS[2]],
    image: null,
    isRecommended: true,
  },
  {
    id: 4,
    title: 'Cracking the Tech Interview',
    description:
      'Systematic approach to solving LeetCode problems and behavioral rounds.',
    date: '2024-04-15',
    time: '19:00',
    location: 'Online · WisdomLinked',
    field: 'Computer Science',
    level: 'Intermediate',
    topics: [SERVICE_LABELS[1], SERVICE_LABELS[0]],
    image: null,
    isRecommended: false,
  },
  {
    id: 5,
    title: 'Career Paths in Biomedical Engineering',
    description:
      'Industry vs research vs clinical roles — how to navigate your options.',
    date: '2024-04-20',
    time: '17:00',
    location: 'Online · WisdomLinked',
    field: 'Biomedical Engineering',
    level: 'Beginner',
    topics: [SERVICE_LABELS[1], SERVICE_LABELS[2]],
    image: null,
    isRecommended: false,
  },
  {
    id: 6,
    title: 'Working Abroad as an Engineer',
    description:
      'Visa processes, job markets, and cultural expectations in the EU and Asia.',
    date: '2024-04-25',
    time: '18:30',
    location: 'Online · WisdomLinked',
    field: 'Civil Engineering',
    level: 'Advanced',
    topics: [SERVICE_LABELS[1], SERVICE_LABELS[0]],
    image: null,
    isRecommended: false,
  },
];

export default function SeminarsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMajor, setSelectedMajor] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');

  const majors = useMemo(
    () => Array.from(new Set(seminars.map(s => s.field))).sort(),
    [],
  );

  const topics = useMemo(
    () =>
      Array.from(
        new Set(
          seminars.flatMap(s => s.topics),
        ),
      ).sort(),
    [],
  );

  const filteredSeminars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return seminars.filter(s => {
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.field.toLowerCase().includes(q);

      const matchesMajor =
        selectedMajor === 'all' ||
        s.field.toLowerCase() === selectedMajor.toLowerCase();

      const matchesTopic =
        selectedTopic === 'all' ||
        s.topics.some(t => t.toLowerCase() === selectedTopic.toLowerCase());

      return matchesSearch && matchesMajor && matchesTopic;
    });
  }, [searchQuery, selectedMajor, selectedTopic]);

  const recommended = filteredSeminars.filter(s => s.isRecommended);
  const others = filteredSeminars.filter(s => !s.isRecommended);
  const hasResults = filteredSeminars.length > 0;

  return (
    <div className="min-h-screen bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]">
      {/* Page header */}
      <header className="mb-6 border-b border-[#E5E2DB] pb-5">
        <h1 className="font-serif text-[2.5rem] font-medium leading-tight text-[#1A3A4A]">
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
                placeholder="Search by seminar title, description, or field..."
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
              <div className="mb-1 flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#7A7A72]">
                <span>Filter by topic</span>
              </div>
              <div className="relative flex items-center border-b border-[#E5E2DB] pb-1">
                <Filter className="mr-1 h-3.5 w-3.5 text-[#7A7A72]" aria-hidden />
                <select
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  className="w-full bg-transparent text-xs font-sans text-[#1A3A4A] outline-none appearance-none pr-5"
                >
                  <option value="all">All topics</option>
                  {topics.map(topic => (
                    <option key={topic} value={topic}>
                      {topic}
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
            <CalendarX className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-serif text-lg text-[#1A3A4A]">No seminars found</h2>
          <p className="mt-1 max-w-sm text-xs font-sans text-[#7A7A72]">
            Try adjusting your search, clearing a filter, or exploring a
            different topic or field.
          </p>
        </section>
      )}

      {hasResults && (
        <>
          {/* Recommended seminars */}
          <section className="mb-8">
            <header className="mb-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7A7A72]">
                Based on your interests
              </p>
              <h2 className="mt-1 font-serif text-xl font-medium text-[#1A3A4A]">
                Recommended Seminars
              </h2>
              <p className="mt-1 text-xs font-sans text-[#7A7A72]">
                Curated from your fields like Computer Science, Civil Engineering.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {recommended.map(seminar => (
                <SeminarCard key={seminar.id} {...seminar} />
              ))}
            </div>
          </section>

          {/* Other seminars */}
          <section className="pb-8">
            <header className="mb-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#7A7A72]">
                More seminars
              </p>
              <h2 className="mt-1 font-serif text-xl font-medium text-[#1A3A4A]">
                Other Available Sessions
              </h2>
              <p className="mt-1 text-xs font-sans text-[#7A7A72]">
                Additional sessions you can join across all fields and topics.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {others.map(seminar => (
                <SeminarCard key={seminar.id} {...seminar} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

