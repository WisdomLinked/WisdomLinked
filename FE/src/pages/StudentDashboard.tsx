import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import { BookOpen, UserCheck, AlertCircle, MessageSquare, Users } from 'lucide-react';
import { useAppSelector } from '../store';
import { doGetMyEvents, getAllCommunityChats, profileImageFetch, doFilterExperts, doFilterSeminars } from '../api/api';
import { resolveProfileImageSrc } from '../utils/profileImage';
import { sessionDurationLabel, sessionDurationMinutes } from '../utils/sessionDuration';
import { displayRoomLabel, shouldNotifyRoom } from '../utils/chatRoomLabel';
import { fetchDmUnreadSnapshot, fetchChatUserProfile } from '../api/chatApi';
import ProfileModal from './Dashboard/Messenger/Messages/ProfileModal';
import { buildFallbackChatProfile, mergeChatProfile } from '../utils/chatProfileModal';
import Sidebar from '../components/layout/Sidebar';
import TopBar, { TopBarNotificationItem } from '../components/layout/TopBar';
import StatsGrid from '../components/dashboard/StatsGrid';
import CarouselSection, { type CarouselSectionData } from '../components/dashboard/CarouselSection';
import StudentProfile from '../components/dashboard/StudentProfile';
import StudentSettings from '../components/dashboard/StudentSettings';
import DecisionNotices from '../components/dashboard/DecisionNotices';
import StudentCalendar, { type Meeting as CalendarMeeting } from '../components/dashboard/StudentCalendar';
import JoinMeeting from '../components/dashboard/JoinMeeting';
import StudentSeminars from '../components/dashboard/StudentSeminars';
import FindExpertsPage from './FindExperts';
import Chatbot from '../components/chatbot';
import ContactAdmin from './Dashboard/_ExpertDashboard/ContactAdmin';
import UpcomingCountdownCard, { type UpcomingSession } from '../components/dashboard/UpcomingCountdownCard';
import UpcomingSessionModal, { type UpcomingModalSession } from '../components/dashboard/UpcomingSessionModal';
import ExpertProfile from '../components/dashboard/ExpertProfile';
import StudentBookingCheckout, { completeStudentBookingFromStorage } from '../components/dashboard/StudentBookingCheckout';
import { getExpertById, doFollowExpert, doUnfollowExpert, acceptIndividualAppointment, getMySeatRequests } from '../api/api';
import { updateMe } from '../actions/authActions';
import type { ExpertCardProps } from '../components/ExpertCard';
import { mapExpertToMentorWithImage } from '../utils/mapExpertToMentor';
import StudentChat from '../components/dashboard/StudentChat';
import StudentPaymentHistory from '../components/dashboard/StudentPaymentHistory';
import { detectUserTimeZone, toYMDInTimeZone } from '../utils/schedulingTimezone';
import {
  connectToRC,
  onSubscriptionChanged,
  subscribeToRoom,
} from '../services/rcRealtime';
import { patchDmUnreadRid, setDmUnreadByRidBulk } from '../actions/chatActions';
import { canonicalLabelsFromMixedServiceEntries } from '../constants/serviceOptions';
import { useEndMeetingOnReturn } from '../hooks/useEndMeetingOnReturn';
import { pendingRequestIsLive } from '../utils/bookingLifecycle';

function deriveSessionCounts(u: any) {
  if (!u) {
    return { bookedSem: 0, bookedInd: 0, pendInd: 0 };
  }
  const events = u.events || [];
  const gcs = u.groupChats || [];

  // 1:1s live in two disjoint systems: student-booked sessions are individual
  // groupChats ('pending' → awaiting approval, 'active' → booked); expert-created
  // / legacy ones are events. Count both so the cards reflect every 1:1.
  const indChats = gcs.filter((g: any) => g.type === 'individual');
  const pendIndChats = indChats.filter(
    (g: any) =>
      (g.status || '').toLowerCase() === 'pending' && pendingRequestIsLive(g),
  ).length;
  const bookedIndChats = indChats.filter(
    (g: any) => (g.status || '').toLowerCase() === 'active',
  ).length;

  const pendIndEvents = events.filter(
    (e: any) => (e.status || '').toLowerCase() === 'pending',
  ).length;
  const bookedIndEvents = events.filter((e: any) => {
    const s = (e.status || '').toLowerCase();
    return s === 'accepted' || s === 'confirmed' || s === 'approved';
  }).length;

  const pendInd = pendIndChats + pendIndEvents;
  const bookedInd = bookedIndChats + bookedIndEvents;

  const bookedSem = gcs.filter((g: any) => g.type === 'seminar').length;
  return { bookedSem, bookedInd, pendInd };
}

/** Wall-clock HH:MM for an instant in the given IANA timezone (24h, DST-aware). */
function timeHHMMInTimeZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * Build the calendar's meetings from the user's real bookings, projected into
 * the student's configured timezone. 1:1 sessions live in two disjoint systems:
 *  - Seminars + student-booked 1:1s are groupChats. Individual chats carry a
 *    status: 'pending' (awaiting expert approval) or 'active' (confirmed);
 *    'cancelled' is dropped. Seminars are always confirmed.
 *  - Expert-created / legacy 1:1s live in events: 'pending' plus
 *    accepted/confirmed/approved (declined/cancelled dropped).
 * Past/upcoming split is handled inside StudentCalendar.
 */
/** "45 min · Study Abroad" line for a session/seminar card. */
function meetingDetailsLine(g: any): string {
  const parts: string[] = [];
  const duration = sessionDurationLabel(g);
  if (duration) parts.push(duration);
  const purpose =
    (typeof g?.purposeOther === 'string' && g.purposeOther.trim()) ||
    canonicalLabelsFromMixedServiceEntries(g?.services)[0] ||
    '';
  if (purpose) parts.push(purpose);
  return parts.join(' · ');
}

function deriveCalendarMeetings(u: any): CalendarMeeting[] {
  if (!u) return [];
  const tz = u?.timeZone || detectUserTimeZone();
  const out: CalendarMeeting[] = [];

  const pushMeeting = (
    rawId: any,
    fallback: string,
    title: string,
    start: any,
    type: 'seminar' | 'session',
    status: 'pending' | 'confirmed',
    withLabel: string,
    routing: Partial<Pick<CalendarMeeting, 'groupId' | 'peerUserId' | 'peerName' | 'peerImage' | 'recurrence' | 'seriesId' | 'details' | 'raw'>> = {},
  ) => {
    // start may be an ISO string (Date field) or epoch ms — new Date handles both.
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return;
    out.push({
      id: String(rawId ?? fallback),
      title,
      date: toYMDInTimeZone(d, tz),
      time: timeHHMMInTimeZone(d, tz),
      with: withLabel,
      location: 'Online · WisdomLinked Room',
      type,
      status,
      ...routing,
    });
  };

  for (const g of u?.groupChats || []) {
    const host = g?.admin?.username || g?.admin?.email || 'WisdomLinked';
    const gStatus = (g?.status || '').toLowerCase();
    if (g?.type === 'seminar') {
      pushMeeting(
        g?._id,
        `seminar-${g?.start}`,
        g?.name || 'Seminar',
        g?.start,
        'seminar',
        'confirmed',
        `Seminar host: ${host}`,
        {
          groupId: g?._id != null ? String(g._id) : undefined,
          peerUserId: g?.admin?._id != null ? String(g.admin._id) : undefined,
          peerName: host,
          peerImage: g?.admin?.image ?? null,
          recurrence: g?.isRecurring ? g?.recurrenceFrequency ?? null : null,
          seriesId: g?.seriesId ? String(g.seriesId) : null,
          details: meetingDetailsLine(g),
          raw: g,
        },
      );
    } else if (g?.type === 'individual' && gStatus !== 'cancelled') {
      // For a 1:1 group chat the admin is the expert (both expert- and student-created).
      pushMeeting(
        g?._id,
        `session-${g?.start}`,
        g?.name || '1:1 session',
        g?.start,
        'session',
        gStatus === 'active' ? 'confirmed' : 'pending',
        `Mentor: ${host}`,
        {
          peerUserId: g?.admin?._id != null ? String(g.admin._id) : undefined,
          peerName: host,
          peerImage: g?.admin?.image ?? null,
          details: meetingDetailsLine(g),
          raw: g,
        },
      );
    }
  }

  const CONFIRMED_EVENT = ['accepted', 'confirmed', 'approved'];
  for (const e of u?.events || []) {
    const status = (e?.status || '').toLowerCase();
    const isPending = status === 'pending';
    if (!isPending && !CONFIRMED_EVENT.includes(status)) continue;
    const mentor = e?.expert?.username || e?.expert?.email || 'Your mentor';
    pushMeeting(
      e?._id,
      `event-${e?.start}`,
      e?.title || '1:1 session',
      e?.start,
      'session',
      isPending ? 'pending' : 'confirmed',
      `Mentor: ${mentor}`,
      {
        peerUserId: e?.expert?._id != null ? String(e.expert._id) : undefined,
        peerName: mentor,
        peerImage: e?.expert?.image ?? null,
        details: meetingDetailsLine(e),
        raw: e,
      },
    );
  }

  return out;
}

function modalWhen(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Build the session list for the UpcomingSessionModal opened from a StatsGrid
 * card. Mirrors deriveSessionCounts so the rows match the card's number:
 * seminars come from groupChats, 1:1s from events.
 */
function deriveModalSessions(
  u: any,
  kind: 'seminar' | 'oneToOne',
  status: 'booked' | 'pending',
): UpcomingModalSession[] {
  if (!u) return [];

  const seminarToModal = (g: any): UpcomingModalSession => {
    const at = new Date(g?.start).getTime();
    return {
      id: String(g?._id ?? `${g?.type}-${at}`),
      title: g?.name || 'Seminar',
      at: Number.isNaN(at) ? 0 : at,
      when: Number.isNaN(at) ? 'TBD' : modalWhen(at),
      durationMinutes: sessionDurationMinutes(g) ?? undefined,
      location: 'Online · WisdomLinked Room',
      with: g?.admin?.username || g?.admin?.email || 'WisdomLinked',
      peerUserId: String(g?.admin?._id ?? g?.admin ?? ''),
      detail: {
        title: g?.name || 'Seminar',
        description: g?.description,
        start: g?.start,
        end: g?.end,
        duration: g?.duration,
        price: typeof g?.price === 'number' ? g.price : undefined,
        admin: g?.admin,
        participants: g?.participants || [],
        keywords: g?.keywords,
        services: g?.services,
        purposeOther: g?.purposeOther,
        type: g?.type,
        isRecurring: g?.isRecurring,
        recurrenceFrequency: g?.recurrenceFrequency,
      },
      briefLabel: 'Seminar details',
    };
  };

  if (kind === 'seminar') {
    // Seminars are always confirmed (no approval) — only the 'booked' list applies.
    return (u.groupChats || [])
      .filter((g: any) => g?.type === 'seminar')
      .map(seminarToModal);
  }

  // 1:1s come from two disjoint systems: student-booked sessions are individual
  // groupChats ('active' = booked, 'pending' = awaiting approval); expert-created
  // / legacy ones are events. Merge both so the modal matches the card count.
  const indChatWanted =
    status === 'pending'
      ? (s: string) => s === 'pending'
      : (s: string) => s === 'active';
  const myId = String(u?._id ?? '');
  const fromChats = (u.groupChats || [])
    .filter(
      (g: any) =>
        g?.type === 'individual' &&
        indChatWanted((g?.status || '').toLowerCase()) &&
        // A request whose session time has passed can no longer be accepted or paid
        // for, so listing it as awaiting approval promises a decision that can't come.
        (status !== 'pending' || pendingRequestIsLive(g)),
    )
    .map((g: any) => {
      const at = new Date(g?.start).getTime();
      // Expert-proposed pending 1:1s (createdBy = the mentor) await the student's
      // payment; student-booked ones (createdBy = me) await the mentor's approval.
      const createdById = String(g?.createdBy?._id ?? g?.createdBy ?? '');
      const expired = !Number.isNaN(at) && at > 0 && at <= Date.now();
      // A wallet 1:1 the student booked is theirs to pay for once the expert accepts,
      // which is the moment a payment deadline appears on it.
      const walletWindowOpen =
        g?.paymentMode === 'wallet' &&
        !!g?.paymentDeadline &&
        new Date(g.paymentDeadline).getTime() > Date.now();
      const payable =
        status === 'pending' &&
        !expired &&
        ((createdById !== '' && createdById !== myId) || walletWindowOpen);
      const mentor = g?.admin?.username || g?.admin?.email || 'Your mentor';
      const price = typeof g?.price === 'number' ? g.price : undefined;
      return {
        id: String(g?._id ?? `session-${at}`),
        title: g?.name || '1:1 session',
        at: Number.isNaN(at) ? 0 : at,
        when: Number.isNaN(at) ? 'TBD' : modalWhen(at),
        durationMinutes: sessionDurationMinutes(g) ?? undefined,
        location: 'Online · WisdomLinked Room',
        with: mentor,
        peerUserId: String(g?.admin?._id ?? g?.admin ?? ''),
        payable,
        price,
        paymentMode: g?.paymentMode,
        detail: {
          title: g?.name || '1:1 session',
          description: g?.description,
          start: g?.start,
          end: g?.end,
          duration: g?.duration,
          price,
          admin: g?.admin,
          participants: g?.participants || [],
          keywords: g?.keywords,
          services: g?.services,
          purposeOther: g?.purposeOther,
          type: g?.type,
          isRecurring: g?.isRecurring,
          recurrenceFrequency: g?.recurrenceFrequency,
        },
        briefLabel: 'Session details',
      };
    });

  const eventWanted =
    status === 'pending'
      ? (s: string) => s === 'pending'
      : (s: string) => ['accepted', 'confirmed', 'approved'].includes(s);
  const fromEvents = (u.events || [])
    .filter((e: any) => eventWanted((e?.status || '').toLowerCase()))
    .map((e: any) => {
      const at = new Date(e?.start).getTime();
      return {
        id: String(e?._id ?? `event-${at}`),
        title: e?.title || '1:1 session',
        at: Number.isNaN(at) ? 0 : at,
        when: Number.isNaN(at) ? 'TBD' : modalWhen(at),
        durationMinutes: sessionDurationMinutes(e) ?? undefined,
        location: 'Online · WisdomLinked Room',
        with: e?.expert?.username || e?.expert?.email || 'Your mentor',
        peerUserId: String(e?.expert?._id ?? e?.expert ?? ''),
      };
    });

  return [...fromChats, ...fromEvents];
}

/**
 * Find the soonest upcoming seminar and 1:1 from the user's real bookings,
 * for the "Upcoming sessions" countdown card. Mirrors deriveSessionCounts /
 * deriveModalSessions: seminars come from groupChats, but 1:1s live in two
 * disjoint systems — student-booked individual groupChats ('active' = booked)
 * and expert-created / legacy events (accepted/confirmed/approved) — so both
 * are scanned for the next 1:1.
 */
function deriveUpcomingSessions(u: any): {
  nextSeminar: UpcomingSession | null;
  nextOneToOne: UpcomingSession | null;
} {
  const now = Date.now();
  let nextSeminar: UpcomingSession | null = null;
  let nextOneToOne: UpcomingSession | null = null;

  const considerOneToOne = (session: UpcomingSession) => {
    if (!nextOneToOne || session.startAt < nextOneToOne.startAt) {
      nextOneToOne = session;
    }
  };

  for (const g of u?.groupChats || []) {
    const startAt = new Date(g?.start).getTime();
    if (Number.isNaN(startAt) || startAt <= now) continue;

    const status = (g?.status || '').toLowerCase();
    const isSeminar = g?.type === 'seminar';
    const isSession =
      g?.type === 'individual' && (status === 'active' || status === 'pending');

    if (isSeminar && (!nextSeminar || startAt < nextSeminar.startAt)) {
      nextSeminar = {
        title: g?.name || 'Seminar',
        startAt,
        durationMinutes: sessionDurationMinutes(g) ?? undefined,
        id: String(g?._id ?? ''),
      };
    } else if (isSession) {
      considerOneToOne({
        title: g?.name || '1:1 session',
        startAt,
        durationMinutes: sessionDurationMinutes(g) ?? undefined,
        peerUserId: String(g?.admin?._id ?? g?.admin ?? ''),
        pending: status === 'pending',
      });
    }
  }

  const CONFIRMED_EVENT = ['accepted', 'confirmed', 'approved'];
  for (const e of u?.events || []) {
    const startAt = new Date(e?.start).getTime();
    if (Number.isNaN(startAt) || startAt <= now) continue;
    const status = (e?.status || '').toLowerCase();
    const isPending = status === 'pending';
    if (!CONFIRMED_EVENT.includes(status) && !isPending) continue;
    considerOneToOne({
      title: e?.title || '1:1 session',
      startAt,
      durationMinutes: sessionDurationMinutes(e) ?? undefined,
      peerUserId: String(e?.expert?._id ?? e?.expert ?? ''),
      pending: isPending,
    });
  }

  return { nextSeminar, nextOneToOne };
}

export default function StudentDashboard() {
  useEndMeetingOnReturn();
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState(() => {
    const saved = window.localStorage.getItem('studentDashboardView');
    if (!saved) return 'dashboard';
    if (saved === 'expert-profile') {
      return window.localStorage.getItem('studentDashboardExpertId')
        ? 'expert-profile'
        : 'dashboard';
    }
    return saved;
  });
  useEffect(() => {
    window.localStorage.setItem('studentDashboardView', activeItem);
  }, [activeItem]);
  const [paymentReturnSuccess, setPaymentReturnSuccess] = useState(false);
  const [bookingReturnError, setBookingReturnError] = useState<string | null>(null);
  const [paySuccessToast, setPaySuccessToast] = useState(false);
  const [seatRequestToast, setSeatRequestToast] = useState(false);
  useEffect(() => {
    if (!seatRequestToast) return;
    const t = window.setTimeout(() => setSeatRequestToast(false), 6000);
    return () => window.clearTimeout(t);
  }, [seatRequestToast]);

  useEffect(() => {
    if (!paySuccessToast) return;
    const t = window.setTimeout(() => setPaySuccessToast(false), 4000);
    return () => window.clearTimeout(t);
  }, [paySuccessToast]);
  const [dmUnreadByRid, setDmUnreadByRid] = useState<Record<string, number>>({});
  const [rcRoomNameByRid, setRcRoomNameByRid] = useState<Record<string, string>>({});
  const [rcDisplayNameByRid, setRcDisplayNameByRid] = useState<Record<string, string>>({});
  const [roomNamesUnresolved, setRoomNamesUnresolved] = useState(false);
  const [knownRids, setKnownRids] = useState<string[]>([]);
  /** Same source as chat sidebar — RC room id → community name (DMs use directConversations only). */
  const [communityRidToName, setCommunityRidToName] = useState<Record<string, string>>({});
  const [selectedExpert, setSelectedExpert] = useState<ExpertCardProps | null>(null);
  const [followedMentorIds, setFollowedMentorIds] = useState<string[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const { auth: { userDetails } } = useAppSelector((state: any) => state);

  useEffect(() => {
    if (selectedExpert?.id != null) {
      window.localStorage.setItem('studentDashboardExpertId', String(selectedExpert.id));
    }
  }, [selectedExpert?.id]);

  useEffect(() => {
    if (activeItem !== 'expert-profile' || selectedExpert) return;
    const savedId = window.localStorage.getItem('studentDashboardExpertId');
    if (!savedId) {
      setActiveItem('experts');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res: any = await getExpertById(savedId);
        if (cancelled) return;
        if (res?.result) {
          setSelectedExpert(await mapExpertToMentorWithImage(res.result, 'medium'));
        } else {
          setActiveItem('experts');
        }
      } catch {
        if (!cancelled) setActiveItem('experts');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Chat "Make a new appointment" sets the expert id then fires this event so the
  // student lands on that expert's booking page to request a 1:1.
  useEffect(() => {
    const onOpenExpertProfile = () => {
      const expertId = window.localStorage.getItem('studentDashboardExpertId');
      if (!expertId) return;
      (async () => {
        try {
          const res: any = await getExpertById(expertId);
          if (res?.result) {
            setSelectedExpert(await mapExpertToMentorWithImage(res.result, 'medium'));
            setActiveItem('expert-profile');
          }
        } catch {
          /* ignore — stay where we are if the expert can't be loaded */
        }
      })();
    };
    window.addEventListener('wl-open-expert-profile', onOpenExpertProfile);
    return () => window.removeEventListener('wl-open-expert-profile', onOpenExpertProfile);
  }, []);
  // Derived from the store so the stat cards recompute live as bookings change
  // (booking dispatches updateUserDetails; reloads refetch via doGetMyEvents).
  const sessionStats = useMemo(() => deriveSessionCounts(userDetails), [userDetails]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [eventsReloadKey, setEventsReloadKey] = useState(0);

  useEffect(() => {
    const { redirect_status, payment_intent, student_booking } = queryString.parse(
      location.search,
    );
    if (student_booking !== '1') return;

    const clearBookingQuery = () => {
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    };

    // WeChat Pay and Alipay come back as 'pending' while Stripe clears the funds. The
    // student has paid, so the booking is completed on both — never treat pending as a
    // failure, which would discard the recovery state after taking their money.
    const paidOrClearing = redirect_status === 'succeeded' || redirect_status === 'pending';

    if (paidOrClearing && payment_intent) {
      let cancelled = false;
      (async () => {
        const attemptsKey = `wl_booking_attempts_${payment_intent}`;
        const attempts = Number(window.sessionStorage.getItem(attemptsKey) || '0');
        const result = await completeStudentBookingFromStorage(String(payment_intent));
        if (cancelled) return;

        // On a retryable failure, keep the return URL + pendingDetails so a refresh
        // reruns completion (the server ignores an already-processed payment_intent).
        // Bounded so a persistent failure can't loop — after the cap we give up and let
        // the server-side reconciliation sweep release the hold.
        if (!result.ok && result.retryable && attempts < 2) {
          window.sessionStorage.setItem(attemptsKey, String(attempts + 1));
          setBookingReturnError(
            `${result.error} We're still finishing your booking — please refresh in a moment if it doesn't complete.`,
          );
          return;
        }

        window.sessionStorage.removeItem(attemptsKey);
        clearBookingQuery();
        if (result.ok) {
          if ('userDetails' in result && result.userDetails) {
            dispatch({ type: 'updateUserDetails', payload: result.userDetails });
          }
          if (result.kind === 'seminar-request') {
            // Full seminar — held payment recorded, awaiting host approval.
            setActiveItem('seminars');
            setSeatRequestToast(true);
          } else if (result.kind === 'accept') {
            // Paid an expert-proposed 1:1 — refresh bookings and land on the calendar.
            dispatch(updateMe());
            setActiveItem('calendar');
            setPaySuccessToast(true);
          } else if (result.kind === 'seminar') {
            // Seminars have no expert profile to reopen — land on the calendar.
            setActiveItem('calendar');
            setPaymentReturnSuccess(true);
          } else {
            try {
              const expertRes = await getExpertById(result.expertId);
              if (expertRes?.result) {
                setSelectedExpert(
                  await mapExpertToMentorWithImage(expertRes.result, 'medium'),
                );
                setActiveItem('expert-profile');
                setPaymentReturnSuccess(true);
              }
            } catch {
              setBookingReturnError('Booking saved, but we could not open the expert profile.');
            }
          }
        } else {
          window.localStorage.removeItem('pendingDetails');
          setBookingReturnError(result.error);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Only a genuinely failed payment discards the booking. Anything still clearing was
    // handled above, so reaching here means Stripe reported the payment did not go through.
    if (redirect_status && !paidOrClearing) {
      window.localStorage.removeItem('pendingDetails');
      clearBookingQuery();
      setBookingReturnError('Payment was not completed. Please try again.');
    }
  }, [location.search, location.pathname, navigate, dispatch]);

  useEffect(() => {
    const following = userDetails?.following;
    if (!Array.isArray(following)) return;
    setFollowedMentorIds(following.map((id: any) => String(id)));
  }, [userDetails?.following]);

  const toggleExpertFollow = useCallback(
    async (mentorId: string | number) => {
      // Auth guard: only a logged-in customer may follow.
      if (!userDetails?.email) return;

      const id = String(mentorId);
      const wasFollowing = followedMentorIds.includes(id);

      // Optimistic update — flip immediately, reconcile with the server below.
      setFollowedMentorIds(prev =>
        wasFollowing ? prev.filter(x => x !== id) : [...prev, id],
      );
      setFollowerCounts(fc => ({
        ...fc,
        [id]: Math.max(0, (fc[id] ?? 0) + (wasFollowing ? -1 : 1)),
      }));

      const res = wasFollowing
        ? await doUnfollowExpert(id)
        : await doFollowExpert(id);

      if (res && typeof res === 'object' && 'following' in res) {
        // Reconcile with server truth (handles count drift / races).
        setFollowedMentorIds(prev => {
          const without = prev.filter(x => x !== id);
          return res.following ? [...without, id] : without;
        });
        setFollowerCounts(fc => ({ ...fc, [id]: res.followerCount }));
      } else {
        // Request failed — revert the optimistic change.
        setFollowedMentorIds(prev =>
          wasFollowing ? [...prev, id] : prev.filter(x => x !== id),
        );
        setFollowerCounts(fc => ({
          ...fc,
          [id]: Math.max(0, (fc[id] ?? 0) + (wasFollowing ? 1 : -1)),
        }));
      }
    },
    [userDetails?.email, followedMentorIds],
  );
  const [upcomingModal, setUpcomingModal] = useState<{
    kind: 'seminar' | 'oneToOne';
    status: 'booked' | 'pending';
  } | null>(null);

  // Mentor profile card opened from a row in the upcoming-sessions modal.
  const [peerProfile, setPeerProfile] = useState<any | null>(null);
  const [peerProfileOpen, setPeerProfileOpen] = useState(false);

  // Overflow seminar seat requests the student has submitted that await the host's
  // decision — surfaced as the "Pending seminars" card + modal.
  const [mySeatRequests, setMySeatRequests] = useState<any[]>([]);

  const loadMySeatRequests = useCallback(async () => {
    const res: any = await getMySeatRequests();
    setMySeatRequests(Array.isArray(res?.result) ? res.result : []);
  }, []);

  useEffect(() => {
    if (String(userDetails?.role).toLowerCase() !== 'customer') return;
    void loadMySeatRequests();
  }, [userDetails?.role, userDetails?._id, loadMySeatRequests]);

  // Still in play: waiting on the host, or approved and waiting on the student's wallet
  // payment. Both belong on the "Pending seminars" card.
  const pendingSeatRequests = useMemo(
    () =>
      mySeatRequests.filter((r: any) => {
        const status = (r?.status || '').toLowerCase();
        if (status === 'pending') return true;
        return (
          status === 'awaiting_payment' &&
          (!r?.paymentDeadline || new Date(r.paymentDeadline).getTime() > Date.now())
        );
      }),
    [mySeatRequests],
  );

  const pendingSeatSessions = useMemo<UpcomingModalSession[]>(
    () =>
      pendingSeatRequests.map((r: any) => {
        const seminar = r?.groupChat || {};
        const start = seminar?.start ? new Date(seminar.start).getTime() : Date.now();
        const when = seminar?.start
          ? new Date(seminar.start).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '—';
        const awaitingPayment = (r?.status || '').toLowerCase() === 'awaiting_payment';
        const amountDollars = typeof r?.amount === 'number' ? r.amount / 100 : 0;
        const metaLines: string[] = [
          awaitingPayment ? 'Approved — payment needed' : 'Awaiting host approval',
        ];
        if (amountDollars > 0) {
          metaLines.push(
            awaitingPayment
              ? `$${amountDollars.toFixed(2)} due`
              : `$${amountDollars.toFixed(2)} on hold`,
          );
        }
        if (awaitingPayment && r?.paymentDeadline) {
          metaLines.push(`Pay by ${new Date(r.paymentDeadline).toLocaleString()}`);
        } else if (r?.decisionDeadline) {
          metaLines.push(`Decision by ${new Date(r.decisionDeadline).toLocaleString()}`);
        }
        const host = seminar?.admin;
        return {
          id: String(r._id),
          payable: awaitingPayment,
          price: amountDollars > 0 ? amountDollars : undefined,
          title: seminar?.name || 'Seminar',
          at: start,
          when,
          durationMinutes: sessionDurationMinutes(seminar) ?? undefined,
          location: 'Online · WisdomLinked',
          with: host?.username || host?.email || 'WisdomLinked',
          peerUserId: host?._id ? String(host._id) : undefined,
          detail: {
            title: seminar?.name || 'Seminar',
            description: seminar?.description,
            start: seminar?.start,
            end: seminar?.end,
            duration: seminar?.duration,
            price: typeof seminar?.price === 'number' ? seminar.price : undefined,
            admin: host,
            participants: [],
            keywords: seminar?.keywords,
            services: seminar?.services,
            purposeOther: seminar?.purposeOther,
            type: seminar?.type,
            isRecurring: seminar?.isRecurring,
            recurrenceFrequency: seminar?.recurrenceFrequency,
          },
          briefLabel: 'Seminar details',
          metaLines,
        };
      }),
    [pendingSeatRequests],
  );
  const [payTarget, setPayTarget] = useState<{
    groupChatId: string;
    price: number;
    name: string;
    /** Wallet bookings skipped the card hold, so they settle by wallet only. */
    walletOnly?: boolean;
  } | null>(null);
  /** Settling an approved overflow seat (wallet) — keyed by seat request, not session. */
  const [seatPayTarget, setSeatPayTarget] = useState<{
    requestId: string;
    groupChatId: string;
    price: number;
    name: string;
  } | null>(null);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const cards = useMemo(
    () =>
      [
        {
          id: 'booked-seminars',
          label: 'Booked seminar sessions',
          value: sessionStats.bookedSem,
          icon: BookOpen,
          color: 'success' as const,
          onClick: () => setUpcomingModal({ kind: 'seminar', status: 'booked' }),
        },
        {
          id: 'booked-individual',
          label: 'Booked individual sessions',
          value: sessionStats.bookedInd,
          icon: UserCheck,
          color: 'success' as const,
          onClick: () =>
            setUpcomingModal({ kind: 'oneToOne', status: 'booked' }),
        },
        {
          id: 'pending-individual',
          label: 'Pending individual sessions',
          value: sessionStats.pendInd,
          icon: AlertCircle,
          color: 'neutral' as const,
          tooltip: 'Pending 1:1 session – to be approved',
          onClick: () =>
            setUpcomingModal({ kind: 'oneToOne', status: 'pending' }),
        },
        {
          id: 'pending-seminars',
          label: 'Pending seminars',
          value: pendingSeatRequests.length,
          icon: AlertCircle,
          color: 'neutral' as const,
          tooltip: 'Seminar seat requests awaiting host approval',
          onClick: () => {
            void loadMySeatRequests();
            setUpcomingModal({ kind: 'seminar', status: 'pending' });
          },
        },
      ] as const,
    [sessionStats, pendingSeatRequests.length, loadMySeatRequests],
  );

  const calendarMeetings = useMemo(
    () => deriveCalendarMeetings(userDetails),
    [userDetails],
  );
  const { nextSeminar, nextOneToOne } = useMemo(
    () => deriveUpcomingSessions(userDetails),
    [userDetails],
  );
  const [carouselSections, setCarouselSections] = useState<CarouselSectionData[]>([]);
  const [carouselLoading, setCarouselLoading] = useState(true);
  const studentName =
    (userDetails?.username as string | undefined) ||
    (userDetails?.name as string | undefined) ||
    'Student';
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const loadAvatar = async () => {
      const src = await resolveProfileImageSrc(
        userDetails?.image,
        'small',
        profileImageFetch as any,
      );
      if (!cancelled) setAvatarUrl(src ?? undefined);
    };
    void loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [userDetails?.image]);

  useEffect(() => {
    if (activeItem !== 'chat') return;
  }, [activeItem]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const res: any = await doGetMyEvents();
        if (cancelled) return;
        if (!res?.result) {
          setCalendarError("We couldn't load your sessions. Please try again.");
          return;
        }
        dispatch({ type: 'updateUserDetails', payload: res.result });
      } catch {
        if (!cancelled) {
          setCalendarError("We couldn't load your sessions. Please try again.");
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, eventsReloadKey]);

  // Carousel ("What's New For You") — real experts + seminars from the BE.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCarouselLoading(true);
      try {
        // Carousel highlights the newest experts — BE "Recently joined" sorts by createdAt desc.
        const expertFilter = { username: '', name: '', keywords: [], services: [], sortBy: 'Recently joined' };
        const seminarFilter = { username: '', name: '', keywords: [], services: [], sortBy: 'Name in ASC' };
        const [expertRes, seminarRes]: [any, any] = await Promise.all([
          doFilterExperts(expertFilter),
          doFilterSeminars(seminarFilter),
        ]);
        if (cancelled) return;

        const sections: CarouselSectionData[] = [];

        const experts = Array.isArray(expertRes?.result) ? expertRes.result : [];
        if (experts.length) {
          const mentors = await Promise.all(
            experts
              .slice(0, 5)
              .map((e: any) => mapExpertToMentorWithImage(e, 'small')),
          );
          if (cancelled) return;
          sections.push({
            id: 'experts',
            category: 'Expert',
            icon: Users,
            items: mentors.map((m) => ({
              sectionTitle: 'New experts',
              title: m.name,
              description: m.institution,
              tag: m.isNew ? 'New expert' : 'Expert',
              metaLabel: 'Field',
              experience: m.field,
              cta: 'View profile',
              image: m.image || undefined,
              onSelect: () => {
                setSelectedExpert(m);
                setActiveItem('expert-profile');
              },
            })),
          });
        }

        const seminars = Array.isArray(seminarRes?.result) ? seminarRes.result : [];
        if (seminars.length) {
          sections.push({
            id: 'seminars',
            category: 'Seminar',
            icon: BookOpen,
            items: seminars.slice(0, 8).map((s: any) => ({
              sectionTitle: 'Seminars for you',
              title: s?.name || 'Seminar',
              description: s?.description || 'Live seminar on WisdomLinked.',
              tag: 'Seminar',
              metaLabel: 'Starts',
              experience: s?.start
                ? new Date(s.start).toLocaleDateString()
                : undefined,
              location: typeof s?.price === 'number' ? `$${s.price}` : undefined,
              cta: 'View seminars',
              onSelect: () => setActiveItem('seminars'),
            })),
          });
        }

        if (!cancelled) setCarouselSections(sections);
      } catch {
        if (!cancelled) setCarouselSections([]);
      } finally {
        if (!cancelled) setCarouselLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCommunityNotificationRooms = useCallback(async () => {
    try {
      const res: any = await getAllCommunityChats();
      if (res === false || res?.status !== 'SUCCESS' || !Array.isArray(res.chats)) return;
      const next: Record<string, string> = {};
      res.chats.forEach((chat: any) => {
        const rid =
          chat?.rcChannelId != null && String(chat.rcChannelId).trim() !== ''
            ? String(chat.rcChannelId)
            : '';
        if (!rid) return;
        next[rid] = String(chat?.name || chat?.groupName || 'Community').trim() || 'Community';
      });
      setCommunityRidToName(next);
    } catch {
      /* noop */
    }
  }, []);

  const hydrateUnreadSnapshot = useCallback(async () => {
    const snapshot = await fetchDmUnreadSnapshot();
    if (snapshot?.success && snapshot.unreadByRid) {
      setDmUnreadByRid(snapshot.unreadByRid);
      dispatch(setDmUnreadByRidBulk(snapshot.unreadByRid));
    } else {
      setDmUnreadByRid({});
      dispatch(setDmUnreadByRidBulk({}));
    }
    if (snapshot?.success && snapshot.nameByRid && typeof snapshot.nameByRid === 'object') {
      setRcRoomNameByRid(snapshot.nameByRid);
    } else {
      setRcRoomNameByRid({});
    }
    setRcDisplayNameByRid(
      snapshot?.success && snapshot.displayNameByRid && typeof snapshot.displayNameByRid === 'object'
        ? snapshot.displayNameByRid
        : {},
    );
    setRoomNamesUnresolved(Boolean(snapshot?.nameResolutionFailed));
    setKnownRids(Array.isArray(snapshot?.knownRids) ? snapshot.knownRids : []);
  }, [dispatch]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      await connectToRC();
      const snapshot = await fetchDmUnreadSnapshot();
      if (!mounted) return;
      if (snapshot?.success && snapshot.unreadByRid) {
        setDmUnreadByRid(snapshot.unreadByRid);
        dispatch(setDmUnreadByRidBulk(snapshot.unreadByRid));
      } else {
        setDmUnreadByRid({});
        dispatch(setDmUnreadByRidBulk({}));
      }
      if (snapshot?.success && snapshot.nameByRid && typeof snapshot.nameByRid === 'object') {
        setRcRoomNameByRid(snapshot.nameByRid);
      } else {
        setRcRoomNameByRid({});
      }
      setRcDisplayNameByRid(
        snapshot?.success && snapshot.displayNameByRid && typeof snapshot.displayNameByRid === 'object'
          ? snapshot.displayNameByRid
          : {},
      );
      setRoomNamesUnresolved(Boolean(snapshot?.nameResolutionFailed));
    setKnownRids(Array.isArray(snapshot?.knownRids) ? snapshot.knownRids : []);
      await loadCommunityNotificationRooms();
    };
    void boot();
    return () => {
      mounted = false;
    };
  }, [loadCommunityNotificationRooms, dispatch]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void hydrateUnreadSnapshot();
      void loadCommunityNotificationRooms();
      setEventsReloadKey((k) => k + 1); // pull booking/acceptance updates on tab return
    };
    const onFocus = () => {
      void hydrateUnreadSnapshot();
      void loadCommunityNotificationRooms();
      setEventsReloadKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [hydrateUnreadSnapshot, loadCommunityNotificationRooms]);

  useEffect(() => {
    const uid = userDetails?._id ?? userDetails?.id ?? userDetails?.userId;
    if (!uid) return;
    void loadCommunityNotificationRooms();
  }, [userDetails?._id, userDetails?.id, userDetails?.userId, loadCommunityNotificationRooms]);

  useEffect(() => {
    const dcs = userDetails?.directConversations ?? [];
    dcs.forEach((conv: any) => {
      if (conv?.rcChannelId) subscribeToRoom(String(conv.rcChannelId));
    });
    const gcs = userDetails?.generalChats ?? [];
    gcs.forEach((g: any) => {
      if (g?.rcChannelId) subscribeToRoom(String(g.rcChannelId));
    });
  }, [userDetails?.directConversations, userDetails?.generalChats]);

  const dmNameByRid = useMemo(() => {
    const out: Record<string, string> = {};
    const meId = String(userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? '');
    const dcs = userDetails?.directConversations ?? [];
    dcs.forEach((conv: any) => {
      const rid = String(conv?.rcChannelId || '');
      if (!rid) return;
      const participants = Array.isArray(conv?.participants) ? conv.participants : [];
      const other = participants.find(
        (p: any) => String(p?._id ?? p?.id ?? '') && String(p?._id ?? p?.id ?? '') !== meId,
      );
      const fullName = String(other?.username || other?.name || other?.email || '').trim();
      if (fullName) out[rid] = fullName;
    });
    return out;
  }, [userDetails?._id, userDetails?.id, userDetails?.userId, userDetails?.directConversations]);

  const dmRidSet = useMemo(() => {
    const s = new Set<string>();
    (userDetails?.directConversations ?? []).forEach((c: any) => {
      if (c?.rcChannelId) s.add(String(c.rcChannelId));
    });
    return s;
  }, [userDetails?.directConversations]);

  const knownRidSet = useMemo(() => new Set(knownRids.map(String)), [knownRids]);

  /** Same idea as DM rids from directConversations — include community rids from getAllCommunityChats (often missing on user payload). */
  const allowedChatRidSet = useMemo(() => {
    const s = new Set<string>();
    dmRidSet.forEach(rid => s.add(rid));
    /** Include unread snapshot rooms only when the backend matched them to a WL chat (an unidentified room is one we cannot open). */
    Object.entries(dmUnreadByRid || {}).forEach(([rid]) => {
      if (shouldNotifyRoom(rid, knownRidSet, rcRoomNameByRid?.[rid], roomNamesUnresolved)) s.add(String(rid));
    });
    (userDetails?.generalChats ?? []).forEach((g: any) => {
      if (g?.rcChannelId) s.add(String(g.rcChannelId));
    });
    (userDetails?.groupChats ?? []).forEach((g: any) => {
      if (g?.rcChannelId) s.add(String(g.rcChannelId));
    });
    Object.keys(communityRidToName).forEach(rid => s.add(rid));
    return s;
  }, [dmRidSet, dmUnreadByRid, rcRoomNameByRid, knownRidSet, roomNamesUnresolved, userDetails?.generalChats, userDetails?.groupChats, communityRidToName]);

  const filteredUnreadByRid = useMemo(() => {
    const out: Record<string, number> = {};
    Object.entries(dmUnreadByRid).forEach(([rid, n]) => {
      if (allowedChatRidSet.has(String(rid))) out[rid] = Number(n) || 0;
    });
    return out;
  }, [dmUnreadByRid, allowedChatRidSet]);

  /** WisdomLinked group/community names by RC room id (overrides RC internal slugs like wl_*). */
  const groupNameByRid = useMemo(() => {
    const out: Record<string, string> = {};
    const add = (g: any) => {
      const rid = g?.rcChannelId ? String(g.rcChannelId) : '';
      if (!rid) return;
      const name = String(g?.name ?? g?.groupName ?? '').trim();
      if (name) out[rid] = name;
    };
    (userDetails?.generalChats ?? []).forEach(add);
    (userDetails?.groupChats ?? []).forEach(add);
    return out;
  }, [userDetails?.generalChats, userDetails?.groupChats]);

  const roomLabelByRid = useMemo(
    () => ({ ...rcDisplayNameByRid, ...dmNameByRid, ...groupNameByRid, ...communityRidToName }),
    [rcDisplayNameByRid, dmNameByRid, groupNameByRid, communityRidToName],
  );

  const namedRidsRef = useRef<Set<string>>(new Set());
  const nameLookupTriedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    namedRidsRef.current = new Set(Object.keys(roomLabelByRid));
  }, [roomLabelByRid]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let resolveNames: ReturnType<typeof setTimeout> | undefined;
    const unsubSub = onSubscriptionChanged(({ roomId, type, unread }) => {
      if (type && !['d', 'c', 'p'].includes(type)) return;
      const rid = String(roomId || '');
      if (!rid) return;
      const nextUnread = Number(unread || 0);
      setDmUnreadByRid(prev => {
        const next = { ...prev };
        if (nextUnread > 0) next[rid] = nextUnread;
        else delete next[rid];
        return next;
      });
      dispatch(patchDmUnreadRid(rid, nextUnread));
      if (nextUnread > 0 && !namedRidsRef.current.has(rid) && !nameLookupTriedRef.current.has(rid)) {
        nameLookupTriedRef.current.add(rid);
        if (resolveNames) window.clearTimeout(resolveNames);
        resolveNames = window.setTimeout(() => {
          void hydrateUnreadSnapshot();
        }, 600);
      }
      if (type === 'c' || type === 'p') {
        if (debounce) window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          void loadCommunityNotificationRooms();
        }, 450);
      }
    });
    return () => {
      unsubSub();
      if (debounce) window.clearTimeout(debounce);
      if (resolveNames) window.clearTimeout(resolveNames);
    };
  }, [userDetails?.email, loadCommunityNotificationRooms, hydrateUnreadSnapshot, dispatch]);

  const totalUnreadDm = useMemo(
    () => Object.values(filteredUnreadByRid).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [filteredUnreadByRid],
  );
  const chatNotifications = useMemo<TopBarNotificationItem[]>(
    () =>
      Object.entries(filteredUnreadByRid)
        .filter(([, count]) => Number(count) > 0)
        .map(([rid, count]) => {
          const n = Number(count) || 0;
          const isDm = dmRidSet.has(rid);
          const label = displayRoomLabel(roomLabelByRid[rid], isDm ? 'Someone' : 'a group chat');
          return {
            id: `chat-${rid}`,
            title: isDm ? `${label} messaged you` : `New message${n !== 1 ? 's' : ''} in ${label}`,
            meta: `${n > 99 ? '99+' : n} unread message${n !== 1 ? 's' : ''}`,
            unreadCount: n,
            icon: <MessageSquare className="h-3.5 w-3.5 text-[#1A3A4A]" aria-hidden />,
            onClick: () => {
              if (isDm) localStorage.setItem('wl_open_dm_rid', rid);
              else localStorage.setItem('wl_open_community_rc_rid', rid);
              window.dispatchEvent(new Event('wl-open-chat-nav'));
              setActiveItem('chat');
            },
          };
        }),
    [filteredUnreadByRid, roomLabelByRid, dmRidSet],
  );

  // Calendar "Join" routing: seminars open their seminar group chat; 1:1s open a
  // private chat with the expert. StudentChat consumes these signals on entry.
  const handleJoinMeeting = (meeting: CalendarMeeting) => {
    if (meeting.type === 'seminar') {
      if (meeting.groupId) {
        localStorage.setItem('wl_open_seminar_id', meeting.groupId);
        window.dispatchEvent(new Event('wl-open-chat-nav'));
      }
      setActiveItem('chat');
      return;
    }
    if (meeting.peerUserId) {
      localStorage.setItem(
        'wl_open_dm_userid',
        JSON.stringify({
          id: meeting.peerUserId,
          title: meeting.peerName || 'Expert',
          image: meeting.peerImage ?? null,
        }),
      );
      window.dispatchEvent(new Event('wl-open-chat-nav'));
    }
    setActiveItem('chat');
  };

  const openSeminarChat = (seminarId?: string) => {
    if (seminarId) {
      localStorage.setItem('wl_open_seminar_id', String(seminarId));
      window.dispatchEvent(new Event('wl-open-chat-nav'));
    }
    setActiveItem('chat');
  };

  const openMentorDm = (peerUserId?: string, title?: string) => {
    if (peerUserId) {
      localStorage.setItem(
        'wl_open_dm_userid',
        JSON.stringify({
          id: String(peerUserId),
          title: title == null ? 'Your mentor' : String(title),
          image: null,
        }),
      );
      window.dispatchEvent(new Event('wl-open-chat-nav'));
    }
    setActiveItem('chat');
  };

  const handleUpcomingJoinSession = (session: UpcomingModalSession) => {
    setUpcomingModal(null);
    if (upcomingModal?.kind === 'seminar') openSeminarChat(session.id);
    else openMentorDm(session.peerUserId, session.with);
  };

  // Open the peer's (mentor / seminar host) profile card, showing a fallback
  // immediately and enriching it once the full profile loads.
  const handleViewPeerProfile = useCallback(
    async (session: UpcomingModalSession) => {
      const peerId = String(session.peerUserId || '');
      if (!peerId) return;
      const fallback = buildFallbackChatProfile(
        { userId: peerId, username: session.with, image: null },
        String(userDetails?.role || ''),
      );
      setPeerProfile(fallback);
      setPeerProfileOpen(true);
      const response = await fetchChatUserProfile(peerId);
      if (response?.success && response?.result) {
        setPeerProfile(mergeChatProfile(fallback, response.result));
      }
    },
    [userDetails?.role],
  );

  const handleClosePeerProfile = useCallback(() => {
    setPeerProfileOpen(false);
    setPeerProfile(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[14px]">
      <div className="flex min-h-screen">
        <Sidebar
          activeItem={activeItem}
          onNavigate={setActiveItem}
          studentName={studentName}
          avatarUrl={avatarUrl}
          notifications={{ chat: activeItem === 'chat' ? 0 : totalUnreadDm }}
        />
        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={
              activeItem === 'profile'
                ? 'Profile'
                : activeItem === 'expert-profile'
                  ? 'Expert Profile'
                : activeItem === 'settings'
                  ? 'Settings'
                : activeItem === 'contact-admin'
                  ? 'Contact admin'
                : activeItem === 'experts'
                  ? 'Find experts'
                  : activeItem === 'calendar'
                    ? 'Calendar'
                    : activeItem === 'join-meeting'
                      ? 'Join meeting'
                      : activeItem === 'seminars'
                        ? 'Seminars'
                        : activeItem === 'history'
                          ? 'Payment History'
                          : 'Student Dashboard'
            }
            userName={studentName}
            avatarUrl={avatarUrl}
            onProfileClick={() => setActiveItem('profile')}
            onSettingsClick={() => setActiveItem('settings')}
            notifications={chatNotifications}
            notificationsEnabled
          />
          {bookingReturnError ? (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {bookingReturnError}
              <button
                type="button"
                className="ml-3 underline"
                onClick={() => setBookingReturnError(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {activeItem !== 'chat' ? (
            <div className="px-4 pt-3 sm:px-6">
              <DecisionNotices
                onPay={(notice) => {
                  if (notice.kind === 'seat') {
                    setSeatPayTarget({
                      requestId: notice.id,
                      groupChatId: String(notice.groupChatId ?? ''),
                      price: typeof notice.price === 'number' ? notice.price : 0,
                      name: notice.title,
                    });
                    return;
                  }
                  setPayTarget({
                    groupChatId: notice.id,
                    price: typeof notice.price === 'number' ? notice.price : 0,
                    name: notice.title,
                    // Only a wallet booking is ever awaiting payment after acceptance.
                    walletOnly: true,
                  });
                }}
              />
            </div>
          ) : null}
          {activeItem === 'chat' ? (
            <div className="h-[calc(100vh-56px)] bg-wl-page">
              <StudentChat />
            </div>
          ) : activeItem === 'profile' ? (
            <StudentProfile />
          ) : activeItem === 'settings' ? (
            <StudentSettings />
          ) : activeItem === 'expert-profile' ? (
            selectedExpert ? (
              <ExpertProfile
                mentor={selectedExpert}
                followerCount={
                  followerCounts[String(selectedExpert.id)] ??
                  selectedExpert.followerCount ??
                  0
                }
                isFollowing={followedMentorIds.includes(String(selectedExpert.id))}
                onToggleFollow={toggleExpertFollow}
                paymentReturnSuccess={paymentReturnSuccess}
                onPaymentReturnHandled={() => setPaymentReturnSuccess(false)}
                onGoToCalendar={() => {
                  setPaymentReturnSuccess(false);
                  setActiveItem('calendar');
                }}
                onBack={() => {
                  setPaymentReturnSuccess(false);
                  setActiveItem('experts');
                }}
              />
            ) : (
              <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] p-6">
                <p className="text-sm text-slate-500">No expert selected.</p>
              </div>
            )
          ) : activeItem === 'experts' ? (
            <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
              <FindExpertsPage
                followedMentorIds={followedMentorIds}
                followerCounts={followerCounts}
                onToggleFollow={toggleExpertFollow}
                onViewExpert={mentor => {
                  setSelectedExpert(mentor);
                  setActiveItem('expert-profile');
                }}
              />
            </div>
          ) : activeItem === 'calendar' ? (
            <StudentCalendar
              meetings={calendarMeetings}
              loading={calendarLoading}
              error={calendarError}
              onRetry={() => setEventsReloadKey((k) => k + 1)}
              onJoinMeeting={handleJoinMeeting}
              onViewProfile={(m) =>
                handleViewPeerProfile({
                  peerUserId: m.peerUserId,
                  with: m.peerName || m.with,
                } as any)
              }
            />
          ) : activeItem === 'join-meeting' ? (
            <JoinMeeting />
          ) : activeItem === 'contact-admin' ? (
            <ContactAdmin />
          ) : activeItem === 'seminars' ? (
            <StudentSeminars onEnterSeminarChat={openSeminarChat} />
          ) : activeItem === 'history' ? (
            <StudentPaymentHistory />
          ) : (
            <div className="px-6 py-7">
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                <section className="min-w-0">
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {greeting}, {studentName.split(' ')[0]}!
                  </h2>
                  <p className="mt-1 max-w-xl font-sans text-[13px] text-slate-500">
                    Here&apos;s what&apos;s happening with your WisdomLinked sessions today.
                  </p>
                  <StatsGrid cards={cards} />
                </section>

                <div className="hidden lg:block">
                  <div className="mt-16">
                    <UpcomingCountdownCard
                      nextSeminar={nextSeminar}
                      nextOneToOne={nextOneToOne}
                      onJoinSeminar={() => openSeminarChat(nextSeminar?.id)}
                      onJoinOneToOne={() =>
                        openMentorDm(nextOneToOne?.peerUserId, nextOneToOne?.title)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 lg:hidden">
                <UpcomingCountdownCard
                  nextSeminar={nextSeminar}
                  nextOneToOne={nextOneToOne}
                  onJoinSeminar={() => openSeminarChat(nextSeminar?.id)}
                  onJoinOneToOne={() =>
                    openMentorDm(nextOneToOne?.peerUserId, nextOneToOne?.title)
                  }
                />
              </div>

              <CarouselSection
                sections={carouselSections}
                loading={carouselLoading}
              />
            </div>
          )}
          {activeItem !== 'chat' && activeItem !== 'profile' ? <Chatbot /> : null}
        </main>
        {paySuccessToast && (
          <div className="fixed right-4 top-4 z-[70] flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
            <span className="text-sm font-semibold text-[#1A3A4A]">Payment successful — your session is confirmed.</span>
            <button
              type="button"
              onClick={() => setPaySuccessToast(false)}
              className="ml-1 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        {seatRequestToast && (
          <div className="fixed right-4 top-4 z-[70] flex items-start gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 shadow-lg">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">⏳</span>
            <span className="max-w-xs text-sm font-semibold text-[#1A3A4A]">
              Seat requested — your card is authorized but not charged. You'll only be charged if the host approves.
            </span>
            <button
              type="button"
              onClick={() => setSeatRequestToast(false)}
              className="ml-1 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        {upcomingModal && (
          <UpcomingSessionModal
            kind={upcomingModal.kind}
            status={upcomingModal.status}
            sessions={
              upcomingModal.kind === 'seminar' && upcomingModal.status === 'pending'
                ? pendingSeatSessions
                : deriveModalSessions(
                    userDetails,
                    upcomingModal.kind,
                    upcomingModal.status,
                  )
            }
            onClose={() => setUpcomingModal(null)}
            onJoinSession={handleUpcomingJoinSession}
            onViewProfile={handleViewPeerProfile}
            onPay={(session) => {
              setUpcomingModal(null);
              // Seat requests are listed by request id, so they settle on their own route.
              const seat = mySeatRequests.find((r: any) => String(r?._id) === session.id);
              if (seat) {
                setSeatPayTarget({
                  requestId: String(seat._id),
                  groupChatId: String(seat.groupChat?._id ?? seat.groupChat ?? ''),
                  price: typeof seat.amount === 'number' ? seat.amount / 100 : 0,
                  name: seat.groupChat?.name || session.title,
                });
                return;
              }
              setPayTarget({
                groupChatId: session.id,
                price: typeof session.price === 'number' ? session.price : 0,
                name: session.title,
                walletOnly: session.paymentMode === 'wallet',
              });
            }}
          />
        )}
        {peerProfile && (
          <ProfileModal
            isOpen={peerProfileOpen}
            onClose={handleClosePeerProfile}
            userDetails={peerProfile}
            viewerRole={userDetails?.role}
            previewImage={peerProfile?.image}
          />
        )}
        {payTarget && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPayTarget(null);
            }}
          >
            <div className="my-auto w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <StudentBookingCheckout
                type="1:1 session"
                price={payTarget.price}
                holdsFunds
                policyNotice={{
                  message:
                    'Paying confirms this session immediately. It cannot be cancelled and the payment is not refundable.',
                  acknowledgeLabel: 'I understand this payment is non-refundable.',
                }}
                pendingDetails={{
                  kind: 'accept-1to1',
                  groupChatId: payTarget.groupChatId,
                  price: payTarget.price,
                  name: payTarget.name,
                }}
                // The expert is already committed here, so a wallet can settle outright.
                // A booking requested by wallet stays wallet-only (it skipped the hold).
                walletOption={{ kind: 'charge', only: payTarget.walletOnly }}
                returnUrl={(() => {
                  try {
                    const url = new URL(window.location.href);
                    url.search = '';
                    url.searchParams.set('student_booking', '1');
                    return url.toString();
                  } catch {
                    return '/user/studentdashboard?student_booking=1';
                  }
                })()}
                onPaymentSuccess={async (paymentIntentId) => {
                  const response = await acceptIndividualAppointment({
                    groupChatId: payTarget.groupChatId,
                    payment_intent: paymentIntentId,
                  });
                  setPayTarget(null);
                  if (response === false || response?.status === 'FAIL' || response?.error) {
                    setBookingReturnError(
                      response?.error || 'Could not confirm the session after payment.',
                    );
                    return;
                  }
                  window.localStorage.removeItem('pendingDetails');
                  dispatch(updateMe());
                  setPaySuccessToast(true);
                }}
                onCancel={() => setPayTarget(null)}
              />
            </div>
          </div>
        )}
        {seatPayTarget && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#1A3A4A]/40 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSeatPayTarget(null);
            }}
          >
            <div className="my-auto w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <StudentBookingCheckout
                type="Seminar seat"
                price={seatPayTarget.price}
                policyNotice={{
                  message:
                    'Paying claims your approved seat immediately. It cannot be cancelled and the payment is not refundable.',
                  acknowledgeLabel: 'I understand this payment is non-refundable.',
                }}
                pendingDetails={{
                  kind: 'pay-seat-request',
                  requestId: seatPayTarget.requestId,
                  groupChatId: seatPayTarget.groupChatId,
                  price: seatPayTarget.price,
                  name: seatPayTarget.name,
                }}
                // Approved without a hold, so it settles in the mode it was requested in.
                walletOption={{ kind: 'charge', only: true }}
                returnUrl={(() => {
                  try {
                    const url = new URL(window.location.href);
                    url.search = '';
                    url.searchParams.set('student_booking', '1');
                    return url.toString();
                  } catch {
                    return '/user/studentdashboard?student_booking=1';
                  }
                })()}
                onPaymentSuccess={async (paymentIntentId) => {
                  const { paySeminarSeatRequest } = await import('../api/api');
                  const response = await paySeminarSeatRequest({
                    requestId: seatPayTarget.requestId,
                    payment_intent: paymentIntentId,
                  });
                  setSeatPayTarget(null);
                  if (response === false || response?.status === 'FAIL' || response?.error) {
                    setBookingReturnError(
                      response?.error || 'Could not confirm your seat after payment.',
                    );
                    return;
                  }
                  window.localStorage.removeItem('pendingDetails');
                  dispatch(updateMe());
                  void loadMySeatRequests();
                  setPaySuccessToast(true);
                }}
                onCancel={() => setSeatPayTarget(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
