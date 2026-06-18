import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import { BookOpen, Clock, UserCheck, AlertCircle, MessageSquare, Users } from 'lucide-react';
import { useAppSelector } from '../store';
import { doGetMyEvents, getAllCommunityChats, profileImageFetch, doFilterExperts, doFilterSeminars } from '../api/api';
import { resolveProfileImageSrc } from '../utils/profileImage';
import { fetchDmUnreadSnapshot } from '../api/chatApi';
import Sidebar from '../components/layout/Sidebar';
import TopBar, { TopBarNotificationItem } from '../components/layout/TopBar';
import StatsGrid from '../components/dashboard/StatsGrid';
import CarouselSection, { type CarouselSectionData } from '../components/dashboard/CarouselSection';
import StudentProfile from '../components/dashboard/StudentProfile';
import StudentSettings from '../components/dashboard/StudentSettings';
import StudentCalendar, { type Meeting as CalendarMeeting } from '../components/dashboard/StudentCalendar';
import JoinMeeting from '../components/dashboard/JoinMeeting';
import StudentSeminars from '../components/dashboard/StudentSeminars';
import FindExpertsPage from './FindExperts';
import Chatbot from '../components/chatbot';
import ContactAdmin from './Dashboard/_ExpertDashboard/ContactAdmin';
import UpcomingCountdownCard, { type UpcomingSession } from '../components/dashboard/UpcomingCountdownCard';
import UpcomingSessionModal, { type UpcomingModalSession } from '../components/dashboard/UpcomingSessionModal';
import ExpertProfile from '../components/dashboard/ExpertProfile';
import { completeStudentBookingFromStorage } from '../components/dashboard/StudentBookingCheckout';
import { getExpertById } from '../api/api';
import type { MentorCardProps } from '../components/MentorCard';
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
import { useEndMeetingOnReturn } from '../hooks/useEndMeetingOnReturn';
function deriveSessionCounts(u: any) {
  if (!u) {
    return { bookedSem: 0, pendSem: 0, bookedInd: 0, pendInd: 0 };
  }
  const events = u.events || [];
  const gcs = u.groupChats || [];

  // 1:1s live in two disjoint systems: student-booked sessions are individual
  // groupChats ('pending' → awaiting approval, 'active' → booked); expert-created
  // / legacy ones are events. Count both so the cards reflect every 1:1.
  const indChats = gcs.filter((g: any) => g.type === 'individual');
  const pendIndChats = indChats.filter(
    (g: any) => (g.status || '').toLowerCase() === 'pending',
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
  const pendSem = (u.pendingGroupChats || []).filter(
    (p: any) => p.groupChatId?.type === 'seminar',
  ).length;
  return { bookedSem, pendSem, bookedInd, pendInd };
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
    });
  };

  for (const g of u?.groupChats || []) {
    const host = g?.admin?.username || g?.admin?.email || 'WisdomLinked';
    const gStatus = (g?.status || '').toLowerCase();
    if (g?.type === 'seminar') {
      pushMeeting(g?._id, `seminar-${g?.start}`, g?.name || 'Seminar', g?.start, 'seminar', 'confirmed', `Seminar host: ${host}`);
    } else if (g?.type === 'individual' && gStatus !== 'cancelled') {
      pushMeeting(
        g?._id,
        `session-${g?.start}`,
        g?.name || '1:1 session',
        g?.start,
        'session',
        gStatus === 'active' ? 'confirmed' : 'pending',
        `Mentor: ${host}`,
      );
    }
  }

  // Seminar registrations awaiting expert approval live in pendingGroupChats, not
  // groupChats — surface them as pending so a just-booked seminar shows up.
  for (const p of u?.pendingGroupChats || []) {
    const g = p?.groupChatId;
    if (g?.type !== 'seminar') continue;
    const host = g?.admin?.username || g?.admin?.email || 'WisdomLinked';
    pushMeeting(
      p?._id ?? g?._id,
      `pending-seminar-${g?.start}`,
      g?.name || 'Seminar',
      g?.start,
      'seminar',
      'pending',
      `Seminar host: ${host}`,
    );
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
 * seminars come from groupChats / pendingGroupChats, 1:1s from events.
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
      location: 'Online · WisdomLinked Room',
      with: g?.admin?.username || g?.admin?.email || 'WisdomLinked',
    };
  };

  if (kind === 'seminar') {
    if (status === 'booked') {
      return (u.groupChats || [])
        .filter((g: any) => g?.type === 'seminar')
        .map(seminarToModal);
    }
    return (u.pendingGroupChats || [])
      .filter((p: any) => p?.groupChatId?.type === 'seminar')
      .map((p: any) => seminarToModal(p.groupChatId));
  }

  // 1:1s come from two disjoint systems: student-booked sessions are individual
  // groupChats ('active' = booked, 'pending' = awaiting approval); expert-created
  // / legacy ones are events. Merge both so the modal matches the card count.
  const indChatWanted =
    status === 'pending'
      ? (s: string) => s === 'pending'
      : (s: string) => s === 'active';
  const fromChats = (u.groupChats || [])
    .filter(
      (g: any) =>
        g?.type === 'individual' && indChatWanted((g?.status || '').toLowerCase()),
    )
    .map((g: any) => {
      const at = new Date(g?.start).getTime();
      return {
        id: String(g?._id ?? `session-${at}`),
        title: g?.name || '1:1 session',
        at: Number.isNaN(at) ? 0 : at,
        when: Number.isNaN(at) ? 'TBD' : modalWhen(at),
        location: 'Online · WisdomLinked Room',
        with: g?.admin?.username || g?.admin?.email || 'Your mentor',
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
        location: 'Online · WisdomLinked Room',
        with: e?.expert?.username || e?.expert?.email || 'Your mentor',
      };
    });

  return [...fromChats, ...fromEvents];
}

/**
 * Find the soonest upcoming seminar and 1:1 from the user's real bookings,
 * for the "Upcoming sessions" countdown card.
 */
function deriveUpcomingSessions(u: any): {
  nextSeminar: UpcomingSession | null;
  nextOneToOne: UpcomingSession | null;
} {
  const now = Date.now();
  let nextSeminar: UpcomingSession | null = null;
  let nextOneToOne: UpcomingSession | null = null;
  for (const g of u?.groupChats || []) {
    const startAt = new Date(g?.start).getTime();
    if (Number.isNaN(startAt) || startAt <= now) continue;

    const isSeminar = g?.type === 'seminar';
    const isSession =
      g?.type === 'individual' && (g?.status || '').toLowerCase() === 'active';

    if (isSeminar && (!nextSeminar || startAt < nextSeminar.startAt)) {
      nextSeminar = { title: g?.name || 'Seminar', startAt };
    } else if (isSession && (!nextOneToOne || startAt < nextOneToOne.startAt)) {
      nextOneToOne = { title: g?.name || '1:1 session', startAt };
    }
  }
  return { nextSeminar, nextOneToOne };
}

export default function StudentDashboard() {
  useEndMeetingOnReturn();
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState('dashboard');
  const [paymentReturnSuccess, setPaymentReturnSuccess] = useState(false);
  const [bookingReturnError, setBookingReturnError] = useState<string | null>(null);
  const [dmUnreadByRid, setDmUnreadByRid] = useState<Record<string, number>>({});
  const [rcRoomNameByRid, setRcRoomNameByRid] = useState<Record<string, string>>({});
  /** Same source as chat sidebar — RC room id → community name (DMs use directConversations only). */
  const [communityRidToName, setCommunityRidToName] = useState<Record<string, string>>({});
  const [selectedExpert, setSelectedExpert] = useState<MentorCardProps | null>(null);
  const [followedMentorIds, setFollowedMentorIds] = useState<string[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const { auth: { userDetails } } = useAppSelector((state: any) => state);
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

    if (redirect_status === 'succeeded' && payment_intent) {
      let cancelled = false;
      (async () => {
        const result = await completeStudentBookingFromStorage(String(payment_intent));
        if (cancelled) return;
        clearBookingQuery();
        if (result.ok) {
          if (result.userDetails) {
            dispatch({ type: 'updateUserDetails', payload: result.userDetails });
          }
          if (result.kind === 'seminar') {
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
          setBookingReturnError(result.error);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (redirect_status && redirect_status !== 'succeeded') {
      window.localStorage.removeItem('pendingDetails');
      clearBookingQuery();
      setBookingReturnError('Payment was not completed. Please try again.');
    }
  }, [location.search, location.pathname, navigate, dispatch]);

  const toggleExpertFollow = useCallback((mentorId: string | number) => {
    const id = String(mentorId);
    setFollowedMentorIds(prev => {
      const isFollowing = prev.includes(id);
      setFollowerCounts(fc => ({
        ...fc,
        [id]: (fc[id] ?? 0) + (isFollowing ? -1 : 1),
      }));
      return isFollowing ? prev.filter(x => x !== id) : [...prev, id];
    });
  }, []);
  const [upcomingModal, setUpcomingModal] = useState<{
    kind: 'seminar' | 'oneToOne';
    status: 'booked' | 'pending';
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
          id: 'pending-seminars',
          label: 'Pending seminar sessions',
          value: sessionStats.pendSem,
          icon: Clock,
          color: 'neutral' as const,
          tooltip: 'Pending seminar – awaiting approval',
          onClick: () => setUpcomingModal({ kind: 'seminar', status: 'pending' }),
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
      ] as const,
    [sessionStats],
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
        const filter = { username: '', name: '', keywords: [], services: [], sortBy: 'Name in ASC' };
        const [expertRes, seminarRes]: [any, any] = await Promise.all([
          doFilterExperts(filter),
          doFilterSeminars(filter),
        ]);
        if (cancelled) return;

        const sections: CarouselSectionData[] = [];

        const experts = Array.isArray(expertRes?.result) ? expertRes.result : [];
        if (experts.length) {
          const mentors = await Promise.all(
            experts
              .slice(0, 8)
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

  /** Same idea as DM rids from directConversations — include community rids from getAllCommunityChats (often missing on user payload). */
  const allowedChatRidSet = useMemo(() => {
    const s = new Set<string>();
    dmRidSet.forEach(rid => s.add(rid));
    /** Include unread snapshot rooms only for WL-style channel names (exclude default rooms like "general"). */
    Object.entries(dmUnreadByRid || {}).forEach(([rid]) => {
      const roomName = String(rcRoomNameByRid?.[rid] || '').trim().toLowerCase();
      const looksLikeWlChannel =
        roomName.startsWith('wl-group-') ||
        roomName.startsWith('wl_') ||
        roomName.includes('community');
      if (looksLikeWlChannel) s.add(String(rid));
    });
    (userDetails?.generalChats ?? []).forEach((g: any) => {
      if (g?.rcChannelId) s.add(String(g.rcChannelId));
    });
    (userDetails?.groupChats ?? []).forEach((g: any) => {
      if (g?.rcChannelId) s.add(String(g.rcChannelId));
    });
    Object.keys(communityRidToName).forEach(rid => s.add(rid));
    return s;
  }, [dmRidSet, dmUnreadByRid, rcRoomNameByRid, userDetails?.generalChats, userDetails?.groupChats, communityRidToName]);

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
    () => ({ ...rcRoomNameByRid, ...dmNameByRid, ...groupNameByRid, ...communityRidToName }),
    [rcRoomNameByRid, dmNameByRid, groupNameByRid, communityRidToName],
  );

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
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
    };
  }, [userDetails?.email, loadCommunityNotificationRooms, dispatch]);

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
          const label = roomLabelByRid[rid] || (isDm ? 'Someone' : 'Chat');
          return {
            id: `chat-${rid}`,
            title: `${label} messaged you`,
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
              onJoinMeeting={() => setActiveItem('join-meeting')}
            />
          ) : activeItem === 'join-meeting' ? (
            <JoinMeeting />
          ) : activeItem === 'contact-admin' ? (
            <ContactAdmin />
          ) : activeItem === 'seminars' ? (
            <StudentSeminars />
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
                      onJoinSeminar={() => setActiveItem('join-meeting')}
                      onJoinOneToOne={() => setActiveItem('join-meeting')}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 lg:hidden">
                <UpcomingCountdownCard
                  nextSeminar={nextSeminar}
                  nextOneToOne={nextOneToOne}
                  onJoinSeminar={() => setActiveItem('join-meeting')}
                  onJoinOneToOne={() => setActiveItem('join-meeting')}
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
        {upcomingModal && (
          <UpcomingSessionModal
            kind={upcomingModal.kind}
            status={upcomingModal.status}
            sessions={deriveModalSessions(
              userDetails,
              upcomingModal.kind,
              upcomingModal.status,
            )}
            onClose={() => setUpcomingModal(null)}
            onJoin={() => {
              setUpcomingModal(null);
              setActiveItem('join-meeting');
            }}
          /> 
        )}
      </div>
    </div>
  );
}
