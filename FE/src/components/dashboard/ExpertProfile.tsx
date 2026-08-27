import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  FileText,
  MapPin,
  MessageSquare,
  Star,
  Target,
  Users,
} from 'lucide-react';
import type { ExpertCardProps } from '../ExpertCard';
import { useAppSelector } from '../../store';
import FilePreviewModal from '../../pages/Dashboard/FilePreviewModal';
import { hasResumeForPreview, resolveResumePublicUrl } from '../../utils/resumeUrl';
import StudentExpertBookingPicker from './StudentExpertBookingPicker';
import StudentBookingCheckout from './StudentBookingCheckout';
import { purposeOptionsFromServices, PURPOSE_OTHER } from '../../constants/serviceOptions';
import { createGroupChatByUser, getExpertById, getMySeatRequests, profileImageFetch, registerForSeminar, requestSeminarSeat } from '../../api/api';
import {
  emptySeatRequestIndex,
  indexSeatRequests,
  seatRequestFor,
  type SeatRequestIndex,
} from '../../utils/seatRequestState';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { seminarCapacityLabel } from '../../utils/seminarCapacityLabel';
import {
  seatRequestActionLabel,
  seatRequestWindow,
  seatRequestWindowMessage,
} from '../../utils/seatRequestWindow';
import { normalizeExpertPrice } from '../../utils/schedulingSlots';
import { computeBookingPriceDollars } from '../../utils/bookingPrice';
import {
  defaultAppointmentDuration,
  formatOfferedDurationsList,
  normalizeAppointmentDurations,
  type AppointmentDurationMinutes,
} from '../../utils/appointmentDurations';
import { detectUserTimeZone, formatPickedSlotWhenDisplay } from '../../utils/schedulingTimezone';
import { SetLoadingStatus } from '../../actions/appActions';

type BookingStep = 'pick' | 'review' | 'pay' | 'success';

const aiHeadshotUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

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
  mentor: ExpertCardProps;
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

  /** Hourly rate shown to students — only when expert published a price. */
  const publishedOneToOneRate = expertHourlyRate;

  /** 1:1 session length — price scales from the expert's published hourly rate. */
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<30 | 60 | 90>(60);

  const [bookingStep, setBookingStep] = useState<BookingStep>('pick');
  // A wallet booking is only a request until the expert accepts and it is paid for.
  const [bookingAwaitsWalletPayment, setBookingAwaitsWalletPayment] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const BOOKING_TITLE_MIN = 10;
  const BOOKING_TITLE_MAX = 60;
  const BOOKING_NOTE_MIN = 50;
  const BOOKING_NOTE_MAX = 500;
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingNote, setBookingNote] = useState('');
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [bookingPurposeOther, setBookingPurposeOther] = useState('');

  const purposeOptions = useMemo(
    () => purposeOptionsFromServices(expertDetails?.services),
    [expertDetails?.services],
  );

  // The purpose stored on the booking: the free-text value when "Other" is picked,
  // otherwise the chosen service label.
  const resolvedPurpose = useMemo(
    () => (bookingPurpose === PURPOSE_OTHER ? bookingPurposeOther.trim() : bookingPurpose),
    [bookingPurpose, bookingPurposeOther],
  );

  const bookingFormError = useMemo(() => {
    const titleLen = bookingTitle.trim().length;
    if (titleLen < BOOKING_TITLE_MIN || titleLen > BOOKING_TITLE_MAX) {
      return `Title must be between ${BOOKING_TITLE_MIN} and ${BOOKING_TITLE_MAX} characters.`;
    }
    const noteLen = bookingNote.trim().length;
    if (noteLen > 0 && (noteLen < BOOKING_NOTE_MIN || noteLen > BOOKING_NOTE_MAX)) {
      return `Note must be between ${BOOKING_NOTE_MIN} and ${BOOKING_NOTE_MAX} characters.`;
    }
    if (bookingPurpose === PURPOSE_OTHER && !bookingPurposeOther.trim()) {
      return 'Please describe your purpose.';
    }
    return null;
  }, [bookingTitle, bookingNote, bookingPurpose, bookingPurposeOther]);
  const [bookingViewerTz, setBookingViewerTz] = useState(
    () => userDetails?.timeZone || detectUserTimeZone(),
  );

  const [seminarBookingSuccessId, setSeminarBookingSuccessId] = useState<string | null>(null);
  const [seminarSeatRequestedId, setSeminarSeatRequestedId] = useState<string | null>(null);
  const [seminarBookingError, setSeminarBookingError] = useState<string | null>(null);
  /** Open seminar checkout (real groupChat id + price) when a student books from the profile. */
  const [seminarCheckout, setSeminarCheckout] = useState<
    { id: string; price: number; name: string; isSeatRequest?: boolean } | null
  >(null);
  /** Settling an overflow seat the host approved (wallet-pinned). */
  const [seatPayTarget, setSeatPayTarget] = useState<
    { requestId: string; groupChatId: string; price: number; name: string } | null
  >(null);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [displayImage, setDisplayImage] = useState(() => aiHeadshotUrl(mentor.name));

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
      // Keep the flow inside one continuous popup: confirming a time in the
      // picker advances straight to the review popup (which then continues to
      // payment), with no intermediate sidebar step.
      setBookingStep('review');
    },
    [],
  );

  const handleFilterSlotConfirmed = useCallback(() => {
    setBookingError(null);
    setBookingStep('review');
  }, []);

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

  const pickedSlotDisplay = useMemo(() => {
    if (!pickedStart || !pickedEnd) return null;
    return formatPickedSlotWhenDisplay(pickedStart, pickedEnd, bookingViewerTz);
  }, [pickedStart, pickedEnd, bookingViewerTz]);

  const changeOneToOneTime = useCallback(() => {
    clearPickedSlot();
    void loadExpertDetails();
    setBookingStep('pick');
  }, [clearPickedSlot, loadExpertDetails]);

  const bookingEventTitle = useMemo(() => {
    const student = userDetails?.username || 'Student';
    const expertName = mentor.name || expertDetails?.username || 'Expert';
    return `${student} & ${expertName}`;
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

  const submitOneToOne = useCallback(
    async (paymentIntentId: string, paymentMode: 'card' | 'wallet' = 'card') => {
      if (!pickedStart || !pickedEnd || !pickedDuration) {
        setBookingError('Please select a date and time on the calendar.');
        return;
      }
      SetLoadingStatus(true);
      setBookingError(null);
      try {
        const response = await createGroupChatByUser({
          paymentMode,
          name: bookingTitle.trim() || bookingEventTitle,
          description: bookingNote.trim(),
          services:
            bookingPurpose === PURPOSE_OTHER
              ? []
              : resolvedPurpose
                ? [resolvedPurpose]
                : [],
          purposeOther: bookingPurpose === PURPOSE_OTHER ? bookingPurposeOther.trim() : '',
          start: pickedStart.toISOString(),
          end: pickedEnd.toISOString(),
          duration: pickedDuration,
          price: oneToOneSessionPrice,
          expert: expertDetails?._id ?? mentor.id,
          payment_intent: paymentIntentId,
        });
        // createGroupChatByUser resolves to `false`/`{status:'FAIL'}` on failure
        // (it never throws) — only advance to success when the session persisted.
        if (!response || response === true || (response as any)?.status === 'FAIL' || !(response as any)?.result) {
          setBookingError(
            (response as any)?.error ||
              (paymentMode === 'wallet'
                ? 'We could not send your session request. You have not been charged — please try again.'
                : 'Your card was authorized, but we could not confirm the session. Please check your bookings or contact support before rebooking — any authorization is released automatically.'),
          );
          return;
        }
        window.localStorage.removeItem('pendingDetails');
        dispatch({ type: 'updateUserDetails', payload: (response as any).result });
        setBookingAwaitsWalletPayment(paymentMode === 'wallet');
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
      bookingTitle,
      bookingNote,
      bookingPurpose,
      bookingPurposeOther,
      resolvedPurpose,
      oneToOneSessionPrice,
      expertDetails?._id,
      mentor.id,
      dispatch,
    ],
  );

  useEffect(() => {
    if (paymentReturnSuccess) {
      setBookingStep('success');
      onPaymentReturnHandled?.();
    }
  }, [paymentReturnSuccess, onPaymentReturnHandled]);

  const bio = useMemo(() => {
    return `Professor ${mentor.name} is a ${mentor.title} focused on ${mentor.field}. With ${mentor.experience} of experience, they guide students through research and real-world preparation across 1:1 sessions and seminars.`;
  }, [mentor]);

  // Seminars this student is already in. Without it the profile happily offers a
  // second checkout for a seminar they have paid for — the backend rejects and
  // refunds, but only after taking the money. A recurring series enrols across
  // every occurrence, so one booked occurrence marks the whole series.
  const myEnrollment = useMemo(() => {
    const ids = new Set<string>();
    const series = new Set<string>();
    (userDetails?.groupChats || []).forEach((g: any) => {
      if (g?.type !== 'seminar') return;
      if (g?._id) ids.add(String(g._id));
      if (g?.seriesId) series.add(String(g.seriesId));
    });
    return { ids, series };
  }, [userDetails?.groupChats]);

  // Seat requests still awaiting the host's decision — the card must not offer a
  // second hold on top of the one already authorized.
  // Open seat requests, both those awaiting the host and those approved but unpaid —
  // an unpaid approval must not read as "no request" and re-offer the waiting list.
  const [seatRequestIndex, setSeatRequestIndex] = useState<SeatRequestIndex>(
    emptySeatRequestIndex,
  );

  useEffect(() => {
    if (!userDetails?._id) return;
    let cancelled = false;
    void (async () => {
      const res: any = await getMySeatRequests();
      if (cancelled) return;
      setSeatRequestIndex(indexSeatRequests(res?.result));
    })();
    return () => {
      cancelled = true;
    };
  }, [userDetails?._id, seminarBookingSuccessId, seminarSeatRequestedId]);

  // Real seminars this expert hosts come from their groupChats (type 'seminar'),
  // populated by getExpertById. Split into past/upcoming by start time.
  const seminarTimeline = useMemo(() => {
    const now = Date.now();
    const freqLabel: Record<string, string> = {
      weekly: 'Weekly',
      biweekly: 'Biweekly',
      monthly: 'Monthly',
    };
    const isMine = (g: any, ids: Set<string>, series: Set<string>) =>
      ids.has(String(g?._id ?? '')) || (!!g?.seriesId && series.has(String(g.seriesId)));

    const mapSeminar = (g: any) => {
      const d = new Date(g?.start);
      const valid = !Number.isNaN(d.getTime());
      // Enrolled students exclude the host (the admin is always a participant).
      const enrolled = Math.max(
        0,
        (Array.isArray(g?.participants) ? g.participants.length : 0) - 1,
      );
      const maxAttendees = typeof g?.maxAttendees === 'number' ? g.maxAttendees : null;
      return {
        id: String(g?._id ?? ''),
        title: g?.name || 'Seminar',
        date: valid ? d.toLocaleDateString() : 'TBD',
        time: valid
          ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '',
        startTs: valid ? d.getTime() : 0,
        price: typeof g?.price === 'number' ? g.price : 0,
        attendees: enrolled,
        maxAttendees,
        isFull: maxAttendees != null && (maxAttendees <= 0 || enrolled >= maxAttendees),
        seriesId: g?.seriesId ? String(g.seriesId) : null,
        recurrenceLabel: g?.isRecurring ? freqLabel[g?.recurrenceFrequency] ?? null : null,
        registered: isMine(g, myEnrollment.ids, myEnrollment.series),
        // Distinguishes "waiting on the host" from "approved, pay to claim it".
        seatRequest: seatRequestFor(seatRequestIndex, g),
      };
    };

    const collapseSeries = (list: any[]) => {
      const seen = new Set<string>();
      const out: any[] = [];
      for (const s of list) {
        if (s.seriesId) {
          if (seen.has(s.seriesId)) continue;
          seen.add(s.seriesId);
        }
        out.push(s);
      }
      return out;
    };

    const all = (expertDetails?.groupChats || [])
      .filter((g: any) => g?.type === 'seminar' && g?.status !== 'draft' && g?.status !== 'cancelled')
      .map(mapSeminar);

    const past = collapseSeries(
      all
        .filter((s: any) => s.startTs && s.startTs < now)
        .sort((a: any, b: any) => b.startTs - a.startTs),
    );
    const upcoming = collapseSeries(
      all
        .filter((s: any) => !s.startTs || s.startTs >= now)
        .sort((a: any, b: any) => a.startTs - b.startTs),
    );

    return { past, upcoming };
  }, [expertDetails?.groupChats, myEnrollment, seatRequestIndex]);

  const registerSeminar = useCallback(
    async (paymentIntentId: string) => {
      if (!seminarCheckout) return;
      SetLoadingStatus(true);
      setSeminarBookingError(null);
      try {
        const res: any = await registerForSeminar({
          groupChatId: seminarCheckout.id,
          payment_intent: paymentIntentId,
        });
        if (res === false || res?.status === 'FAIL' || res?.error) {
          setSeminarBookingError(
            res?.error || 'Could not complete seminar registration.',
          );
          return;
        }
        window.localStorage.removeItem('pendingDetails');
        if (res?.status === 'pending_approval') {
          setSeminarSeatRequestedId(seminarCheckout.id);
          setSeminarCheckout(null);
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

  // Settle an approved overflow seat, then reflect the new enrollment.
  const paySeatRequest = useCallback(async (paymentIntentId: string) => {
    if (!seatPayTarget) return;
    SetLoadingStatus(true);
    setSeminarBookingError(null);
    try {
      const { paySeminarSeatRequest } = await import('../../api/api');
      const res: any = await paySeminarSeatRequest({
        requestId: seatPayTarget.requestId,
        payment_intent: paymentIntentId,
      });
      if (res === false || res?.status === 'FAIL' || res?.error) {
        setSeminarBookingError(res?.error || 'Could not confirm your seat after payment.');
        return;
      }
      window.localStorage.removeItem('pendingDetails');
      setSeminarBookingSuccessId(seatPayTarget.groupChatId);
      setSeatPayTarget(null);
      void loadExpertDetails();
    } catch (e: any) {
      setSeminarBookingError(e?.message || 'Could not confirm your seat after payment.');
    } finally {
      SetLoadingStatus(false);
    }
  }, [seatPayTarget, loadExpertDetails]);

  // Wallet route for a full seminar: ask the host first, pay only once approved.
  const requestSeminarSeatWithWallet = useCallback(async () => {
    if (!seminarCheckout) return;
    SetLoadingStatus(true);
    setSeminarBookingError(null);
    try {
      const res: any = await requestSeminarSeat({
        groupChatId: seminarCheckout.id,
        paymentMode: 'wallet',
      });
      if (res === false || res?.status === 'FAIL' || res?.error) {
        setSeminarBookingError(res?.error || 'Could not send your seat request.');
        return;
      }
      window.localStorage.removeItem('pendingDetails');
      setSeminarSeatRequestedId(seminarCheckout.id);
      setSeminarCheckout(null);
    } catch (e: any) {
      setSeminarBookingError(e?.message || 'Could not send your seat request.');
    } finally {
      SetLoadingStatus(false);
    }
  }, [seminarCheckout]);

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
                <h1 className="font-serif text-[2rem] font-medium text-[#1A3A4A] leading-tight">
                  {mentor.name}
                </h1>
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-[3px] border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-slate-700">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {displayFollowers.toLocaleString()} followers
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#7A7A72]">
                  {mentor.title} · {mentor.institution}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(mentor.majors && mentor.majors.length > 0
                    ? mentor.majors
                    : [{ label: mentor.field, custom: false }]
                  ).map((major, idx) => (
                    <span
                      key={`${major.label}-${idx}`}
                      title={major.custom ? 'Self-declared major, pending review' : undefined}
                      className={
                        major.custom
                          ? 'inline-flex items-center gap-2 rounded-[3px] border border-dashed border-[#CFC9BC] bg-transparent px-3 py-1.5 text-[12px] font-semibold text-[#7A7A72]'
                          : 'inline-flex items-center gap-2 rounded-[3px] border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A]'
                      }
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {major.label}
                    </span>
                  ))}
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
              <div className="mt-3 min-h-[140px] max-h-[420px] space-y-2 overflow-y-auto pr-1">
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
                        {item.date} · {seminarCapacityLabel(item.attendees, item.maxAttendees, { omitFullWord: true })}
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
              <div className="mt-3 min-h-[140px] max-h-[420px] space-y-2 overflow-y-auto pr-1">
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
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#1A3A4A]">{item.title}</p>
                      {item.recurrenceLabel ? (
                        <span className="inline-flex items-center rounded-full bg-[#E8EEF4] px-2 py-0.5 text-[10px] font-medium text-[#234C6A]">
                          {item.recurrenceLabel}
                        </span>
                      ) : null}
                      {item.registered || seminarBookingSuccessId === item.id ? (
                        <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Registered
                        </span>
                      ) : item.seatRequest?.state === 'awaiting_payment' ? (
                        <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Seat approved
                        </span>
                      ) : item.seatRequest || seminarSeatRequestedId === item.id ? (
                        <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Awaiting approval
                        </span>
                      ) : item.isFull ? (
                        <span className="ml-auto inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                          Full
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-[#7A7A72]">
                      {item.recurrenceLabel ? 'Next: ' : ''}{item.date}{item.time ? ` · ${item.time}` : ''}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold text-[#1A3A4A]">
                      {item.price > 0 ? `$${item.price.toFixed(2)}` : 'Free'}
                    </p>
                    {seminarBookingSuccessId === item.id ? (
                      <div className="mt-2 rounded-[4px] bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                        You're enrolled in this seminar{item.recurrenceLabel ? ' series' : ''}.
                      </div>
                    ) : item.registered ? null : item.seatRequest?.state === 'awaiting_payment' ? (
                      <div className="mt-2 space-y-2">
                        <p className="rounded-[4px] bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                          The host approved your seat. Pay to claim it
                          {item.seatRequest.payBy
                            ? ` by ${new Date(item.seatRequest.payBy).toLocaleString()}`
                            : ''}
                          .
                        </p>
                        <button
                          type="button"
                          onClick={() => setSeatPayTarget({
                            requestId: item.seatRequest!.requestId,
                            groupChatId: item.id,
                            price: item.seatRequest!.price,
                            name: item.title,
                          })}
                          className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#122635]"
                        >
                          Pay ${item.seatRequest.price} to confirm your seat
                        </button>
                      </div>
                    ) : item.seatRequest || seminarSeatRequestedId === item.id ? (
                      <div className="mt-2 rounded-[4px] bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                        You’re on the waiting list — awaiting host approval.
                      </div>
                    ) : (
                      (() => {
                        const waitingList = seatRequestWindow(item.startTs);
                        const canJoinWaitingList =
                          item.isFull && waitingList.state === 'open';
                        return (
                          <div className="mt-2 space-y-2">
                            {item.isFull ? (
                              <p
                                className={`rounded-[4px] px-3 py-2 text-[11px] ${
                                  canJoinWaitingList
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-[#F5F3EF] text-[#7A7A72]'
                                }`}
                              >
                                {seatRequestWindowMessage(waitingList, { price: item.price })}
                              </p>
                            ) : null}
                            {!item.isFull || canJoinWaitingList ? (
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
                                    isSeatRequest: item.isFull,
                                  });
                                }}
                                className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#122635]"
                              >
                                {item.isFull ? seatRequestActionLabel(item.price) : 'Book the session'}
                              </button>
                            ) : null}
                          </div>
                        );
                      })()
                    )}
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
                  Book a 1:1 session
                </h2>
                <p className="mt-1 text-[12px] text-[#7A7A72]">
                  Pick a time on the expert&apos;s calendar, then continue to payment. To join a
                  seminar, use the Upcoming seminars list.
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
                      Total uses the expert&apos;s hourly rate × appointment duration.
                    </p>
                  </>
                )}
              </div>

              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                  Rates
                </h3>
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
                          {pickedStart && pickedEnd && pickedDuration ? (
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
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7A7A72] mb-2">
                  Availability
                </p>
                {bookingStep === 'success' ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <p className="text-[14px] font-semibold text-emerald-900">
                        Request sent
                      </p>
                      <p className="mt-1 text-[12px] text-emerald-800">
                        {bookingAwaitsWalletPayment
                          ? `Your request was sent to ${mentor.name} and nothing has been charged. If they accept, we'll email you a link to pay with WeChat Pay or Alipay — you'll have 24 hours to complete it, and the session is confirmed as soon as you do.`
                          : `Your request was sent to ${mentor.name}. Your card is authorized but not charged — you are only charged if they accept. You will see the session on your calendar once confirmed.`}
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
                        onFilterSlotConfirmed={handleFilterSlotConfirmed}
                      />
                    )}
                  </div>
                )}
              </div>

              {bookingError && (
                <div className="text-[12px] font-semibold text-red-600">{bookingError}</div>
              )}

              {bookingStep === 'success' ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex w-full items-center justify-center rounded-[4px] border border-[#E5E2DB] bg-white px-4 py-3 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
                >
                  Back to experts
                </button>
              ) : null}
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
    {bookingStep === 'review' ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) changeOneToOneTime();
        }}
      >
        <div className="my-auto w-full max-w-md">
          <div className="rounded-2xl border border-[#E5E2DB] bg-white p-4 sm:p-6 space-y-4">
            <p className="font-serif text-lg font-medium text-[#1A3A4A]">Review your booking</p>
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

            <div className="space-y-3 border-t border-[#E5E2DB] pt-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-[#1A3A4A]">
                    Title <span className="font-normal text-[#7A7A72]">(subject of the meeting)</span>
                  </label>
                  <span className="text-[11px] text-[#7A7A72]">
                    {bookingTitle.trim().length}/{BOOKING_TITLE_MAX}
                  </span>
                </div>
                <input
                  type="text"
                  value={bookingTitle}
                  maxLength={BOOKING_TITLE_MAX}
                  onChange={(e) => setBookingTitle(e.target.value)}
                  placeholder="e.g. PhD Application Advice"
                  className="mt-1 w-full rounded-[4px] border border-[#E5E2DB] px-3 py-2 text-[13px] text-[#1A3A4A] outline-none focus:border-[#1A3A4A]"
                />
              </div>

              <div>
                <label className="text-[13px] font-semibold text-[#1A3A4A]">Purpose</label>
                <select
                  value={bookingPurpose}
                  onChange={(e) => setBookingPurpose(e.target.value)}
                  className="mt-1 w-full rounded-[4px] border border-[#E5E2DB] bg-white px-3 py-2 text-[13px] text-[#1A3A4A] outline-none focus:border-[#1A3A4A]"
                >
                  <option value="">Select a purpose…</option>
                  {purposeOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {bookingPurpose === PURPOSE_OTHER ? (
                  <input
                    type="text"
                    value={bookingPurposeOther}
                    maxLength={100}
                    onChange={(e) => setBookingPurposeOther(e.target.value)}
                    placeholder="Describe your purpose"
                    className="mt-2 w-full rounded-[4px] border border-[#E5E2DB] px-3 py-2 text-[13px] text-[#1A3A4A] outline-none focus:border-[#1A3A4A]"
                  />
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-[#1A3A4A]">
                    Note <span className="font-normal text-[#7A7A72]">(optional)</span>
                  </label>
                  <span className="text-[11px] text-[#7A7A72]">
                    {bookingNote.trim().length}/{BOOKING_NOTE_MAX}
                  </span>
                </div>
                <textarea
                  value={bookingNote}
                  maxLength={BOOKING_NOTE_MAX}
                  onChange={(e) => setBookingNote(e.target.value)}
                  rows={3}
                  placeholder="Add a brief note so the expert can prepare (e.g. goals, background, questions)."
                  className="mt-1 w-full resize-y rounded-[4px] border border-[#E5E2DB] px-3 py-2 text-[13px] text-[#1A3A4A] outline-none focus:border-[#1A3A4A]"
                />
              </div>

              {bookingFormError ? (
                <p className="text-[12px] text-red-600">{bookingFormError}</p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!!bookingFormError}
              onClick={() => setBookingStep('pay')}
              className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635] disabled:opacity-50"
            >
              Continue to payment
            </button>
            <button
              type="button"
              onClick={changeOneToOneTime}
              className="inline-flex w-full items-center justify-center rounded-[4px] border border-[#E5E2DB] px-4 py-2.5 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
            >
              Change time
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {bookingStep === 'pay' ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) setBookingStep('review');
        }}
      >
        <div className="my-auto w-full max-w-2xl">
          <StudentBookingCheckout
            type="1:1 session"
            price={oneToOneSessionPrice}
            holdsFunds
            returnUrl={studentBookingReturnUrl}
            policyNotice={{
              message:
                'Once you submit, you cannot cancel this request. Your card is authorized but not charged — if the expert declines, the authorization is released and no payment is processed.',
              acknowledgeLabel: 'I understand this payment cannot be cancelled.',
            }}
            pendingDetails={{
              name: bookingTitle.trim() || bookingEventTitle,
              description: bookingNote.trim(),
              services: resolvedPurpose ? [resolvedPurpose] : [],
              purposeOther: bookingPurpose === PURPOSE_OTHER ? bookingPurposeOther.trim() : '',
              start: pickedStart!.toISOString(),
              end: pickedEnd!.toISOString(),
              duration: pickedDuration,
              price: oneToOneSessionPrice,
              expert: String(expertDetails?._id ?? mentor.id),
            }}
            walletOption={{
              kind: 'request',
              onSubmit: () => submitOneToOne('', 'wallet'),
            }}
            onPaymentSuccess={(paymentIntentId) => submitOneToOne(paymentIntentId, 'card')}
            onCancel={() => setBookingStep('review')}
            cancelLabel="Back"
          />
        </div>
      </div>
    ) : null}
    {seminarCheckout ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSeminarCheckout(null);
        }}
      >
        <div className="my-auto w-full max-w-2xl">
          <StudentBookingCheckout
            type="Seminar"
            price={seminarCheckout.price}
            isSeatRequest={!!seminarCheckout.isSeatRequest}
            holdsFunds
            returnUrl={studentBookingReturnUrl}
            pendingDetails={{
              groupChatId: seminarCheckout.id,
              price: seminarCheckout.price,
              name: seminarCheckout.name,
            }}
            walletOption={
              seminarCheckout.isSeatRequest
                ? { kind: 'request', onSubmit: requestSeminarSeatWithWallet }
                : { kind: 'charge' }
            }
            onPaymentSuccess={registerSeminar}
            onCancel={() => setSeminarCheckout(null)}
          />
        </div>
      </div>
    ) : null}
    {seatPayTarget ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSeatPayTarget(null);
        }}
      >
        <div className="my-auto w-full max-w-2xl">
          <StudentBookingCheckout
            type="Seminar seat"
            price={seatPayTarget.price}
            pendingDetails={{
              kind: 'pay-seat-request',
              requestId: seatPayTarget.requestId,
              groupChatId: seatPayTarget.groupChatId,
              price: seatPayTarget.price,
              name: seatPayTarget.name,
            }}
            returnUrl={studentBookingReturnUrl}
            // Approved without a hold, so it settles in the mode it was requested in.
            walletOption={{ kind: 'charge', only: true }}
            onPaymentSuccess={paySeatRequest}
            onCancel={() => setSeatPayTarget(null)}
            cancelLabel="Back"
          />
        </div>
      </div>
    ) : null}
    </>
  );
}
