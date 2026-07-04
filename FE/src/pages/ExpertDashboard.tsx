import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  MessageSquare,
  Users,
  BookOpen,
  Calendar,
  Clock,
  LayoutDashboard,
  Settings,
  Wallet,
  UserCheck,
  AlertCircle,
  MessageSquareMore,
  Video,
} from 'lucide-react';

import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import type { TopBarNotificationItem } from '../components/layout/TopBar';
import StudentSettings from '../components/dashboard/StudentSettings';
import {
  getAllCommunityChats,
  profileImageFetch,
  acceptIndividualAppointment,
  getSeminarSeatRequests,
  approveSeminarSeatRequest,
  rejectSeminarSeatRequest,
} from '../api/api';
import { resolveProfileImageSrc } from '../utils/profileImage';
import { fetchDmUnreadSnapshot } from '../api/chatApi';
import { useAppSelector } from '../store';
import { logoutUser, updateMe } from '../actions/authActions';
import { showErrorAlert, showSuccessAlert, showWarningAlert } from '../actions/alertActions';
import { patchDmUnreadRid, setChosenGroupChatDetails, setDmUnreadByRidBulk } from '../actions/chatActions';
import { connectToRC, onSubscriptionChanged, subscribeToRoom } from '../services/rcRealtime';
import { useEndMeetingOnReturn } from '../hooks/useEndMeetingOnReturn';
import { canonicalLabelsFromMixedServiceEntries } from '../constants/serviceOptions';


// Reuse existing expert dashboard feature pages (legacy MUI pages)
import ExpertCalendar from './Dashboard/_ExpertDashboard/calendar';
import ExpertAvailability from './Dashboard/_ExpertDashboard/availability';
import ExpertSeminarHub from './Dashboard/_ExpertDashboard/ExpertSeminarHub';
import ExpertSearch from './Dashboard/_ExpertDashboard/search';
import ExpertProfile from './Dashboard/_ExpertDashboard/profile';
import ExpertRevenue from './Dashboard/_ExpertDashboard/ExpertRevenue';
import ContactAdmin from './Dashboard/_ExpertDashboard/ContactAdmin';
import StudentChat from '../components/dashboard/StudentChat';
import JoinMeeting from '../components/dashboard/JoinMeeting';
import StatCard from '../components/ui/StatCard';
import Chatbot from '../components/chatbot';
import UpcomingSessionModal, {
  type UpcomingModalSession,
} from '../components/dashboard/UpcomingSessionModal';

function coerceBriefValue(value: any): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ').trim();
  if (value == null) return '';
  return String(value).trim();
}

/** The student on a 1:1 booking may be the creator or the sole participant. */
function pickStudent(g: any): any {
  const candidates = [g?.createdBy, ...(Array.isArray(g?.participants) ? g.participants : [])];
  const withBackground = candidates.find(
    (p: any) =>
      p &&
      typeof p === 'object' &&
      (p.degreeSought || p.intendedIntake || p.currentUniversity || p.gpa || p.researchInterests || p.country),
  );
  return withBackground || (typeof g?.createdBy === 'object' ? g.createdBy : null);
}

function buildStudentBrief(g: any): Array<{ label: string; value: string }> {
  const student = pickStudent(g) || {};
  const purpose =
    coerceBriefValue(g?.purposeOther) ||
    canonicalLabelsFromMixedServiceEntries(g?.services).join(', ');
  return ([
    ['Degree sought', coerceBriefValue(student.degreeSought)],
    ['Intended intake', coerceBriefValue(student.intendedIntake)],
    ['Current university', coerceBriefValue(student.currentUniversity)],
    ['GPA', coerceBriefValue(student.gpa)],
    ['Country', coerceBriefValue(student.country)],
    ['Major', coerceBriefValue(student.customKeywords)],
    ['Research interests', coerceBriefValue(student.researchInterests)],
    ['Purpose', purpose],
    ['Note', coerceBriefValue(g?.description)],
  ] as Array<[string, string]>)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => ({ label, value }));
}

function mapSeatRequestToModalSession(r: any): UpcomingModalSession {
  const seminar = r?.groupChat || {};
  const start = seminar?.start ? new Date(seminar.start).getTime() : Date.now();
  const when = seminar?.start
    ? new Date(seminar.start).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const metaLines: string[] = [];
  if (typeof r?.amount === 'number' && r.amount > 0) {
    metaLines.push(`$${(r.amount / 100).toFixed(2)} held`);
  } else {
    metaLines.push('Free seminar');
  }
  if (r?.decisionDeadline) {
    metaLines.push(`Decide by ${new Date(r.decisionDeadline).toLocaleString()}`);
  }
  return {
    id: String(r._id),
    title: seminar?.name || 'Seminar',
    at: start,
    when,
    location: 'Online · WisdomLinked',
    with: r?.customer?.username || r?.customer?.email || 'Student',
    seatRequestId: String(r._id),
    metaLines,
  };
}

function mapExpertGroupToModalSession(g: any): UpcomingModalSession {
  const start = g?.start ? new Date(g.start).getTime() : Date.now();
  const when = g?.start
    ? new Date(g.start).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  let withLabel = 'Session';
  if (g?.type === 'seminar') {
    const n = Array.isArray(g.participants) ? g.participants.length : 0;
    withLabel = n ? `${n} enrolled` : 'Seminar';
  } else {
    const parts = g.participants || [];
    const first = parts[0];
    if (first && typeof first === 'object' && first.username) {
      withLabel = first.username;
    } else if (parts.length) {
      withLabel = `${parts.length} participant(s)`;
    } else {
      withLabel = '1:1 session';
    }
  }
  return {
    id: String(g._id),
    title: g.name || 'Session',
    at: start,
    when,
    location: 'Online · WisdomLinked',
    with: withLabel,
    studentBrief: g?.type === 'individual' ? buildStudentBrief(g) : undefined,
  };
}

export default function ExpertDashboard() {
  useEndMeetingOnReturn();
  const dispatch = useDispatch();
  const location = useLocation();

  const {
    auth: { userDetails },
  } = useAppSelector((state) => state);

  // Persist the active view so a refresh keeps the user on the same tab.
  const [activeItem, setActiveItem] = useState(
    () => window.localStorage.getItem('expertDashboardView') || 'dashboard',
  );
  useEffect(() => {
    window.localStorage.setItem('expertDashboardView', activeItem);
  }, [activeItem]);
  // Child views (e.g. the calendar) request the chat tab by firing this event.
  useEffect(() => {
    const onNav = () => setActiveItem('chat');
    window.addEventListener('wl-open-chat-nav', onNav);
    return () => window.removeEventListener('wl-open-chat-nav', onNav);
  }, []);
  const [dmUnreadByRid, setDmUnreadByRid] = useState<Record<string, number>>({});
  const [rcRoomNameByRid, setRcRoomNameByRid] = useState<Record<string, string>>({});
  const [communityRidToName, setCommunityRidToName] = useState<Record<string, string>>({});
  const [range, setRange] = useState<'today' | 'week' | 'all'>('all');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [expertUpcomingModal, setExpertUpcomingModal] = useState<{
    kind: 'seminar' | 'oneToOne';
    status: 'booked' | 'pending';
  } | null>(null);

  // Overflow seminar seat requests (students who registered past the cap) awaiting
  // the host's approval — surfaced as the "Pending seminars" card + modal.
  const [seatRequests, setSeatRequests] = useState<any[]>([]);

  const loadSeatRequests = useCallback(async () => {
    const res: any = await getSeminarSeatRequests();
    setSeatRequests(Array.isArray(res?.result) ? res.result : []);
  }, []);

  useEffect(() => {
    if (String(userDetails?.role).toLowerCase() !== 'expert') return;
    void loadSeatRequests();
  }, [userDetails?.role, userDetails?._id, loadSeatRequests]);

  const userDetailsRef = useRef(userDetails);
  userDetailsRef.current = userDetails;

  // Auth + socket only. Do NOT call updateMe() when userDetails changes — that caused an
  // infinite loop (updateMe → new userDetails → effect → updateMe) and broke pages like Seminar.
  useEffect(() => {
    const isLoggedIn = !!userDetails?.email;
    if (!isLoggedIn || String(userDetails?.role).toLowerCase() !== 'expert') {
      dispatch(logoutUser() as any);
    }
  }, [
    userDetails?.email,
    userDetails?.role,
    userDetails?._id,
    dispatch,
  ]);

  // Refresh profile when the route changes or socket first becomes ready — not on every userDetails update.
  useEffect(() => {
    const isLoggedIn = !!userDetails?.email;
    if (!isLoggedIn || String(userDetails?.role).toLowerCase() !== 'expert') {
      return;
    }
    dispatch(updateMe() as any);
  }, [
    location.pathname,
    userDetails?.email,
    userDetails?.role,
    dispatch,
  ]);

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
      if (snapshot?.success && snapshot.unreadByRid) setDmUnreadByRid(snapshot.unreadByRid);
      else setDmUnreadByRid({});
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
      dispatch(updateMe() as any); // pull new bookings (pending sessions/seminars) on tab return
    };
    const onFocus = () => {
      void hydrateUnreadSnapshot();
      void loadCommunityNotificationRooms();
      dispatch(updateMe() as any);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [hydrateUnreadSnapshot, loadCommunityNotificationRooms, dispatch]);

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

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'seminar', label: 'Seminar', icon: BookOpen },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'join-meeting', label: 'Join Meeting', icon: Video },
      { id: 'availability', label: 'Availability', icon: Clock },
      { id: 'contact-admin', label: 'Contact admin', icon: MessageSquareMore },
      { id: 'revenue', label: 'Revenue', icon: Wallet },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
    []
  );

  const expertName = userDetails?.username || 'Expert';

  const now = new Date();

  const inSelectedRange = (date: Date) => {
    if (range === 'all') return true;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(startOfToday);
    if (range === 'week') {
      const day = start.getDay();
      const diff = (day + 6) % 7; // Monday start
      start.setDate(start.getDate() - diff);
    }
    const end = new Date(start);
    if (range === 'today') {
      end.setDate(start.getDate() + 1);
    } else {
      end.setDate(start.getDate() + 7);
    }
    return date >= start && date < end;
  };

  const {
    acceptedSeminars,
    bookedSessions,
    pendingSessions,
  } = useMemo(() => {
    const { groupChats = [] } = (userDetails || {}) as any;
    const nowTs = Date.now();

    const upcoming = (start: any, end: any) => {
      const endTs = new Date(end).getTime();
      return endTs >= nowTs;
    };

    const seminarsRaw = (groupChats || []).filter(
      (g: any) =>
        g.type === 'seminar' &&
        upcoming(g.start, g.end) &&
        inSelectedRange(new Date(g.start))
    );

    const seenSeminarSeries = new Set<string>();
    const seminars: any[] = [];
    for (const g of [...seminarsRaw].sort(
      (a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    )) {
      const sid = g?.seriesId ? String(g.seriesId) : null;
      if (sid) {
        if (seenSeminarSeries.has(sid)) continue;
        seenSeminarSeries.add(sid);
      }
      seminars.push(g);
    }

    const sessions = (groupChats || []).filter(
      (g: any) =>
        g.type === 'individual' &&
        g.status === 'active' &&
        upcoming(g.start, g.end) &&
        inSelectedRange(new Date(g.start))
    );

    // Pending requests are NOT scoped to the today/week range — the expert must
    // see every booking awaiting action regardless of which date window is shown.
    const pendingSess = (groupChats || []).filter(
      (g: any) =>
        g.type === 'individual' &&
        g.status === 'pending' &&
        upcoming(g.start, g.end)
    );

    return {
      acceptedSeminars: seminars,
      bookedSessions: sessions,
      pendingSessions: pendingSess,
    };
  }, [userDetails, range]);

  // Accept flows. The api wrappers return `false` on error (alert/logout already
  // handled), or the payload on success — refresh via updateMe() either way.
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleAcceptSession = useCallback(
    async (session: any) => {
      setAcceptingId(String(session._id));
      try {
        const res: any = await acceptIndividualAppointment({ groupChatId: session._id });
        if (res === false) return;
        dispatch(updateMe() as any);
        dispatch(showSuccessAlert('1:1 session accepted.'));
      } catch {
        dispatch(showErrorAlert('Could not accept the session. Please try again.'));
      } finally {
        setAcceptingId(null);
      }
    },
    [dispatch],
  );

  const expertModalSessions = useMemo((): UpcomingModalSession[] => {
    if (!expertUpcomingModal) return [];
    const { kind, status } = expertUpcomingModal;
    if (kind === 'oneToOne') {
      const list = status === 'booked' ? bookedSessions : pendingSessions;
      return list.map(mapExpertGroupToModalSession);
    }
    if (status === 'pending') {
      return seatRequests.map(mapSeatRequestToModalSession);
    }
    return acceptedSeminars.map(mapExpertGroupToModalSession);
  }, [
    expertUpcomingModal,
    bookedSessions,
    pendingSessions,
    acceptedSeminars,
    seatRequests,
  ]);

  const handleSeatDecision = useCallback(
    async (session: UpcomingModalSession, action: 'accept' | 'decline') => {
      const requestId = session.seatRequestId;
      if (!requestId) return;
      try {
        const res: any = action === 'accept'
          ? await approveSeminarSeatRequest(requestId)
          : await rejectSeminarSeatRequest(requestId);
        if (res === false || res?.status === 'FAIL' || res?.error) {
          dispatch(showErrorAlert(res?.error || 'Could not update the seat request.'));
          return;
        }
        setSeatRequests(prev => prev.filter(r => String(r._id) !== String(requestId)));
        dispatch(
          showSuccessAlert(action === 'accept' ? 'Seat request accepted.' : 'Seat request declined.'),
        );
        dispatch(updateMe() as any);
      } catch {
        dispatch(showErrorAlert('Could not update the seat request. Please try again.'));
      }
    },
    [dispatch],
  );

  const handleExpertJoinSession = (session: UpcomingModalSession) => {
    const id = session.id;
    const raw =
      bookedSessions.find((x: any) => String(x._id) === id) ||
      acceptedSeminars.find((x: any) => String(x._id) === id);
    if (!raw) {
      dispatch(showErrorAlert('Could not open this session.'));
      return;
    }
    dispatch(
      setChosenGroupChatDetails({
        ...raw,
        groupId: raw._id,
        groupName: raw.name,
      } as any)
    );
    setExpertUpcomingModal(null);
    setActiveItem('chat');
  };

  const title =
    activeItem === 'chat'
      ? 'Chat'
      : activeItem === 'clients'
        ? 'Clients'
        : activeItem === 'revenue'
          ? 'Revenue'
          : activeItem === 'contact-admin'
            ? 'Contact admin'
          : activeItem === 'seminar'
            ? 'Seminar'
            : activeItem === 'calendar'
              ? 'Calendar'
              : activeItem === 'join-meeting'
                ? 'Join meeting'
              : activeItem === 'availability'
                ? 'Availability'
                : activeItem === 'profile'
                  ? 'Profile'
                  : activeItem === 'settings'
                    ? 'Settings'
                    : 'Expert Dashboard';

  const content =
    activeItem === 'chat' ? (
      <div className="h-[calc(100vh-56px)] bg-wl-page">
        <StudentChat />
      </div>
    ) : activeItem === 'clients' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertSearch />
      </div>
    ) : activeItem === 'revenue' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertRevenue />
      </div>
    ) : activeItem === 'contact-admin' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ContactAdmin />
      </div>
    ) : activeItem === 'seminar' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertSeminarHub />
      </div>
    ) : activeItem === 'calendar' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertCalendar />
      </div>
    ) : activeItem === 'join-meeting' ? (
      <JoinMeeting />
    ) : activeItem === 'availability' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertAvailability />
      </div>
    ) : activeItem === 'profile' ? (
      <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF]">
        <ExpertProfile userDetails={userDetails} onBack={() => setActiveItem('dashboard')} />
      </div>
    ) : activeItem === 'settings' ? (
      <StudentSettings />
    ) : (
      <div className="px-6 py-7 space-y-6">
        {/* Stats row */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-900 mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              label="Upcoming 1:1 sessions"
              value={bookedSessions.length}
              icon={UserCheck}
              color="success"
              tooltip="View sessions and join the meeting room"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'oneToOne', status: 'booked' })
              }
            />
            <StatCard
              label="Upcoming seminars"
              value={acceptedSeminars.length}
              icon={BookOpen}
              color="primary"
              tooltip="Your hosted seminars — join opens chat"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'seminar', status: 'booked' })
              }
            />
            <StatCard
              label="Pending 1:1 sessions"
              value={pendingSessions.length}
              icon={AlertCircle}
              color="warning"
              tooltip="Requests awaiting confirmation"
              onClick={() =>
                setExpertUpcomingModal({ kind: 'oneToOne', status: 'pending' })
              }
            />
            <StatCard
              label="Pending seminars"
              value={seatRequests.length}
              icon={AlertCircle}
              color="warning"
              tooltip="Seat requests past capacity awaiting your approval"
              onClick={() => {
                void loadSeatRequests();
                setExpertUpcomingModal({ kind: 'seminar', status: 'pending' });
              }}
            />
          </div>
        </section>

        {/* Filters */}
        <section className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Today&apos;s and upcoming sessions
          </h3>
          <div className="inline-flex rounded-full bg-slate-100 p-0.5">
            {(['today', 'week', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-full capitalize transition ${
                  range === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {key === 'all' ? 'All upcoming' : key}
              </button>
            ))}
          </div>
        </section>

        {/* Lists */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1:1 sessions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">
                1:1 Sessions
              </h4>
              <span className="text-[11px] text-slate-500">
                {bookedSessions.length} booked · {pendingSessions.length} pending
              </span>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {bookedSessions.map((s: any) => (
                <div
                  key={s._id}
                  className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(s.start).toLocaleString()}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Confirmed
                  </span>
                </div>
              ))}
              {pendingSessions.map((s: any) => (
                <div
                  key={s._id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {new Date(s.start).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAcceptSession(s)}
                    disabled={acceptingId === String(s._id)}
                    className="shrink-0 inline-flex items-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {acceptingId === String(s._id) ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              ))}
              {!bookedSessions.length && !pendingSessions.length && (
                <p className="text-[12px] text-slate-500">
                  No upcoming 1:1 sessions in this range.
                </p>
              )}
            </div>
          </div>

          {/* Seminars */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">
                Seminars
              </h4>
              <span className="text-[11px] text-slate-500">
                {acceptedSeminars.length} upcoming
              </span>
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {acceptedSeminars.map((g: any) => (
                <div
                  key={g._id}
                  className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {g.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(g.start).toLocaleString()}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Confirmed
                  </span>
                </div>
              ))}
              {!acceptedSeminars.length && (
                <p className="text-[12px] text-slate-500">
                  No upcoming seminars in this range.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[14px]">
      <div className="flex min-h-screen">
        <Sidebar
          activeItem={activeItem}
          onNavigate={(id) => {
            if (id === 'logout') {
              dispatch(logoutUser() as any);
              return;
            }
            setActiveItem(id);
          }}
          navItems={navItems}
          studentName={expertName}
          avatarUrl={avatarUrl}
          roleLabel="Expert"
          notifications={{ chat: activeItem === 'chat' ? 0 : totalUnreadDm }}
        />

        <main className="flex-1 min-w-0 lg:ml-[220px]">
          <TopBar
            title={title}
            userName={expertName}
            avatarUrl={avatarUrl}
            notifications={chatNotifications}
            notificationsEnabled
            onProfileClick={() => setActiveItem('profile')}
            onSettingsClick={() => setActiveItem('settings')}
          />
          {content}
          {activeItem !== 'chat' ? <Chatbot /> : null}

          {/* Keep call UX working in the new layout */}
        </main>

        {expertUpcomingModal ? (
          <UpcomingSessionModal
            kind={expertUpcomingModal.kind}
            status={expertUpcomingModal.status}
            role="expert"
            sessions={expertModalSessions}
            onClose={() => setExpertUpcomingModal(null)}
            onJoinSession={
              expertUpcomingModal.status === 'booked'
                ? handleExpertJoinSession
                : undefined
            }
            onAcceptSeatRequest={
              expertUpcomingModal.kind === 'seminar' && expertUpcomingModal.status === 'pending'
                ? (s) => handleSeatDecision(s, 'accept')
                : undefined
            }
            onDeclineSeatRequest={
              expertUpcomingModal.kind === 'seminar' && expertUpcomingModal.status === 'pending'
                ? (s) => handleSeatDecision(s, 'decline')
                : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}

