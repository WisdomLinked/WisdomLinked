import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Star,
  Target,
  Users,
} from 'lucide-react';
import type { MentorCardProps } from '../MentorCard';
import { useAppSelector } from '../../store';
import { SERVICE_LABELS } from '../../constants/serviceOptions';
import FilePreviewModal from '../../pages/Dashboard/FilePreviewModal';
import { hasResumeForPreview, resolveResumePublicUrl } from '../../utils/resumeUrl';
import StudentExpertBookingPicker from './StudentExpertBookingPicker';
import StudentBookingCheckout from './StudentBookingCheckout';
import BookingConfirmationModal from './BookingConfirmationModal';
import { createGroupChatByUser, getExpertById, profileImageFetch, addMemberToPendingGroup } from '../../api/api';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { normalizeExpertPrice } from '../../utils/schedulingSlots';
import { computeBookingPriceDollars } from '../../utils/bookingPrice';
import {
  defaultAppointmentDuration,
  formatOfferedDurationsList,
  normalizeAppointmentDurations,
  type AppointmentDurationMinutes,
} from '../../utils/appointmentDurations';
import { detectUserTimeZone, formatBookingConfirmation, formatPickedSlotWhenDisplay } from '../../utils/schedulingTimezone';
import { SetLoadingStatus } from '../../actions/appActions';

type BookingStep = 'pick' | 'review' | 'pay' | 'success';

const aiHeadshotUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

function extractExperienceYears(experience: string) {
  // Examples: "8+ yrs", "15+ yrs"
  const m = experience.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export default function ExpertProfile({
  mentor,
  onBack,
  followerCount: followerCountLive,
  isFollowing = false,
  onToggleFollow,
  paymentReturnSuccess = false,
  onPaymentReturnHandled,
  onGoToCalendar,
}: {
  mentor: MentorCardProps;
  onBack: () => void;
  /** Live count from parent (list + profile stay in sync). */
  followerCount?: number;
  isFollowing?: boolean;
  onToggleFollow?: (mentorId: string | number) => void;
  /** Set when Stripe redirect completed on student dashboard. */
  paymentReturnSuccess?: boolean;
  onPaymentReturnHandled?: () => void;
  onGoToCalendar?: () => void;
}) {
  const dispatch = useDispatch();
  const { auth: { userDetails } } = useAppSelector((state: any) => state);
  const experienceYears = useMemo(
    () => extractExperienceYears(mentor.experience),
    [mentor.experience],
  );

  const [expertDetails, setExpertDetails] = useState<any>(null);
  const [expertLoading, setExpertLoading] = useState(false);
  const [pickedStart, setPickedStart] = useState<Date | null>(null);
  const [pickedEnd, setPickedEnd] = useState<Date | null>(null);
  const [pickedDuration, setPickedDuration] = useState(0);

  const loadExpertDetails = useCallback(async () => {
    setExpertLoading(true);
    try {
      const res: any = await getExpertById(mentor.id);
      if (res?.result) {
        setExpertDetails(res.result);
      }
    } catch {
      setExpertDetails(null);
    } finally {
      setExpertLoading(false);
    }
  }, [mentor.id]);

  useEffect(() => {
    void loadExpertDetails();
  }, [loadExpertDetails]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadExpertDetails();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadExpertDetails]);

  const expertHourlyRate = useMemo(
    () => normalizeExpertPrice(expertDetails?.price),
    [expertDetails?.price],
  );

  const offeredDurations = useMemo(
    () => normalizeAppointmentDurations(expertDetails?.appointmentDurations),
    [expertDetails?.appointmentDurations],
  );

  useEffect(() => {
    if (!expertDetails) return;
    const fallback = defaultAppointmentDuration(offeredDurations);
    setSessionDurationMinutes((current) =>
      offeredDurations.includes(current) ? current : fallback,
    );
  }, [expertDetails, offeredDurations]);

  const oneToOneRate = useMemo(
    () => expertHourlyRate ?? 60 + experienceYears * 18,
    [experienceYears, expertHourlyRate],
  );
  /** Hourly rate shown to students — only when expert published a price. */
  const publishedOneToOneRate = expertHourlyRate;
  const seminarRate = useMemo(
    () => 35 + experienceYears * 10,
    [experienceYears],
  );

  const supportsOneToOne = useMemo(
    () =>
      mentor.services.some(s => /1\s*[-–]?\s*on\s*[-–]?\s*1/i.test(s) || /1:1/i.test(s)) ||
      mentor.services.some(s => SERVICE_LABELS.includes(s)),
    [mentor.services],
  );
  const supportsSeminar = useMemo(
    () => mentor.services.some(s => /seminar/i.test(s)),
    [mentor.services],
  );

  const [serviceChoice, setServiceChoice] = useState<'oneToOne' | 'seminar'>(() => {
    if (supportsOneToOne) return 'oneToOne';
    if (supportsSeminar) return 'seminar';
    return 'oneToOne';
  });

  const [selectedSlot, setSelectedSlot] = useState<{
    day: string;
    start: string; // HH:MM
    end: string; // HH:MM
  } | null>(null);

  /** 1:1 only — price scales from hourly peak/off-peak rate. */
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<30 | 60 | 90>(60);

  const [bookingStep, setBookingStep] = useState<BookingStep>('pick');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [bookingViewerTz, setBookingViewerTz] = useState(
    () => userDetails?.timeZone || detectUserTimeZone(),
  );

  const [seminarBookingSuccessId, setSeminarBookingSuccessId] = useState<string | null>(null);
  const [seminarBookingError, setSeminarBookingError] = useState<string | null>(null);
  /** Open seminar checkout (real groupChat id + price) when a student books from the profile. */
  const [seminarCheckout, setSeminarCheckout] = useState<
    { id: string; price: number; name: string } | null
  >(null);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [displayImage, setDisplayImage] = useState(() => aiHeadshotUrl(mentor.name));

  const peakRate = 50;
  const oneToOneOffPeakRate = Math.min(oneToOneRate, 45);
  const seminarOffPeakRate = Math.min(seminarRate, 40);

  const isPeakSlot = (slot: { day: string; start: string; end: string } | null) => {
    if (!slot) return false;
    const isWeekend = slot.day === 'Sat' || slot.day === 'Sun';
    const startHour = Number(slot.start.split(':')[0] || 0);
    // Dinner window (mock): 18:00 - 22:00
    const isDinner = startHour >= 18 && startHour < 22;
    return isWeekend || isDinner;
  };

  const oneToOneHourlyRate = isPeakSlot(selectedSlot) ? peakRate : oneToOneOffPeakRate;
  const seminarSessionRate = isPeakSlot(selectedSlot) ? peakRate : seminarOffPeakRate;

  const selectedRate =
    serviceChoice === 'seminar'
      ? seminarSessionRate
      : oneToOneHourlyRate * (sessionDurationMinutes / 60);

  const hasLockedDuration = !!pickedStart;

  const applySessionDuration = useCallback((mins: 30 | 60 | 90) => {
    if (pickedStart) return;
    setSessionDurationMinutes(mins);
    setBookingError(null);
  }, [pickedStart]);

  const handleSlotPicked = useCallback(
    (start: Date, end: Date, duration: number) => {
      const mins = duration as 30 | 60 | 90;
      setPickedStart(start);
      setPickedEnd(end);
      setPickedDuration(mins);
      setSessionDurationMinutes(mins);
      setBookingError(null);
      if (bookingStep !== 'pick') {
        setBookingStep('pick');
      }
    },
    [bookingStep],
  );

  const clearPickedSlot = useCallback(() => {
    setPickedStart(null);
    setPickedEnd(null);
    setPickedDuration(0);
    setBookingError(null);
  }, []);

  const oneToOneSessionPrice = useMemo(() => {
    if (!pickedDuration) return 0;
    const hourly = normalizeExpertPrice(expertDetails?.price);
    if (hourly == null) return 0;
    return computeBookingPriceDollars(pickedDuration, hourly);
  }, [pickedDuration, expertDetails?.price]);

  const bookingConfirmationDetails = useMemo(() => {
    if (!pickedStart || !pickedEnd) return null;
    const formatted = formatBookingConfirmation(pickedStart, pickedEnd, bookingViewerTz);
    return {
      ...formatted,
      sessionType: '1:1 session',
      expertName: mentor.name,
      sessionLengthMinutes: pickedDuration,
      price: oneToOneSessionPrice,
    };
  }, [
    pickedStart,
    pickedEnd,
    bookingViewerTz,
    mentor.name,
    pickedDuration,
    oneToOneSessionPrice,
  ]);

  const pickedSlotDisplay = useMemo(() => {
    if (!pickedStart || !pickedEnd) return null;
    return formatPickedSlotWhenDisplay(pickedStart, pickedEnd, bookingViewerTz);
  }, [pickedStart, pickedEnd, bookingViewerTz]);

  const bookingEventTitle = useMemo(() => {
    const student = userDetails?.username || 'Student';
    const expertName = mentor.name || expertDetails?.username || 'Expert';
    return `${student}, ${expertName}`;
  }, [userDetails?.username, mentor.name, expertDetails?.username]);

  const studentBookingReturnUrl = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('student_booking', '1');
      return url.toString();
    } catch {
      return '/user/studentdashboard?student_booking=1';
    }
  }, []);

  const submitOneToOneBooking = useCallback(
    async (paymentIntentId: string) => {
      if (!pickedStart || !pickedEnd || !pickedDuration) {
        setBookingError('Please select a date and time on the calendar.');
        return;
      }
      SetLoadingStatus(true);
      setBookingError(null);
      try {
        const response = await createGroupChatByUser({
          name: bookingEventTitle,
          start: pickedStart.toISOString(),
          end: pickedEnd.toISOString(),
          duration: pickedDuration,
          price: oneToOneSessionPrice,
          expert: expertDetails?._id ?? mentor.id,
          payment_intent: paymentIntentId,
        });
        if (response?.result) {
          dispatch({ type: 'updateUserDetails', payload: response.result });
        }
        setBookingSuccess(true);
        setBookingStep('success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Booking failed. Please try again.';
        setBookingError(message);
      } finally {
        SetLoadingStatus(false);
      }
    },
    [
      pickedStart,
      pickedEnd,
      pickedDuration,
      bookingEventTitle,
      oneToOneSessionPrice,
      expertDetails?._id,
      mentor.id,
      dispatch,
    ],
  );

  useEffect(() => {
    if (paymentReturnSuccess) {
      setBookingSuccess(true);
      setBookingStep('success');
      onPaymentReturnHandled?.();
    }
  }, [paymentReturnSuccess, onPaymentReturnHandled]);

  const availability = useMemo(() => {
    // Mock schedule for seminar picker only.
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return dayNames.map((day, idx) => {
      const available = (idx + mentor.id) % 7 !== 6; // mostly available days
      // Mix daytime and dinner-time slots so peak pricing is visible.
      // Weekend and Thu/Fri often fall into evening windows.
      const isWeekend = day === 'Sat' || day === 'Sun';
      const isLateWeek = day === 'Thu' || day === 'Fri';
      const startHour = isWeekend
        ? 18 + ((mentor.id + idx) % 3) // 18..20
        : isLateWeek
          ? 17 + ((mentor.id + idx) % 3) // 17..19
          : 10 + ((mentor.id + idx) % 4); // 10..13
      const endHour = startHour + 1;
      const start = `${String(startHour).padStart(2, '0')}:00`;
      const end = `${String(endHour).padStart(2, '0')}:00`;
      return { day, available, start, end };
    });
  }, [mentor.id]);

  const resolveNextDateForDay = (day: string) => {
    // Convert e.g. "Mon" => next matching local date.
    const map: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 0,
    };
    const targetDow = map[day] ?? 1;
    const now = new Date();
    const diff = (targetDow - now.getDay() + 7) % 7;
    const date = new Date(now);
    date.setDate(now.getDate() + diff);
    return date;
  };

  const parseTimeToMinutes = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + mm;
  };

  const formatMinutesDuration = (slot: { start: string; end: string }) => {
    const startM = parseTimeToMinutes(slot.start);
    const endM = parseTimeToMinutes(slot.end);
    const mins = Math.max(30, endM - startM); // guard
    return mins;
  };

  const slotStartEndAsDates = (slot: { day: string; start: string; end: string }) => {
    const base = resolveNextDateForDay(slot.day);
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);

    const startDt = new Date(base);
    startDt.setHours(sh, sm, 0, 0);

    const endDt = new Date(base);
    endDt.setHours(eh, em, 0, 0);

    return { start: startDt.toISOString(), end: endDt.toISOString() };
  };

  /** 1:1 booking end time follows chosen session length, not the slot window. */
  const slotStartEndAsDatesWithDuration = (
    slot: { day: string; start: string; end: string },
    durationMinutes: number,
  ) => {
    const base = resolveNextDateForDay(slot.day);
    const [sh, sm] = slot.start.split(':').map(Number);
    const startDt = new Date(base);
    startDt.setHours(sh, sm, 0, 0);
    const endDt = new Date(startDt.getTime() + durationMinutes * 60_000);
    return { start: startDt.toISOString(), end: endDt.toISOString() };
  };

  const bio = useMemo(() => {
    return `Professor ${mentor.name} is a ${mentor.title} focused on ${mentor.field}. With ${mentor.experience} of experience, they guide students through research and real-world preparation across 1:1 sessions and seminars.`;
  }, [mentor]);

  // Real seminars this expert hosts come from their groupChats (type 'seminar'),
  // populated by getExpertById. Split into past/upcoming by start time.
  const seminarTimeline = useMemo(() => {
    const now = Date.now();
    const mapSeminar = (g: any) => {
      const d = new Date(g?.start);
      const valid = !Number.isNaN(d.getTime());
      return {
        id: String(g?._id ?? ''),
        title: g?.name || 'Seminar',
        date: valid ? d.toLocaleDateString() : 'TBD',
        time: valid
          ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '',
        startTs: valid ? d.getTime() : 0,
        price: typeof g?.price === 'number' ? g.price : 0,
        attendees: Array.isArray(g?.participants) ? g.participants.length : 0,
      };
    };

    const all = (expertDetails?.groupChats || [])
      .filter((g: any) => g?.type === 'seminar')
      .map(mapSeminar);

    const past = all
      .filter((s: any) => s.startTs && s.startTs < now)
      .sort((a: any, b: any) => b.startTs - a.startTs);
    const upcoming = all
      .filter((s: any) => !s.startTs || s.startTs >= now)
      .sort((a: any, b: any) => a.startTs - b.startTs);

    return { past, upcoming };
  }, [expertDetails?.groupChats]);

  const registerSeminar = useCallback(
    async (paymentIntentId: string) => {
      if (!seminarCheckout) return;
      SetLoadingStatus(true);
      setSeminarBookingError(null);
      try {
        const res: any = await addMemberToPendingGroup({
          groupChatId: seminarCheckout.id,
          price: seminarCheckout.price,
          payment_intent: paymentIntentId,
        });
        if (res === false || res?.status === 'FAIL' || res?.error) {
          setSeminarBookingError(
            res?.error || 'Could not complete seminar registration.',
          );
          return;
        }
        setSeminarBookingSuccessId(seminarCheckout.id);
        setSeminarCheckout(null);
        void loadExpertDetails();
      } catch (e: any) {
        setSeminarBookingError(
          e?.message || 'Could not complete seminar registration.',
        );
      } finally {
        SetLoadingStatus(false);
      }
    },
    [seminarCheckout, loadExpertDetails],
  );

  const displayFollowers =
    followerCountLive ?? mentor.followerCount ?? 0;

  const resumeUrl = resolveResumePublicUrl(mentor.resume ?? null);
  const hasResume = hasResumeForPreview(mentor.resume ?? null);

  useEffect(() => {
    let cancelled = false;
    setDisplayImage(aiHeadshotUrl(mentor.name));
    (async () => {
      const src = await resolveProfileImageSrc(
        mentor.image,
        'medium',
        profileImageFetch as any,
      );
      if (!cancelled && src) setDisplayImage(src);
    })();
    return () => {
      cancelled = true;
    };
  }, [mentor.id, mentor.image, mentor.name]);

  useEffect(() => {
    setResumePreviewOpen(false);
  }, [mentor.id]);

  useEffect(() => {
    if (!hasResumeForPreview(mentor.resume ?? null) && resumePreviewOpen) {
      setResumePreviewOpen(false);
    }
  }, [mentor.resume, resumePreviewOpen]);

  return (
    <>
    <div className="min-h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-6 py-8 text-[#1A3A4A]">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to experts
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-start">
              <div className="h-44 w-44 shrink-0 overflow-hidden rounded-2xl border border-[#E5E2DB] bg-[#F5F3EF]">
                <img src={displayImage} alt={mentor.name} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="font-serif text-[2rem] font-medium text-[#1A3A4A] leading-tight">
                    {mentor.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-[3px] border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-slate-700">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {displayFollowers.toLocaleString()} followers
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#7A7A72]">
                  {mentor.title} · {mentor.institution}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-[3px] border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A]">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {mentor.field}
                  </span>
                  {mentor.services.slice(0, 3).map((s, idx) => (
                    <span
                      key={`${s}-${idx}`}
                      className={[
                        'inline-flex items-center rounded-[3px] border px-3 py-1.5 text-[12px] font-semibold',
                        idx === 0
                          ? 'border-[#1A3A4A] text-[#1A3A4A]'
                          : idx === 1
                            ? 'border-[#C9A84C] text-[#C9A84C]'
                            : 'border-[#E07B54] text-[#E07B54]',
                      ].join(' ')}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {onToggleFollow ? (
              <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end lg:pt-1">
                <button
                  type="button"
                  onClick={() => onToggleFollow(mentor.id)}
                  className={`rounded-[4px] px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors ${
                    isFollowing
                      ? 'bg-slate-500 hover:bg-slate-600'
                      : 'bg-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow +'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-[#E5E2DB] pt-6">
            <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">About</h2>
            <p className="mt-3 text-sm font-sans text-[#7A7A72] leading-relaxed">{bio}</p>
          </div>

          <div className="mt-6 rounded-xl border border-[#E5E2DB] bg-white px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8EEF4] text-[#1A3A4A]">
                <FileText className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                  Resume
                </p>
                <button
                  type="button"
                  disabled={!hasResume}
                  onClick={() => hasResume && setResumePreviewOpen(true)}
                  title={hasResume ? 'Open resume' : 'No resume uploaded'}
                  className={`mt-2 w-full text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:no-underline ${
                    hasResume
                      ? 'text-[#1A3A4A] underline underline-offset-2 hover:text-[#122635]'
                      : 'text-[#94a3b8]'
                  }`}
                >
                  View resume
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Past seminars
              </p>
              <h3 className="mt-1 font-serif text-[1rem] text-[#1A3A4A]">
                Sessions previously hosted
              </h3>
              <div className="mt-3 space-y-2">
                {seminarTimeline.past.length === 0 ? (
                  <p className="text-[12px] text-[#7A7A72]">No past seminars yet.</p>
                ) : (
                  seminarTimeline.past.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[#E5E2DB] bg-white px-3 py-2"
                    >
                      <p className="text-[13px] font-semibold text-[#1A3A4A]">{item.title}</p>
                      <p className="mt-1 text-[11px] text-[#7A7A72]">
                        {item.date} · {item.attendees} attendees
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E2DB] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                Upcoming seminars
              </p>
              <h3 className="mt-1 font-serif text-[1rem] text-[#1A3A4A]">
                Next public sessions
              </h3>
              <div className="mt-3 space-y-2">
                {seminarTimeline.upcoming.length === 0 ? (
                  <p className="text-[12px] text-[#7A7A72]">
                    No upcoming seminars scheduled.
                  </p>
                ) : (
                  seminarTimeline.upcoming.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2"
                  >
                    <p className="text-[13px] font-semibold text-[#1A3A4A]">{item.title}</p>
                    <p className="mt-1 text-[11px] text-[#7A7A72]">
                      {item.date}{item.time ? ` · ${item.time}` : ''}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold text-[#1A3A4A]">
                      {item.price > 0 ? `$${item.price.toFixed(2)}` : 'Free'}
                    </p>
                    <div className="mt-2">
                      {seminarBookingSuccessId === item.id ? (
                        <div className="rounded-[4px] bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                          Registered — awaiting expert approval.
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSeminarBookingError(null);
                            if (!userDetails?._id) {
                              setSeminarBookingError('Please log in again to book this session.');
                              return;
                            }
                            setSeminarCheckout({
                              id: item.id,
                              price: item.price,
                              name: item.title,
                            });
                          }}
                          className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#122635]"
                        >
                          Book the session
                        </button>
                      )}
                    </div>
                  </div>
                  ))
                )}
              </div>
              {seminarBookingError && (
                <div className="mt-3 text-[12px] font-semibold text-red-600">
                  {seminarBookingError}
                </div>
              )}
            </section>
          </div>

          <div className="mt-10 space-y-10">
            <section className="rounded-xl bg-[#F5F3EF] p-6">
              <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">
                What to Expect
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <MessageSquare
                    className="h-5 w-5 text-[#1A3A4A]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className="mt-3 text-sm font-semibold text-[#1A3A4A]">Personalized Guidance</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#7A7A72]">
                    Sessions are tailored to your goals, questions, and pace—so you leave with clarity
                    on your next steps.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <BookOpen className="h-5 w-5 text-[#1A3A4A]" strokeWidth={2} aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-[#1A3A4A]">Structured Sessions</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#7A7A72]">
                    Each booking follows a simple agenda—objectives upfront, focused discussion, and a
                    concise recap you can act on.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <Target className="h-5 w-5 text-[#1A3A4A]" strokeWidth={2} aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-[#1A3A4A]">Actionable Outcomes</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#7A7A72]">
                    Expect concrete feedback, resources, and milestones—whether you are preparing for
                    interviews, applications, or coursework.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-[#F5F3EF] p-6">
              <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">
                Frequently Asked Questions
              </h2>
              <ul className="mt-5 divide-y divide-gray-200 border-t border-gray-200">
                {(
                  [
                    {
                      q: 'How do I book a 1:1 session?',
                      a: 'Choose 1:1, pick an available slot on the calendar (times respect your timezone), then continue to the standard payment flow.',
                    },
                    {
                      q: 'What happens after I book?',
                      a: 'Your request is saved and the expert is notified. You will receive details on how to join (time, link, or prep materials) before the session begins.',
                    },
                    {
                      q: 'Can I reschedule or cancel a session?',
                      a: 'Yes—use the link in your confirmation or contact support. Policies may vary by expert; rescheduling is easiest with advance notice.',
                    },
                    {
                      q: "What's the difference between peak and off-peak rates?",
                      a: 'Peak typically applies to evenings and weekends when demand is higher. Off-peak slots use the lower rate shown in the booking panel for the same service.',
                    },
                    {
                      q: 'Are group seminars included in my plan?',
                      a: 'Seminars are booked separately from 1:1 sessions unless your school or program states otherwise. Check each seminar card for its price and terms.',
                    },
                  ] as const
                ).map((item, idx) => {
                  const open = openFaqIndex === idx;
                  return (
                    <li key={item.q}>
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(open ? null : idx)}
                        className="flex w-full items-center justify-between gap-3 py-4 text-left transition-all duration-200"
                        aria-expanded={open}
                      >
                        <span className="font-medium text-gray-900">{item.q}</span>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-gray-600 transition-transform duration-200 ${
                            open ? 'rotate-180' : ''
                          }`}
                          aria-hidden
                        />
                      </button>
                      <div
                        className={`grid transition-all duration-200 ease-out ${
                          open ? 'grid-rows-[1fr] opacity-100 pb-4' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <p className="text-sm leading-relaxed text-gray-600">{item.a}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">
                  Book availability
                </h2>
                <p className="mt-1 text-[12px] text-[#7A7A72]">
                  Choose a service, pick a time on the expert&apos;s calendar, then continue to payment.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#F5F3EF] px-2 py-1 text-[11px] font-semibold text-[#1A3A4A]">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Week
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                  Service offered
                </p>
                <div className="flex flex-wrap gap-2">
                  {supportsOneToOne && (
                    <button
                      type="button"
                      onClick={() => {
                        setServiceChoice('oneToOne');
                        setSelectedSlot(null);
                        setBookingError(null);
                        setSessionDurationMinutes(60);
                      }}
                      className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        serviceChoice === 'oneToOne'
                          ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                          : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      1:1 session
                    </button>
                  )}
                  {supportsSeminar && (
                    <button
                      type="button"
                      onClick={() => {
                        setServiceChoice('seminar');
                        setSelectedSlot(null);
                        setBookingError(null);
                        setSessionDurationMinutes(60);
                      }}
                      className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        serviceChoice === 'seminar'
                          ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                          : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-[#F5F3EF]'
                      }`}
                    >
                      Seminar
                    </button>
                  )}
                </div>
              </div>

              {serviceChoice === 'oneToOne' && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                    Appointment Duration
                  </p>
                  {hasLockedDuration ? (
                    <>
                      <p className="inline-flex rounded-[4px] border border-[#1A3A4A] bg-[#1A3A4A] px-3 py-1.5 text-[12px] font-semibold text-white">
                        {sessionDurationMinutes} min — fixed for this booking
                      </p>
                      <p className="mt-2 text-[11px] text-[#7A7A72]">
                        Appointment duration is fixed after you select a time. Use Change time to
                        choose a different length.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {offeredDurations.map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => applySessionDuration(mins)}
                            className={`rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                              sessionDurationMinutes === mins
                                ? 'border-[#1A3A4A] bg-[#1A3A4A] text-white'
                                : 'border-[#E5E2DB] bg-white text-[#1A3A4A] hover:bg-[#F5F3EF]'
                            }`}
                          >
                            {mins} min
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-[#7A7A72]">
                        Total uses the hourly rate for your slot (peak or off-peak) × appointment
                        duration.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                  Availability
                </p>
                {serviceChoice === 'oneToOne' ? (
                  bookingStep === 'review' ? (
                    <div className="rounded-xl border border-[#E5E2DB] bg-white p-4 space-y-3">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72]">
                        Booking summary
                      </p>
                      <dl className="space-y-2 text-sm text-[#1A3A4A]">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#7A7A72]">Expert</dt>
                          <dd className="font-semibold text-right">{mentor.name}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#7A7A72]">When</dt>
                          <dd className="font-semibold text-right">{pickedSlotDisplay}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#7A7A72]">Appointment duration</dt>
                          <dd className="font-semibold">{pickedDuration} min</dd>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-[#E5E2DB] pt-2">
                          <dt className="text-[#7A7A72]">Total</dt>
                          <dd className="font-serif text-lg font-semibold">
                            ${oneToOneSessionPrice.toFixed(2)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : bookingStep === 'pay' ? (
                    <StudentBookingCheckout
                      type="1:1 session"
                      price={oneToOneSessionPrice}
                      returnUrl={studentBookingReturnUrl}
                      pendingDetails={{
                        name: bookingEventTitle,
                        start: pickedStart!.toISOString(),
                        end: pickedEnd!.toISOString(),
                        duration: pickedDuration,
                        price: oneToOneSessionPrice,
                        expert: String(expertDetails?._id ?? mentor.id),
                      }}
                      onPaymentSuccess={submitOneToOneBooking}
                      onCancel={() => setBookingStep('review')}
                    />
                  ) : bookingStep === 'success' ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <p className="text-[14px] font-semibold text-emerald-900">
                        Session booked
                      </p>
                      <p className="mt-1 text-[12px] text-emerald-800">
                        Your request was sent to {mentor.name}. You will see it on your calendar
                        once confirmed.
                      </p>
                      {onGoToCalendar ? (
                        <button
                          type="button"
                          onClick={onGoToCalendar}
                          className="mt-3 w-full rounded-[4px] bg-[#1A3A4A] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#122635]"
                        >
                          View calendar
                        </button>
                      ) : null}
                    </div>
                  ) : (
                  <div className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] p-4">
                    {expertLoading ? (
                      <p className="text-sm text-[#7A7A72]">Loading expert availability…</p>
                    ) : !expertDetails?.timeSlots?.length ? (
                      <p className="text-sm text-[#7A7A72]">
                        This expert has not published availability yet.
                      </p>
                    ) : (
                      <StudentExpertBookingPicker
                        expert={expertDetails}
                        onSlotSelected={handleSlotPicked}
                        hidePriceInDurationSelection
                        selectedDurationMinutes={sessionDurationMinutes}
                        onDurationMinutesChange={applySessionDuration}
                        allowedDurationMinutes={offeredDurations}
                        confirmedSlotStart={pickedStart}
                        onViewerTimeZoneChange={setBookingViewerTz}
                        onFilterSlotConfirmed={() => {
                          setBookingError(null);
                          setBookingStep('review');
                        }}
                      />
                    )}
                  </div>
                  )
                ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availability.map(slot => {
                    const active =
                      selectedSlot?.day === slot.day &&
                      selectedSlot?.start === slot.start &&
                      selectedSlot?.end === slot.end;
                    return (
                      <button
                        key={slot.day}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => {
                          setSelectedSlot({ day: slot.day, start: slot.start, end: slot.end });
                          setBookingError(null);
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                          !slot.available
                            ? 'border-[#E5E2DB] bg-white opacity-60 cursor-not-allowed'
                            : active
                              ? 'border-[#1A3A4A] bg-[#F5F3EF] ring-2 ring-[#1A3A4A]/20'
                              : 'border-[#E5E2DB] bg-[#F5F3EF] hover:bg-white'
                        } ${active ? 'shadow-[0_10px_25px_rgba(26,58,74,0.10)]' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold">{slot.day}</span>
                          {isPeakSlot(slot) ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-[#C9A84C]/25 px-2 py-0.5 text-[10px] font-semibold text-[#1A3A4A]">
                              Peak
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full bg-[#1A3A4A]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1A3A4A]">
                              <Clock className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[12px] font-semibold text-[#1A3A4A]">
                          {slot.start} - {slot.end}
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>

              {serviceChoice === 'oneToOne' &&
                bookingStep === 'pick' &&
                pickedStart &&
                pickedEnd &&
                pickedDuration ? (
                <div
                  data-testid="selected-slot-summary"
                  className="rounded-xl border border-[#1A3A4A]/20 bg-[#E8F0F8] p-4 space-y-3"
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1A3A4A]">
                    Your selected appointment
                  </p>
                  <dl className="space-y-2 text-sm text-[#1A3A4A]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#7A7A72]">When</dt>
                      <dd className="font-semibold text-right">{pickedSlotDisplay}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#7A7A72]">Appointment duration</dt>
                      <dd className="font-semibold">{pickedDuration} min</dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-[#1A3A4A]/15 pt-2">
                      <dt className="text-[#7A7A72]">Estimated total</dt>
                      <dd className="font-serif text-lg font-semibold">
                        ${oneToOneSessionPrice.toFixed(2)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {bookingError && (
                <div className="text-[12px] font-semibold text-red-600">{bookingError}</div>
              )}

              {serviceChoice === 'oneToOne' ? (
                bookingStep === 'success' ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex w-full items-center justify-center rounded-[4px] border border-[#E5E2DB] bg-white px-4 py-3 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
                  >
                    Back to experts
                  </button>
                ) : bookingStep === 'pay' ? null : bookingStep === 'review' ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!pickedStart || !pickedEnd || !pickedDuration) {
                          setBookingError('Please select a date and time on the calendar.');
                          return;
                        }
                        setBookingError(null);
                        setPaymentConfirmOpen(true);
                      }}
                      className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635]"
                    >
                      Continue to payment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearPickedSlot();
                        void loadExpertDetails();
                        setBookingStep('pick');
                      }}
                      className="inline-flex w-full items-center justify-center rounded-[4px] border border-[#E5E2DB] bg-white px-4 py-3 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
                    >
                      Change time
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!pickedStart || !pickedEnd || !pickedDuration) {
                        setBookingError('Please select a date and time on the calendar.');
                        return;
                      }
                      setBookingError(null);
                      setBookingStep('review');
                    }}
                    className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635]"
                  >
                    Review booking
                  </button>
                )
              ) : !bookingSuccess ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSlot) {
                      setBookingError('Please select an available day/time slot.');
                      return;
                    }

                    const duration = formatMinutesDuration(selectedSlot);
                    const { start, end } = slotStartEndAsDates({
                      day: selectedSlot.day,
                      start: selectedSlot.start,
                      end: selectedSlot.end,
                    });

                    const pending = {
                      title: 'Seminar request',
                      name: 'Seminar request',
                      start,
                      end,
                      duration,
                      price: selectedRate,
                      expert: mentor.id,
                      eventId: null,
                      serviceChoice,
                    };

                    window.localStorage.setItem('pendingDetails', JSON.stringify(pending));
                    setBookingSuccess(true);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#234C6A] px-4 py-3 text-[13px] font-semibold text-white hover:brightness-110"
                >
                  Book availability
                </button>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="text-[14px] font-semibold text-emerald-900">
                    Request saved.
                  </div>
                  <div className="mt-1 text-[12px] text-emerald-800">
                    Next step (payment) will be handled later.
                  </div>
                  <button
                    type="button"
                    onClick={onBack}
                    className="mt-3 w-full rounded-[4px] border border-emerald-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
                  >
                    Back to experts
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
            <h2 className="font-serif text-[1.15rem] font-medium text-[#1A3A4A]">Rates</h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[#E5E2DB] bg-[#F5F3EF] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
                      1:1 session
                    </p>
                    {expertLoading ? (
                      <p className="mt-2 text-[14px] text-[#7A7A72]">Loading rates…</p>
                    ) : publishedOneToOneRate != null ? (
                      <>
                        <p className="mt-2 text-[20px] font-serif font-semibold text-[#1A3A4A]">
                          ${publishedOneToOneRate.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[12px] text-[#7A7A72]">
                          per hour — {formatOfferedDurationsList(offeredDurations)} totals scale
                          from this rate
                        </p>
                        {serviceChoice === 'oneToOne' && pickedStart && pickedEnd && pickedDuration ? (
                          <p className="mt-2 text-[12px] font-semibold text-[#1A3A4A]">
                            {pickedDuration} min · ${oneToOneSessionPrice.toFixed(2)} · {pickedSlotDisplay}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-2 text-[14px] text-[#7A7A72]">Rate not published yet</p>
                    )}
                  </div>
                  <Star className="h-5 w-5 text-[#C9A84C]" aria-hidden />
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E2DB] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7A7A72]">
                      Seminar
                    </p>
                    <p className="mt-2 text-[20px] font-serif font-semibold text-[#1A3A4A]">
                      ${seminarRate.toFixed(0)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#7A7A72]">per attendee (mock)</p>
                  </div>
                  <Star className="h-5 w-5 text-[#E07B54]" aria-hidden />
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
    {resumePreviewOpen && hasResume ? (
      <FilePreviewModal
        fileUrl={resumeUrl}
        fileName="Resume"
        documentType="Resume"
        onClose={() => setResumePreviewOpen(false)}
        resumeStudentViewContext={
          String(userDetails?.role || '').toLowerCase() === 'customer' && mentor?.id != null
            ? { expertId: String(mentor.id) }
            : undefined
        }
      />
    ) : null}
    {paymentConfirmOpen && bookingConfirmationDetails ? (
      <BookingConfirmationModal
        open={paymentConfirmOpen}
        onClose={() => setPaymentConfirmOpen(false)}
        onConfirm={() => {
          setPaymentConfirmOpen(false);
          setBookingStep('pay');
        }}
        details={bookingConfirmationDetails}
      />
    ) : null}
    {seminarCheckout ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSeminarCheckout(null);
        }}
      >
        <div className="w-full max-w-md">
          <StudentBookingCheckout
            type="Seminar"
            price={seminarCheckout.price}
            returnUrl={studentBookingReturnUrl}
            pendingDetails={{
              groupChatId: seminarCheckout.id,
              price: seminarCheckout.price,
              name: seminarCheckout.name,
            }}
            onPaymentSuccess={registerSeminar}
            onCancel={() => setSeminarCheckout(null)}
          />
        </div>
      </div>
    ) : null}
    </>
  );
}

