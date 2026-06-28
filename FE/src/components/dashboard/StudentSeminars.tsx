import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Filter, ChevronDown, CalendarDays, Clock, MapPin, ArrowLeft, User, Repeat, Check } from 'lucide-react';
import { useAppSelector } from '../../store';
import { registerForSeminar, doFilterSeminars, profileImageFetch } from '../../api/api';
import { canonicalLabelsFromMixedServiceEntries } from '../../constants/serviceOptions';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { SetLoadingStatus } from '../../actions/appActions';
import { updateMe } from '../../actions/authActions';
import StudentBookingCheckout from './StudentBookingCheckout';
import seminarFallbackImg from '../../assets/images/dashboard_img1.png';

type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

type Seminar = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  startMs: number;
  major: string;
  tags: string[];
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  imageUrl: string;
  expertName: string;
  location: string;
  attendees: number;
  maxAttendees: number | null;
  isFull: boolean;
  price: number;
  seriesId: string | null;
  recurrenceFrequency: RecurrenceFrequency | null;
  occurrenceCount: number;
};

const RECURRENCE_LABEL: Record<RecurrenceFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

const pad2 = (n: number) => String(n).padStart(2, '0');

function groupSeminarSeries(list: Seminar[]): Seminar[] {
  const now = Date.now();
  const bySeries = new Map<string, Seminar[]>();
  const singles: Seminar[] = [];
  for (const s of list) {
    if (s.seriesId) {
      const arr = bySeries.get(s.seriesId) || [];
      arr.push(s);
      bySeries.set(s.seriesId, arr);
    } else {
      singles.push(s);
    }
  }
  const reps: Seminar[] = [];
  bySeries.forEach((arr) => {
    const sorted = [...arr].sort((a, b) => a.startMs - b.startMs);
    const rep = sorted.find((x) => x.startMs >= now) || sorted[0];
    reps.push({ ...rep, occurrenceCount: arr.length });
  });
  return [...reps, ...singles];
}

/** Map a BE seminar (GroupChat of type 'seminar') to the card's Seminar shape. */
async function mapSeminar(g: any): Promise<Seminar> {
  const start = g?.start ? new Date(g.start) : null;
  const hasStart = start && !Number.isNaN(start.getTime());
  const keywords = (g?.keywords || []).map((k: any) => k?.value).filter(Boolean);
  const serviceLabels = canonicalLabelsFromMixedServiceEntries(g?.services);
  // Prefer the seminar's own cover image; only fall back to the host's photo when absent.
  const image = g?.image
    ? String(g.image)
    : await resolveProfileImageSrc(g?.admin?.image, 'small', profileImageFetch);
  const freq = g?.recurrenceFrequency;
  // Enrolled students exclude the host (the admin is always a participant).
  const participantCount = Array.isArray(g?.participants) ? g.participants.length : 0;
  const enrolled = Math.max(0, participantCount - 1);
  const maxAttendees = typeof g?.maxAttendees === 'number' ? g.maxAttendees : null;
  return {
    id: String(g?._id),
    title: g?.name || 'Seminar',
    description: g?.description || 'Live seminar on WisdomLinked.',
    date: hasStart
      ? `${start!.getFullYear()}-${pad2(start!.getMonth() + 1)}-${pad2(start!.getDate())}`
      : 'TBD',
    time: hasStart ? `${pad2(start!.getHours())}:${pad2(start!.getMinutes())}` : '',
    startMs: hasStart ? start!.getTime() : Number.MAX_SAFE_INTEGER,
    major: keywords[0] || 'General',
    tags: serviceLabels.length ? serviceLabels : keywords.length ? keywords : ['Seminar'],
    imageUrl: image || seminarFallbackImg,
    expertName: g?.admin?.username || g?.admin?.email || 'WisdomLinked expert',
    location: 'Online · WisdomLinked',
    attendees: enrolled,
    maxAttendees,
    isFull: maxAttendees != null && maxAttendees > 0 && enrolled >= maxAttendees,
    price: typeof g?.price === 'number' ? g.price : 0,
    seriesId: g?.seriesId ? String(g.seriesId) : null,
    recurrenceFrequency:
      g?.isRecurring && (freq === 'weekly' || freq === 'biweekly' || freq === 'monthly')
        ? freq
        : null,
    occurrenceCount: 1,
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
  const [checkout, setCheckout] = useState<'review' | 'pay' | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const dispatch = useDispatch();

  // Seminars the student is already enrolled in (confirmed participants live in
  // groupChats). Used to stop re-booking the same seminar.
  const mySeminarStatus = useMemo(() => {
    const booked = new Set<string>();
    (userDetails?.groupChats || []).forEach((g: any) => {
      if (g?.type === 'seminar' && g?._id) booked.add(String(g._id));
    });
    return { booked };
  }, [userDetails?.groupChats]);

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
  // for free seminars, where the checkout calls back with '0'). Enrollment is
  // immediate — no host approval — and covers the whole recurring series.
  const joinSeminar = async (paymentIntentId: string) => {
    if (!selectedSeminar) return;
    SetLoadingStatus(true);
    setBookingError(null);
    try {
      const response: any = await registerForSeminar({
        groupChatId: selectedSeminar.id,
        payment_intent: paymentIntentId,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        setBookingError(response?.error || 'Could not complete seminar registration.');
        return;
      }
      dispatch(updateMe() as any);
      setCheckout(null);
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
    setCheckout(null);
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

  const groupedSeminars = useMemo(() => groupSeminarSeries(seminars), [seminars]);

  const majors = useMemo(
    () => Array.from(new Set(groupedSeminars.map(s => s.major))).sort(),
    [groupedSeminars],
  );

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          groupedSeminars.flatMap(s => s.tags),
        ),
      ).sort(),
    [groupedSeminars],
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
        : groupedSeminars
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
    [groupedSeminars, userInterests, searchQuery, majorFilter, tagFilter],
  );

  const others = useMemo(
    () =>
      groupedSeminars.filter(s => !recommended.includes(s)).filter(matchesFilters),
    [groupedSeminars, searchQuery, majorFilter, tagFilter, recommended],
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

  // True when the student is enrolled in this seminar — for a
  // recurring series, any booked occurrence counts so the card reflects it.
  const seminarRegistered = (s: Seminar): boolean => {
    if (s.seriesId) {
      return seminars.some(
        x => x.seriesId === s.seriesId && mySeminarStatus.booked.has(x.id),
      );
    }
    return mySeminarStatus.booked.has(s.id);
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
        {s.recurrenceFrequency && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#234C6A]/90 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            <Repeat className="h-3 w-3" aria-hidden />
            <span>{RECURRENCE_LABEL[s.recurrenceFrequency]}</span>
          </div>
        )}
        {seminarRegistered(s) && (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <Check className="h-3 w-3" aria-hidden />
            <span>Registered</span>
          </div>
        )}
        {!seminarRegistered(s) && s.isFull && (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-rose-600/95 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <span>Full</span>
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
            {s.recurrenceFrequency ? 'Next: ' : ''}{s.date} · {s.time}
          </span>
        </span>
        {s.recurrenceFrequency && s.occurrenceCount > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-1 text-[#234C6A]">
            <Repeat className="h-3 w-3" aria-hidden />
            <span>{RECURRENCE_LABEL[s.recurrenceFrequency]} · {s.occurrenceCount} sessions</span>
          </span>
        )}
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
    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const pastBySameExpert = seminars
      .filter(item => item.expertName === s.expertName && item.id !== s.id)
      .slice(0, 3);

    const alreadyRegistered = mySeminarStatus.booked.has(s.id) || bookingDone;
    const isFull = s.isFull && !alreadyRegistered;

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
              {s.recurrenceFrequency && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-3 py-1 text-[12px] font-medium text-[#234C6A]">
                  <Repeat className="h-3.5 w-3.5" aria-hidden />
                  Repeats {RECURRENCE_LABEL[s.recurrenceFrequency].toLowerCase()}
                </span>
              )}
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
                  <span className="text-[#7A7A72]">{s.time} · {viewerTz}</span>
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

            {s.recurrenceFrequency && (
              <p className="mt-2 text-xs text-[#7A7A72]">
                Registering enrolls you in every session of this recurring series.
              </p>
            )}

            {alreadyRegistered ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-900">
                  You're enrolled in this seminar.
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  It’s on your calendar — join from your seminars or calendar.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-[#7A7A72]">Seminar schedule</p>
                  <div className="rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#1A3A4A]">
                      <CalendarDays className="h-4 w-4 text-[#234C6A]" aria-hidden />
                      <span>{s.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#7A7A72]">
                      <Clock className="h-4 w-4 text-[#234C6A]" aria-hidden />
                      <span>{s.time} · {viewerTz}</span>
                    </div>
                  </div>
                </div>
                {isFull ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                      Seminar full
                    </span>
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-[4px] bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-500"
                    >
                      Seminar is full
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCheckout('review')}
                    className="w-full rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                  >
                    {s.price > 0 ? 'Continue to payment' : 'Confirm booking'}
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>

        {checkout === 'review' ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
            onClick={e => {
              if (e.target === e.currentTarget) setCheckout(null);
            }}
          >
            <div className="my-auto w-full max-w-md">
              <div className="rounded-2xl border border-[#E5E2DB] bg-white p-4 sm:p-6 space-y-4">
                <p className="font-serif text-lg font-medium text-[#1A3A4A]">Review your booking</p>
                <dl className="space-y-2 text-sm text-[#1A3A4A]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7A7A72]">Seminar</dt>
                    <dd className="font-semibold text-right">{s.title}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7A7A72]">Host</dt>
                    <dd className="font-semibold text-right">{s.expertName}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7A7A72]">Date</dt>
                    <dd className="font-semibold text-right">{s.date}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#7A7A72]">Time</dt>
                    <dd className="text-right text-[#7A7A72]">{s.time} · {viewerTz}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-[#E5E2DB] pt-2">
                    <dt className="text-[#7A7A72]">Total</dt>
                    <dd className="font-serif text-lg font-semibold">${s.price.toFixed(2)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setCheckout('pay')}
                  className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635]"
                >
                  {s.price > 0 ? 'Continue to payment' : 'Confirm booking'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {checkout === 'pay' ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
            onClick={e => {
              if (e.target === e.currentTarget) setCheckout('review');
            }}
          >
            <div className="my-auto w-full max-w-2xl space-y-3">
              <StudentBookingCheckout
                type="Seminar"
                price={s.price}
                returnUrl={seminarReturnUrl}
                pendingDetails={{ groupChatId: s.id, price: s.price, name: s.title }}
                onPaymentSuccess={joinSeminar}
                onCancel={() => setCheckout('review')}
                cancelLabel="Back"
              />
              {bookingError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {bookingError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
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
