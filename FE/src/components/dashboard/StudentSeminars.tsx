import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Filter, ChevronDown, CalendarDays, Clock, MapPin, ArrowLeft, User } from 'lucide-react';
import { useAppSelector } from '../../store';
import { addMemberToPendingGroup, doFilterSeminars, profileImageFetch } from '../../api/api';
import { canonicalLabelsFromMixedServiceEntries } from '../../constants/serviceOptions';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { SetLoadingStatus } from '../../actions/appActions';
import StudentBookingCheckout from './StudentBookingCheckout';
import seminarFallbackImg from '../../assets/images/dashboard_img1.png';

type Seminar = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  major: string;
  tags: string[];
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  imageUrl: string;
  expertName: string;
  location: string;
  attendees: number;
  price: number;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Map a BE seminar (GroupChat of type 'seminar') to the card's Seminar shape. */
async function mapSeminar(g: any): Promise<Seminar> {
  const start = g?.start ? new Date(g.start) : null;
  const hasStart = start && !Number.isNaN(start.getTime());
  const keywords = (g?.keywords || []).map((k: any) => k?.value).filter(Boolean);
  const serviceLabels = canonicalLabelsFromMixedServiceEntries(g?.services);
  const image = await resolveProfileImageSrc(g?.admin?.image, 'small', profileImageFetch);
  return {
    id: String(g?._id),
    title: g?.name || 'Seminar',
    description: g?.description || 'Live seminar on WisdomLinked.',
    date: hasStart
      ? `${start!.getFullYear()}-${pad2(start!.getMonth() + 1)}-${pad2(start!.getDate())}`
      : 'TBD',
    time: hasStart ? `${pad2(start!.getHours())}:${pad2(start!.getMinutes())}` : '',
    major: keywords[0] || 'General',
    tags: serviceLabels.length ? serviceLabels : keywords.length ? keywords : ['Seminar'],
    imageUrl: image || seminarFallbackImg,
    expertName: g?.admin?.username || g?.admin?.email || 'WisdomLinked expert',
    location: 'Online · WisdomLinked',
    attendees: Array.isArray(g?.participants) ? g.participants.length : 0,
    price: typeof g?.price === 'number' ? g.price : 0,
  };
}

const containerClass = 'min-h-screen bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]';

export default function StudentSeminars() {
  const { auth: { userDetails } } = useAppSelector((state: any) => state);
  const userInterests = useMemo(
    () => (userDetails?.keywords || []).map((k: any) => k?.value).filter(Boolean),
    [userDetails?.keywords],
  );

  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [majorFilter, setMajorFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [selectedSeminar, setSelectedSeminar] = useState<Seminar | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const dispatch = useDispatch();

  // Stripe (3DS) redirects back here; the dashboard finalizes the booking via
  // the shared pendingDetails contract. Mirror ExpertProfile's return URL so we
  // land back on the current dashboard page with the booking-return flag set.
  const seminarReturnUrl = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('student_booking', '1');
      return url.toString();
    } catch {
      return '/user/studentdashboard?student_booking=1';
    }
  }, []);

  // Register the student for the seminar once Stripe confirms (or immediately
  // for free seminars, where the checkout calls back with '0').
  const joinSeminar = async (paymentIntentId: string) => {
    if (!selectedSeminar) return;
    SetLoadingStatus(true);
    setBookingError(null);
    try {
      const response: any = await addMemberToPendingGroup({
        groupChatId: selectedSeminar.id,
        price: selectedSeminar.price,
        payment_intent: paymentIntentId,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        setBookingError(response?.error || 'Could not complete seminar registration.');
        return;
      }
      if (response?.pendingGroupChats) {
        dispatch({
          type: 'updateUserDetails',
          payload: { pendingGroupChats: response.pendingGroupChats },
        });
      }
      setPaying(false);
      setBookingDone(true);
    } catch (err: unknown) {
      setBookingError(
        err instanceof Error ? err.message : 'Could not complete seminar registration.',
      );
    } finally {
      SetLoadingStatus(false);
    }
  };

  // Open a seminar's detail/booking view from a fresh state.
  const openSeminar = (s: Seminar) => {
    setSelectedSeminar(s);
    setBookingStep(1);
    setSelectedTime(s.time);
    setPaying(false);
    setBookingDone(false);
    setBookingError(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res: any = await doFilterSeminars({
          name: '',
          keywords: [],
          services: [],
          sortBy: 'Name in ASC',
        });
        const list = Array.isArray(res?.result) ? res.result : [];
        const mapped = await Promise.all(list.map(mapSeminar));
        if (!cancelled) setSeminars(mapped);
      } catch {
        if (!cancelled) setSeminars([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const majors = useMemo(
    () => Array.from(new Set(seminars.map(s => s.major))).sort(),
    [seminars],
  );

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          seminars.flatMap(s => s.tags),
        ),
      ).sort(),
    [seminars],
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
      userInterests.length === 0
        ? []
        : seminars
            .filter(
              s =>
                userInterests.includes(s.major) ||
                s.tags.some(t =>
                  userInterests.some((interest: string) =>
                    t.toLowerCase().includes(interest.toLowerCase().split(' ')[0]),
                  ),
                ),
            )
            .filter(matchesFilters),
    [seminars, userInterests, searchQuery, majorFilter, tagFilter],
  );

  const others = useMemo(
    () =>
      seminars.filter(s => !recommended.includes(s)).filter(matchesFilters),
    [seminars, searchQuery, majorFilter, tagFilter, recommended],
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
      onClick={() => openSeminar(s)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openSeminar(s);
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
        {s.level && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-slate-50 backdrop-blur">
            <CalendarDays className="h-3 w-3 text-emerald-300" aria-hidden />
            <span>{s.level}</span>
          </div>
        )}
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
        {s.level && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#234C6A]" />
            <span>{s.level}</span>
          </span>
        )}
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
            openSeminar(s);
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
    const timeOptions = s.time ? [s.time] : [];
    const pastBySameExpert = seminars
      .filter(item => item.expertName === s.expertName && item.id !== s.id)
      .slice(0, 3);

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

            {bookingDone ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-900">
                  You&apos;re registered for this seminar.
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  It will appear on your calendar once the host confirms.
                </p>
              </div>
            ) : paying ? (
              <div className="mt-4 space-y-3">
                <StudentBookingCheckout
                  type="Seminar"
                  price={s.price}
                  returnUrl={seminarReturnUrl}
                  pendingDetails={{ groupChatId: s.id, price: s.price, name: s.title }}
                  onPaymentSuccess={joinSeminar}
                  onCancel={() => setPaying(false)}
                />
                {bookingError ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {bookingError}
                  </p>
                ) : null}
              </div>
            ) : (
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
                      {s.price > 0
                        ? `Confirm and pay $${s.price.toFixed(2)} to reserve your seat.`
                        : 'Confirm to reserve your seat — this seminar is free.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingStep(2)}
                        className="flex-1 rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaying(true)}
                        className="flex-1 rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                      >
                        {s.price > 0 ? 'Continue to payment' : 'Confirm booking'}
                      </button>
                    </div>
                  </div>
                )}
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
            {userInterests.length
              ? `Curated from your fields like ${userInterests.join(', ')}.`
              : 'Add fields of interest to your profile to get personalized recommendations.'}
          </p>
        </div>
        {loading ? (
          <p className="text-xs text-slate-500">Loading seminars…</p>
        ) : recommended.length === 0 ? (
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
        {loading ? (
          <p className="text-xs text-slate-500">Loading seminars…</p>
        ) : others.length === 0 ? (
          <p className="text-xs text-slate-500">
            No seminars available right now. Check back soon.
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

