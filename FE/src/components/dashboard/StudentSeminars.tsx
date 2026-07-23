import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, CalendarDays, Clock, MapPin, ArrowLeft, User, Users, Repeat, Check, MessageSquare } from 'lucide-react';
import FilterDropdown, { type FilterOption } from '../ui/FilterDropdown';
import { useAppSelector } from '../../store';
import { registerForSeminar, requestSeminarSeat, doFilterSeminars, profileImageFetch, doGetKeywordsAndServices, getExpertById } from '../../api/api';
import { canonicalLabelsFromMixedServiceEntries } from '../../constants/serviceOptions';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { seminarCapacityLabel } from '../../utils/seminarCapacityLabel';
import { SetLoadingStatus } from '../../actions/appActions';
import { updateMe } from '../../actions/authActions';
import StudentBookingCheckout from './StudentBookingCheckout';
import { usePeerProfileModal } from '../../hooks/usePeerProfileModal';
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
  majors: string[];
  services: string[];
  tags: string[];
  searchTags: string[];
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  imageUrl: string;
  expertName: string;
  expertId: string;
  expertImage: string | null;
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

// 12-hour clock with an AM/PM suffix, e.g. "12:00AM", "1:30PM".
const to12h = (d: Date) => {
  const h = d.getHours();
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(d.getMinutes())}${period}`;
};

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
  // The host's free-text "Other purpose" — a service/topic not in the preset list.
  // Surfaced alongside the picked services in the Topics row.
  const purposeOther = typeof g?.purposeOther === 'string' ? g.purposeOther.trim() : '';
  const topicLabels = purposeOther ? [...serviceLabels, purposeOther] : serviceLabels;
  // The host's own freeform tags (persisted on the seminar). Kept separate from the
  // service-derived "Topics" row: they only widen search, they don't replace Topics.
  const freeformTags = Array.isArray(g?.tags)
    ? g.tags.filter((t: any) => typeof t === 'string' && t.trim())
    : [];
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
    time: hasStart ? to12h(start!) : '',
    startMs: hasStart ? start!.getTime() : Number.MAX_SAFE_INTEGER,
    major: keywords[0] || 'General',
    majors: keywords,
    services: topicLabels,
    tags: topicLabels.length ? topicLabels : keywords.length ? keywords : ['Seminar'],
    searchTags: freeformTags,
    imageUrl: image || seminarFallbackImg,
    expertName: g?.admin?.username || g?.admin?.email || 'WisdomLinked expert',
    expertId: g?.admin?._id != null ? String(g.admin._id) : '',
    expertImage: g?.admin?.image ?? null,
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

export default function StudentSeminars({
  onEnterSeminarChat,
}: {
  onEnterSeminarChat?: (seminarId: string) => void;
} = {}) {
  const { auth: { userDetails } } = useAppSelector((state: any) => state);
  const userInterests = useMemo(
    () => (userDetails?.keywords || []).map((k: any) => k?.value).filter(Boolean),
    [userDetails?.keywords],
  );

  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [catalogMajors, setCatalogMajors] = useState<string[]>([]);
  const [catalogTopics, setCatalogTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [majorFilter, setMajorFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [selectedSeminar, setSelectedSeminar] = useState<Seminar | null>(null);
  const [pastSeminars, setPastSeminars] = useState<
    Array<{ id: string; title: string; date: string; attendees: number }>
  >([]);
  const [checkout, setCheckout] = useState<'review' | 'pay' | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [seatRequested, setSeatRequested] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const { openPeerProfile, peerProfileModal } = usePeerProfileModal(userDetails?.role);

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
  const joinSeminar = async (
    paymentIntentId: string,
    opts?: { requiresApproval?: boolean },
  ) => {
    if (!selectedSeminar) return;
    SetLoadingStatus(true);
    setBookingError(null);
    try {
      // A full seminar admits students only via host approval: the checkout has
      // authorized (held) the fee, and we record a seat request instead of enrolling.
      if (opts?.requiresApproval) {
        const response: any = await requestSeminarSeat({
          groupChatId: selectedSeminar.id,
          payment_intent: paymentIntentId,
        });
        if (response === false || response?.status === 'FAIL' || response?.error) {
          setBookingError(response?.error || 'Could not submit your seat request.');
          return;
        }
        setCheckout(null);
        setSeatRequested(true);
        return;
      }
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
    setSeatRequested(false);
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

  useEffect(() => {
    const expertId = selectedSeminar?.expertId;
    const viewingId = selectedSeminar?.id;
    if (!expertId) {
      setPastSeminars([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res: any = await getExpertById(expertId);
        const chats = Array.isArray(res?.result?.groupChats) ? res.result.groupChats : [];
        const now = Date.now();
        const past = chats
          .filter(
            (g: any) =>
              g?.type === 'seminar' && g?.status !== 'draft' && g?.status !== 'cancelled',
          )
          .map((g: any) => {
            const start = g?.start ? new Date(g.start).getTime() : NaN;
            const enrolled = Math.max(
              0,
              (Array.isArray(g?.participants) ? g.participants.length : 0) - 1,
            );
            return { g, start, enrolled };
          })
          .filter(
            (x: any) =>
              !Number.isNaN(x.start) &&
              x.start < now &&
              String(x.g?._id) !== String(viewingId),
          )
          .sort((a: any, b: any) => b.start - a.start)
          .slice(0, 6)
          .map((x: any) => {
            const d = new Date(x.start);
            return {
              id: String(x.g?._id),
              title: x.g?.name || 'Seminar',
              date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
              attendees: x.enrolled,
            };
          });
        if (!cancelled) setPastSeminars(past);
      } catch {
        if (!cancelled) setPastSeminars([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSeminar?.expertId, selectedSeminar?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await doGetKeywordsAndServices();
        const majorList = (res?.keywords || []).map((k: any) => k?.value).filter(Boolean);
        const topicList = canonicalLabelsFromMixedServiceEntries(res?.services);
        if (!cancelled) {
          setCatalogMajors(Array.from(new Set<string>(majorList)).sort());
          setCatalogTopics(Array.from(new Set<string>(topicList)));
        }
      } catch {
        if (!cancelled) {
          setCatalogMajors([]);
          setCatalogTopics([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groupedSeminars = useMemo(() => groupSeminarSeries(seminars), [seminars]);

  const majorOptions = useMemo<FilterOption[]>(
    () => [{ value: 'all', label: 'All majors' }, ...catalogMajors.map(m => ({ value: m, label: m }))],
    [catalogMajors],
  );

  const tagOptions = useMemo<FilterOption[]>(
    () => [{ value: 'all', label: 'All topics' }, ...catalogTopics.map(t => ({ value: t, label: t }))],
    [catalogTopics],
  );

  const matchesFilters = (seminar: Seminar) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      seminar.title.toLowerCase().includes(q) ||
      seminar.description.toLowerCase().includes(q) ||
      seminar.major.toLowerCase().includes(q) ||
      seminar.tags.some(t => t.toLowerCase().includes(q)) ||
      seminar.searchTags.some(t => t.toLowerCase().includes(q));

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

      <div className="px-5 pb-4 flex flex-col gap-2 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
            <Clock className="h-3 w-3 text-[#234C6A]" aria-hidden />
            <span>
              {s.recurrenceFrequency ? 'Next: ' : ''}{s.date} · {s.time}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
            <User className="h-3 w-3 text-[#234C6A]" aria-hidden />
            <span>{s.expertName}</span>
          </span>
          {s.recurrenceFrequency && s.occurrenceCount > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8EEF4] px-2 py-1 text-[#234C6A]">
              <Repeat className="h-3 w-3" aria-hidden />
              <span>{RECURRENCE_LABEL[s.recurrenceFrequency]} · {s.occurrenceCount} sessions</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
            <Users className="h-3 w-3 text-[#234C6A]" aria-hidden />
            <span>{seminarCapacityLabel(s.attendees, s.maxAttendees, { omitFullWord: true })}</span>
          </span>
          {s.level && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#234C6A]" />
              <span>{s.level}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-1 gap-y-0.5">
          {(s.majors.length ? s.majors : [s.major]).map((m) => (
            <span
              key={m}
              className="rounded-full bg-[#E8EEF4] px-2 py-0.5 text-[10px] font-medium text-[#234C6A]"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-auto px-5 pb-4 flex justify-end gap-2">
        {onEnterSeminarChat && seminarRegistered(s) ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onEnterSeminarChat(s.id);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#234C6A] bg-white px-3 py-1.5 text-xs font-semibold text-[#234C6A] hover:bg-[#F5F3EF]"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Enter chat
          </button>
        ) : null}
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
    const pastBySameExpert = pastSeminars;

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
                {s.expertId ? (
                  <button
                    type="button"
                    onClick={() =>
                      openPeerProfile({ userId: s.expertId, username: s.expertName, image: s.expertImage })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 text-left transition-colors hover:border-[#234C6A] hover:bg-[#E8EEF4]"
                    title={`View ${s.expertName}'s profile`}
                  >
                    <User className="h-4 w-4 text-[#234C6A]" aria-hidden />
                    <span className="font-medium text-[#234C6A] underline underline-offset-2">{s.expertName}</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2">
                    <User className="h-4 w-4 text-[#234C6A]" aria-hidden />
                    <span>{s.expertName}</span>
                  </div>
                )}
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
                  <Users className="h-4 w-4 text-[#234C6A]" aria-hidden />
                  <span>{seminarCapacityLabel(s.attendees, s.maxAttendees)}</span>
                </div>
              </div>

              {(s.majors.length > 0 || s.services.length > 0) && (
                <div className="mt-5 space-y-3">
                  {s.majors.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                        Majors / keywords
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.majors.map(k => (
                          <span
                            key={k}
                            className="rounded-full bg-[#E8EEF4] px-2.5 py-1 text-[11px] font-medium text-[#234C6A]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.services.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                        Services
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.services.map(k => (
                          <span
                            key={k}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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

            {seatRequested ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-sm font-semibold text-amber-900">
                  Seat request submitted.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {s.price > 0
                    ? 'Your card is authorized but not charged — the host reviews full-seminar requests and you’re only charged if approved. Otherwise the hold is released.'
                    : 'The host reviews full-seminar requests; you’ll join only if approved.'}
                </p>
              </div>
            ) : alreadyRegistered ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-900">
                  You're enrolled in this seminar.
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  It’s on your calendar — join from your seminars or calendar.
                </p>
                {onEnterSeminarChat ? (
                  <button
                    type="button"
                    onClick={() => onEnterSeminarChat(s.id)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#234C6A] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    Enter seminar chat
                  </button>
                ) : null}
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
                  <div className="space-y-2">
                    <p className="text-xs text-[#7A7A72]">
                      This seminar is full. You can request a seat — the host approves requests and
                      admits students beyond the cap.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCheckout('review')}
                      className="w-full rounded-[4px] bg-[#234C6A] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      Request a seat
                    </button>
                  </div>
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
                <p className="font-serif text-lg font-medium text-[#1A3A4A]">
                  {isFull ? 'Request a seat' : 'Review your booking'}
                </p>
                {isFull ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This seminar is full. {s.price > 0
                      ? 'Your card is authorized but not charged — you\'re only charged if the host approves your seat. Otherwise the hold is released.'
                      : 'Your request goes to the host for approval; you\'ll join only if they approve.'}
                  </p>
                ) : null}
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
                  {isFull
                    ? (s.price > 0 ? 'Continue to authorize' : 'Continue to request')
                    : s.price > 0 ? 'Continue to payment' : 'Confirm booking'}
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
                isSeatRequest={isFull}
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
        {peerProfileModal}
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
                placeholder="Search by seminar title, description, field, or topic…"
                className="w-full bg-transparent text-sm font-sans text-[#1A3A4A] placeholder:text-[#B2AEA2] outline-none"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:justify-end md:gap-4">
            <FilterDropdown
              label="Filter by major"
              value={majorFilter}
              options={majorOptions}
              onChange={setMajorFilter}
              widthClass="md:w-44"
            />
            <FilterDropdown
              label="Filter by topic"
              value={tagFilter}
              options={tagOptions}
              onChange={setTagFilter}
              widthClass="md:w-44"
            />
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
