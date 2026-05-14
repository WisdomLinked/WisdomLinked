import React, { useMemo, useState } from 'react';
import { Search, Filter, ChevronDown, CalendarDays, Clock, MapPin, ArrowLeft, User } from 'lucide-react';
import { SERVICE_LABELS } from '../../constants/serviceOptions';

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
  expertName: string;
  location: string;
  attendees: number;
};

const SEMINARS: Seminar[] = [
  {
    id: 's1',
    title: 'Breaking into AI research',
    description: 'How to start publishing in ML conferences and find a research advisor.',
    date: '2024-03-22',
    time: '18:00',
    major: 'Computer Science',
    tags: [SERVICE_LABELS[2], SERVICE_LABELS[0]],
    level: 'Intermediate',
    expertName: 'Prof. Emily Chen',
    location: 'Online · WisdomLinked Hall A',
    attendees: 84,
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
    tags: [SERVICE_LABELS[1]],
    level: 'Intermediate',
    expertName: 'Prof. Daniel Ortiz',
    location: 'Online · WisdomLinked Hall B',
    attendees: 61,
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
    tags: [SERVICE_LABELS[0]],
    level: 'Beginner',
    expertName: 'Dr. Sarah Williams',
    location: 'Online · WisdomLinked Hall C',
    attendees: 47,
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
    tags: [SERVICE_LABELS[0], SERVICE_LABELS[2]],
    level: 'Beginner',
    expertName: 'Dr. Liam Carter',
    location: 'Online · WisdomLinked Hall D',
    attendees: 73,
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
    tags: [SERVICE_LABELS[1], SERVICE_LABELS[2]],
    level: 'Intermediate',
    expertName: 'Prof. Aisha Rahman',
    location: 'Online · WisdomLinked Hall E',
    attendees: 58,
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
  const [selectedSeminar, setSelectedSeminar] = useState<Seminar | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [bookingDone, setBookingDone] = useState(false);

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
      role="button"
      tabIndex={0}
      onClick={() => {
        setSelectedSeminar(s);
        setBookingStep(1);
        setSelectedTime(s.time);
        setBookingDone(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedSeminar(s);
          setBookingStep(1);
          setSelectedTime(s.time);
          setBookingDone(false);
        }
      }}
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
          onClick={e => {
            e.stopPropagation();
            setSelectedSeminar(s);
            setBookingStep(1);
            setSelectedTime(s.time);
            setBookingDone(false);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-[#234C6A] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
        >
          View details
        </button>
      </div>
    </article>
  );

  if (selectedSeminar) {
    const s = selectedSeminar;
    const timeOptions = [s.time, '17:30', '19:00'];
    const pastBySameExpert = SEMINARS.filter(
      item => item.expertName === s.expertName && item.id !== s.id,
    ).slice(0, 3);

    return (
      <div className={containerClass}>
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setSelectedSeminar(null)}
            className="inline-flex items-center gap-2 rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to seminars
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-[#E5E2DB] bg-white overflow-hidden">
            <div className="h-64 w-full bg-slate-200 sm:h-80">
              <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover" />
            </div>
            <div className="p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Seminar details
              </p>
              <h1 className="mt-2 font-serif text-[1.8rem] leading-tight text-[#1A3A4A]">
                {s.title}
              </h1>
              <div className="mt-3 rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                  Seminar description
                </p>
                <p className="mt-1 text-sm text-[#7A7A72]">{s.description}</p>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 text-[12px] text-slate-700">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                  <User className="h-4 w-4 text-[#234C6A]" aria-hidden />
                  <span>{s.expertName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                  <CalendarDays className="h-4 w-4 text-[#234C6A]" aria-hidden />
                  <span>{s.date}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                  <Clock className="h-4 w-4 text-[#234C6A]" aria-hidden />
                  <span>{selectedTime}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                  <MapPin className="h-4 w-4 text-[#234C6A]" aria-hidden />
                  <span>{s.location}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{s.attendees} attendees</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                  Past seminars by {s.expertName}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {pastBySameExpert.length > 0 ? (
                    pastBySameExpert.map(item => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-[#E5E2DB] bg-white px-3 py-2"
                      >
                        <p className="text-[12px] font-semibold text-[#1A3A4A]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] text-[#7A7A72]">
                          {item.date} · {item.attendees} attendees
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-[#E5E2DB] bg-white px-3 py-2 text-[11px] text-[#7A7A72]">
                      No past seminars listed for this expert yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-[#E5E2DB] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
              Book session
            </p>
            <h2 className="mt-2 font-serif text-xl text-[#1A3A4A]">Booking flow</h2>

            {!bookingDone ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 text-[12px] text-[#1A3A4A]">
                  Step {bookingStep} of 3
                </div>

                {bookingStep === 1 && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#7A7A72]">
                      Review seminar and continue to slot selection.
                    </p>
                    <button
                      type="button"
                      onClick={() => setBookingStep(2)}
                      className="w-full rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {bookingStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#7A7A72]">Select preferred time</p>
                    <div className="grid grid-cols-1 gap-2">
                      {timeOptions.map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedTime(option)}
                          className={`rounded-[4px] border px-3 py-2 text-left text-sm font-semibold ${
                            selectedTime === option
                              ? 'border-[#234C6A] bg-[#E8EEF4] text-[#234C6A]'
                              : 'border-[#E5E2DB] bg-white text-slate-700'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingStep(1)}
                        className="flex-1 rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingStep(3)}
                        className="flex-1 rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {bookingStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#7A7A72]">
                      Confirm your booking request. Payment flow will be handled next.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem(
                          'pendingDetails',
                          JSON.stringify({
                            friendIds: [],
                            groupChatId: s.id,
                            price: 0,
                            seminarTitle: s.title,
                            seminarTime: selectedTime,
                          }),
                        );
                        setBookingDone(true);
                      }}
                      className="w-full rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Book now
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-900">
                  Booking request saved.
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  Seminar seat requested successfully. Payment flow can be completed next.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }

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

