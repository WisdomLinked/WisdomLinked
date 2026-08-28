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
  cancelIndividualAppointment,
  getSeminarSeatRequests,
  approveSeminarSeatRequest,
  rejectSeminarSeatRequest,
  getMyFollowers,
} from '../api/api';
import { resolveProfileImageSrc } from '../utils/profileImage';
import { displayRoomLabel, shouldNotifyRoom } from '../utils/chatRoomLabel';
import { seminarEnrollmentLabel } from '../utils/seminarCapacityLabel';
import { fetchDmUnreadSnapshot, fetchChatUserProfile } from '../api/chatApi';
import ProfileModal from './Dashboard/Messenger/Messages/ProfileModal';
import SeminarDetails from './Dashboard/seminarDetails';
import { buildFallbackChatProfile, mergeChatProfile } from '../utils/chatProfileModal';
import { useAppSelector } from '../store';
import { logoutUser, updateMe } from '../actions/authActions';
import { showErrorAlert, showWarningAlert } from '../actions/alertActions';
import { patchDmUnreadRid, setChosenGroupChatDetails, setDmUnreadByRidBulk } from '../actions/chatActions';
import { connectToRC, onSubscriptionChanged, subscribeToRoom } from '../services/rcRealtime';
import { useEndMeetingOnReturn } from '../hooks/useEndMeetingOnReturn';


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
import DecisionNoteField from '../components/dashboard/DecisionNoteField';
import StatCard from '../components/ui/StatCard';
import { awaitsExpertDecision, awaitsWalletPayment, pendingSessionState } from '../utils/bookingLifecycle';
import Chatbot from '../components/chatbot';
import UpcomingSessionModal, {
  type UpcomingModalSession,
} from '../components/dashboard/UpcomingSessionModal';
import { sessionDurationLabel, sessionDurationMinutes, sessionEndMs } from '../utils/sessionDuration';
import FollowersModal, {
  type FollowerEntry,
} from '../components/dashboard/FollowersModal';

function refIdOf(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object') {
    const o = ref as { _id?: unknown; id?: unknown };
    return String(o._id ?? o.id ?? '');
  }
  return String(ref);
}

/** The student on a 1:1 booking may be the creator or the sole participant. */
function pickStudent(g: any): any {
  const candidates = [g?.createdBy, ...(Array.isArray(g?.participants) ? g.participants : [])];
  const withBackground = candidates.find(
    (p: any) =>
      p &&
      typeof p === 'object' &&
      (p.degreeSought || p.intendedIntake || p.currentUniversity || p.gpa || p.country),
  );
  return withBackground || (typeof g?.createdBy === 'object' ? g.createdBy : null);
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
    // A wallet request holds nothing — approving it asks the student to pay.
    metaLines.push(
      r?.paymentMode === 'wallet'
        ? `$${(r.amount / 100).toFixed(2)} — WeChat Pay / Alipay, paid after you approve`
        : `$${(r.amount / 100).toFixed(2)} held`,
    );
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
    durationMinutes: sessionDurationMinutes(seminar) ?? undefined,
    endsAt: sessionEndMs(seminar) ?? undefined,
    location: 'Online · WisdomLinked',
    with: r?.customer?.username || r?.customer?.email || 'Student',
    peerUserId: r?.customer?._id ? String(r.customer._id) : undefined,
    seatRequestId: String(r._id),
    detail: {
      title: seminar?.name || 'Seminar',
      description: seminar?.description,
      start: seminar?.start,
      end: seminar?.end,
      duration: seminar?.duration,
      price: typeof seminar?.price === 'number' ? seminar.price : undefined,
      admin: seminar?.admin,
      participants: seminar?.participants || [],
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
}

function mapExpertGroupToModalSession(g: any, waitingCount = 0): UpcomingModalSession {
  const start = g?.start ? new Date(g.start).getTime() : Date.now();
  const when = g?.start
    ? new Date(g.start).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  let withLabel = 'Session';
  if (g?.type === 'seminar') {
    withLabel = '';
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
  const metaLines: string[] = [];
  if (g?.type === 'seminar') {
    const adminId = refIdOf(g?.admin);
    const enrolled = (Array.isArray(g?.participants) ? g.participants : []).filter(
      (p: unknown) => refIdOf(p) !== adminId,
    ).length;
    const maxAttendees =
      typeof g?.maxAttendees === 'number' ? g.maxAttendees : null;
    metaLines.push(seminarEnrollmentLabel(enrolled, waitingCount, maxAttendees));
  }
  if (g?.type === 'individual' && g?.status === 'pending') {
    // A wallet request holds nothing: accepting it asks the student to pay, and the
    // session is confirmed only when that payment lands.
    const wallet = g?.paymentMode === 'wallet';
    if (typeof g?.price === 'number' && g.price > 0) {
      metaLines.push(
        wallet
          ? `$${g.price.toFixed(2)} — WeChat Pay / Alipay, paid after you accept`
          : `$${g.price.toFixed(2)} authorized, not charged`,
      );
    }
    const expertProposed = refIdOf(g?.createdBy) === refIdOf(g?.admin);
    if (wallet && g?.paymentDeadline) {
      metaLines.push(`Accepted by you — waiting for the student to pay by ${new Date(g.paymentDeadline).toLocaleString()}`);
    } else if (expertProposed && g?.paymentDeadline) {
      metaLines.push(`Your offer — waiting for the student to pay by ${new Date(g.paymentDeadline).toLocaleString()}`);
    } else if (g?.decisionDeadline) {
      metaLines.push(`Waiting for your decision — decide by ${new Date(g.decisionDeadline).toLocaleString()}`);
    }
  }
  return {
    id: String(g._id),
    title: g.name || 'Session',
    at: start,
    when,
    durationMinutes: sessionDurationMinutes(g) ?? undefined,
    endsAt: sessionEndMs(g) ?? undefined,
    location: 'Online · WisdomLinked',
    with: withLabel,
    metaLines: metaLines.length ? metaLines : undefined,
    peerUserId:
      g?.type === 'individual' ? String(pickStudent(g)?._id ?? '') : undefined,
    detail: {
      title: g?.name || 'Session',
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
    briefLabel: g?.type === 'seminar' ? 'Seminar details' : 'Session details',
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
  const [rcDisplayNameByRid, setRcDisplayNameByRid] = useState<Record<string, string>>({});
  const [roomNamesUnresolved, setRoomNamesUnresolved] = useState(false);
  const [knownRids, setKnownRids] = useState<string[]>([]);
  const [communityRidToName, setCommunityRidToName] = useState<Record<string, string>>({});
  const [range, setRange] = useState<'today' | 'week' | 'all'>('all');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [expertUpcomingModal, setExpertUpcomingModal] = useState<{
    kind: 'seminar' | 'oneToOne';
    status: 'booked' | 'pending';
  } | null>(null);

  // Student profile card opened from a row in the upcoming-sessions modal or followers list.
  const [peerProfile, setPeerProfile] = useState<any | null>(null);
  const [peerProfileOpen, setPeerProfileOpen] = useState(false);
  const [inlineDetailSession, setInlineDetailSession] = useState<UpcomingModalSession | null>(null);

  const openPeerProfileById = useCallback(
    async (peerId: string, username?: string, image?: string | null) => {
      if (!peerId) return;
      const fallback = buildFallbackChatProfile(
        { userId: peerId, username: username || 'Student', image: image ?? null },
        String(userDetails?.role || ''),
      );
      setPeerProfile(fallback);
      setPeerProfileOpen(true);
      const response = await fetchChatUserProfile(peerId);
      if (response?.success && 'result' in response && response.result) {
        setPeerProfile(mergeChatProfile(fallback, response.result));
      }
    },
    [userDetails?.role],
  );

  const handleViewPeerProfile = useCallback(
    (session: UpcomingModalSession) =>
      openPeerProfileById(String(session.peerUserId || ''), session.with),
    [openPeerProfileById],
  );

  const handleClosePeerProfile = useCallback(() => {
    setPeerProfileOpen(false);
    setPeerProfile(null);
  }, []);

  // Followers list opened from the top-right button; clicking a row opens the student card.
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);

  const loadFollowers = useCallback(async () => {
    setFollowersLoading(true);
    try {
      const res: any = await getMyFollowers();
      setFollowers(Array.isArray(res?.result) ? res.result : []);
    } finally {
      setFollowersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (String(userDetails?.role).toLowerCase() !== 'expert') return;
    void loadFollowers();
  }, [userDetails?.role, userDetails?._id, loadFollowers]);

  const handleOpenFollowers = useCallback(() => {
    setFollowersOpen(true);
    void loadFollowers();
  }, [loadFollowers]);

  const handleSelectFollower = useCallback(
    (follower: FollowerEntry) => {
      setFollowersOpen(false);
      void openPeerProfileById(String(follower._id), follower.username, follower.image ?? null);
    },
    [openPeerProfileById],
  );

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
      if (snapshot?.success && snapshot.unreadByRid) setDmUnreadByRid(snapshot.unreadByRid);
      else setDmUnreadByRid({});
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

  const knownRidSet = useMemo(() => new Set(knownRids.map(String)), [knownRids]);

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

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'seminar', label: 'Seminars', icon: BookOpen },
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
    awaitingPaymentSessions,
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
    // Every session list is ordered by when the session happens, so a card sits in the
    // same place whether it is read on the dashboard or in the modal. Ordering pending
    // requests by arrival instead put them in a different order from the same rows in
    // the modal, which sorts by start.
    const byStart = (a: any, b: any) => {
      const at = new Date(a.start).getTime();
      const bt = new Date(b.start).getTime();
      if (at !== bt) return at - bt;
      return String(a.name || '').localeCompare(String(b.name || ''));
    };

    const stillPending = (groupChats || []).filter(
      (g: any) =>
        g.type === 'individual' &&
        g.status === 'pending' &&
        upcoming(g.start, g.end)
    );

    // A wallet request the expert already accepted stays `pending` until the student
    // pays, so it must not be counted or offered as something left to decide.
    const pendingSess = stillPending.filter((g: any) => awaitsExpertDecision(g)).sort(byStart);
    const awaitingPaymentSess = stillPending.filter((g: any) => awaitsWalletPayment(g)).sort(byStart);

    return {
      acceptedSeminars: seminars,
      bookedSessions: [...sessions].sort(byStart),
      pendingSessions: pendingSess,
      awaitingPaymentSessions: awaitingPaymentSess,
    };
  }, [userDetails, range]);

  // Accept flows. The api wrappers return `false` on error (alert/logout already
  // handled), or the payload on success — refresh via updateMe() either way.
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  // Just-accepted 1:1 rows on the dashboard show a confirmation in place of the
  // card for a few seconds instead of a toast banner.
  const [acceptedInline, setAcceptedInline] = useState<
    Record<string, { message: string; session: any }>
  >({});
  const inlineNoticeTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      inlineNoticeTimers.current.forEach(id => window.clearTimeout(id));
    },
    [],
  );

  // Accepting a 1:1 no longer pops a banner — callers surface an in-card message.
  const handleAcceptSession = useCallback(
    async (session: any, note = ''): Promise<boolean> => {
      setAcceptingId(String(session._id));
      try {
        const res: any = await acceptIndividualAppointment({ groupChatId: session._id, note });
        if (res === false) return false;
        dispatch(updateMe() as any);
        return true;
      } catch {
        dispatch(showErrorAlert('Could not accept the session. Please try again.'));
        return false;
      } finally {
        setAcceptingId(null);
      }
    },
    [dispatch],
  );

  // Dashboard "1:1 Sessions" list: accept, then replace the row with a
  // transient confirmation that clears after 7 seconds.
  const acceptInlineSession = useCallback(
    async (s: any, note = '') => {
      const ok = await handleAcceptSession(s, note);
      if (!ok) return;
      const studentName =
        pickStudent(s)?.username ||
        (Array.isArray(s.participants) ? s.participants : []).find(
          (p: any) => p && typeof p === 'object' && p.username,
        )?.username ||
        'The student';
      const title = s.name || '';
      // A wallet booking isn't confirmed by acceptance — the student still has to pay.
      const message =
        s?.paymentMode === 'wallet'
          ? `${studentName} has been accepted for the 1:1 session${
              title ? ` “${title}”` : ''
            }. They pay by WeChat Pay or Alipay, so it is confirmed once their payment comes through.`
          : `${studentName} has been accepted for the 1:1 session${
              title ? ` “${title}”` : ''
            }.`;
      const id = String(s._id);
      setAcceptedInline(prev => ({ ...prev, [id]: { message, session: s } }));
      const timer = window.setTimeout(() => {
        setAcceptedInline(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 7000);
      inlineNoticeTimers.current.push(timer);
    },
    [handleAcceptSession],
  );

  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawConfirmId, setWithdrawConfirmId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineConfirmId, setDeclineConfirmId] = useState<string | null>(null);
  // Per-row note for the inline 1:1 list, so two open rows never share a draft.
  const [inlineNotes, setInlineNotes] = useState<Record<string, string>>({});
  const [inlineNoteErrors, setInlineNoteErrors] = useState<Record<string, string>>({});
  const inlineNote = (id: string) => inlineNotes[id] ?? '';
  const setInlineNote = (id: string, next: string) => {
    setInlineNotes(prev => ({ ...prev, [id]: next }));
    if (next.trim()) setInlineNoteErrors(prev => ({ ...prev, [id]: '' }));
  };
  const cancelPendingSession = useCallback(
    async (session: any, intent: 'withdraw' | 'decline', note = ''): Promise<boolean> => {
      const setBusy = intent === 'withdraw' ? setWithdrawingId : setDecliningId;
      setBusy(String(session._id));
      try {
        const res: any = await cancelIndividualAppointment(session._id, note);
        if (res === false) return false;
        dispatch(updateMe() as any);
        return true;
      } catch {
        dispatch(
          showErrorAlert(
            intent === 'withdraw'
              ? 'Could not withdraw the session offer. Please try again.'
              : 'Could not decline the request. Please try again.',
          ),
        );
        return false;
      } finally {
        setBusy(null);
      }
    },
    [dispatch],
  );
  const handleWithdrawSession = useCallback(
    (session: any, note = '') => cancelPendingSession(session, 'withdraw', note),
    [cancelPendingSession],
  );
  const handleDeclineSession = useCallback(
    (session: any, note = '') => cancelPendingSession(session, 'decline', note),
    [cancelPendingSession],
  );

  const withdrawInlineSession = useCallback(
    async (s: any, note = '') => {
      const ok = await handleWithdrawSession(s, note);
      if (!ok) return;
      setWithdrawConfirmId(null);
      const studentName =
        pickStudent(s)?.username ||
        (Array.isArray(s.participants) ? s.participants : []).find(
          (p: any) => p && typeof p === 'object' && p.username,
        )?.username ||
        'The student';
      const title = s.name || '';
      const message = `Your session offer${title ? ` “${title}”` : ''} has been withdrawn. ${studentName} was not charged.`;
      const id = String(s._id);
      setAcceptedInline(prev => ({ ...prev, [id]: { message, session: s } }));
      const timer = window.setTimeout(() => {
        setAcceptedInline(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 7000);
      inlineNoticeTimers.current.push(timer);
    },
    [handleWithdrawSession],
  );

  const declineInlineSession = useCallback(
    async (s: any, note = '') => {
      const ok = await handleDeclineSession(s, note);
      if (!ok) return;
      setDeclineConfirmId(null);
      const studentName =
        pickStudent(s)?.username ||
        (Array.isArray(s.participants) ? s.participants : []).find(
          (p: any) => p && typeof p === 'object' && p.username,
        )?.username ||
        'The student';
      const title = s.name || '';
      const message = `${studentName}'s request${title ? ` for “${title}”` : ''} was declined and their payment authorization released. They were not charged.`;
      const id = String(s._id);
      setAcceptedInline(prev => ({ ...prev, [id]: { message, session: s } }));
      const timer = window.setTimeout(() => {
        setAcceptedInline(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 7000);
      inlineNoticeTimers.current.push(timer);
    },
    [handleDeclineSession],
  );

  // A decline has to carry a note, so the confirm button validates before firing.
  const submitInlineDecline = useCallback(
    (s: any) => {
      const rowId = String(s._id);
      const note = (inlineNotes[rowId] ?? '').trim();
      if (!note) {
        setInlineNoteErrors(prev => ({
          ...prev,
          [rowId]: 'Please add a short note so the student knows what to do next.',
        }));
        return;
      }
      void declineInlineSession(s, note);
    },
    [inlineNotes, declineInlineSession],
  );

  // Keep just-accepted rows on screen for the notice window even after
  // pendingSessions refreshes them out of the list.
  const inlinePendingSessions = useMemo(() => {
    const present = new Set(pendingSessions.map((s: any) => String(s._id)));
    const lingering = Object.values(acceptedInline)
      .filter(n => !present.has(String(n.session._id)))
      .map(n => n.session);
    return [...pendingSessions, ...lingering];
  }, [pendingSessions, acceptedInline]);

  const expertModalSessions = useMemo((): UpcomingModalSession[] => {
    if (!expertUpcomingModal) return [];
    const { kind, status } = expertUpcomingModal;
    if (kind === 'oneToOne') {
      // Sessions the expert accepted but the student has not paid for are shown here for
      // visibility, with no accept/decline — that decision is already made.
      const list = status === 'booked'
        ? bookedSessions
        : [...pendingSessions, ...awaitingPaymentSessions];
      return list.map((g: any) => {
        const base = mapExpertGroupToModalSession(g);
        if (status !== 'pending') return base;
        const pendingState = pendingSessionState(g, String(userDetails?._id ?? ''));
        if (pendingState === 'accepted_awaiting_payment') return { ...base, pendingState };
        const expertProposed = pendingState === 'offer_awaiting_payment';
        return {
          ...base,
          pendingState,
          canAccept: !expertProposed,
          canWithdraw: expertProposed,
        };
      });
    }
    if (status === 'pending') {
      return seatRequests.map(mapSeatRequestToModalSession);
    }
    const waitingBySeminar: Record<string, number> = {};
    for (const r of seatRequests) {
      const sid = refIdOf(r?.groupChat);
      if (sid) waitingBySeminar[sid] = (waitingBySeminar[sid] || 0) + 1;
    }
    return acceptedSeminars.map((g: any) =>
      mapExpertGroupToModalSession(g, waitingBySeminar[String(g?._id)] || 0),
    );
  }, [
    expertUpcomingModal,
    bookedSessions,
    pendingSessions,
    awaitingPaymentSessions,
    acceptedSeminars,
    seatRequests,
    userDetails,
  ]);

  // Returns the confirmation message so the modal can show it in-card (no banner).
  const handleSeatDecision = useCallback(
    async (
      session: UpcomingModalSession,
      action: 'accept' | 'decline',
      note = '',
    ): Promise<string | void> => {
      const requestId = session.seatRequestId;
      if (!requestId) return;
      const raw = seatRequests.find(r => String(r._id) === String(requestId));
      const studentName = session.with || raw?.customer?.username || raw?.customer?.email || 'The student';
      const seminarTitle = session.title || raw?.groupChat?.name || 'the seminar';
      const cents = typeof raw?.amount === 'number' ? raw.amount : 0;
      const amountLabel = cents > 0 ? `$${(cents / 100).toFixed(2)}` : '';
      try {
        const res: any = action === 'accept'
          ? await approveSeminarSeatRequest(requestId, note)
          : await rejectSeminarSeatRequest(requestId, note);
        if (res === false || res?.status === 'FAIL' || res?.error) {
          dispatch(showErrorAlert(res?.error || 'Could not update the seat request.'));
          return;
        }
        setSeatRequests(prev => prev.filter(r => String(r._id) !== String(requestId)));
        dispatch(updateMe() as any);
        return action === 'accept'
          ? `${studentName} has been admitted to the seminar “${seminarTitle}”.${amountLabel ? ` A payment of ${amountLabel} has been successfully charged.` : ''}`
          : `${studentName} was not admitted to “${seminarTitle}”.${amountLabel ? ` The payment authorization of ${amountLabel} has been released.` : ''}`;
      } catch {
        dispatch(showErrorAlert('Could not update the seat request. Please try again.'));
      }
    },
    [dispatch, seatRequests],
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-slate-900">
              Overview
            </h2>
            <button
              type="button"
              onClick={handleOpenFollowers}
              className="inline-flex items-center gap-2 rounded-lg border border-[#234C6A] bg-[#234C6A] px-3.5 py-2.5 text-[14px] font-semibold text-white shadow-[0_12px_30px_rgba(26,58,74,0.16)] transition-shadow hover:shadow-[0_18px_45px_rgba(26,58,74,0.22)]"
              aria-label="Followers"
            >
              <Users className="h-4 w-4 text-white" aria-hidden />
              <span>Followers</span>
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-md bg-white/15 px-1.5 text-[12px] font-semibold text-white">
                {followers.length}
              </span>
            </button>
          </div>
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
              {inlinePendingSessions.map((s: any) => {
                const notice = acceptedInline[String(s._id)];
                if (notice) {
                  return (
                    <div
                      key={s._id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-800"
                    >
                      {notice.message}
                    </div>
                  );
                }
                const createdById =
                  typeof s.createdBy === 'object' ? s.createdBy?._id : s.createdBy;
                const expertProposed =
                  String(createdById) === String(userDetails?._id);
                const rowId = String(s._id);
                const noteRequired = !expertProposed && declineConfirmId === rowId;
                const showNote = !expertProposed || withdrawConfirmId === rowId;
                return (
                  <div
                    key={s._id}
                    className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setInlineDetailSession(mapExpertGroupToModalSession(s))}
                        title="View appointment details"
                        className="block max-w-full truncate text-left text-[13px] font-semibold text-slate-900 hover:underline"
                      >
                        {s.name}
                      </button>
                      <div className="text-[11px] text-slate-600">
                        {new Date(s.start).toLocaleString()}
                        {sessionDurationLabel(s) ? ` · ${sessionDurationLabel(s)}` : ''}
                      </div>
                      {(() => {
                        const student = pickStudent(s);
                        const studentId = student?._id ? String(student._id) : '';
                        const studentName =
                          student?.username || student?.email || 'Student';
                        if (!studentId || expertProposed) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              void openPeerProfileById(studentId, studentName, student?.image ?? null)
                            }
                            title="View student card"
                            className="mt-0.5 block max-w-full truncate text-left text-[11px] font-medium text-[#234C6A] hover:underline"
                          >
                            {studentName}
                          </button>
                        );
                      })()}
                      {!expertProposed && s.decisionDeadline ? (
                        <div className="mt-0.5 text-[10px] font-semibold text-amber-700">
                          Decide by {new Date(s.decisionDeadline).toLocaleString()}
                        </div>
                      ) : null}
                      {expertProposed && s.paymentDeadline ? (
                        <div className="mt-0.5 text-[10px] font-semibold text-amber-700">
                          Student to pay by {new Date(s.paymentDeadline).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    {expertProposed ? (
                      <div className="shrink-0 flex items-center gap-2">
                        {withdrawConfirmId === String(s._id) ? (
                          <>
                            <span className="text-[10px] font-medium text-slate-600">
                              Withdraw this offer?
                            </span>
                            <button
                              type="button"
                              onClick={() => setWithdrawConfirmId(null)}
                              disabled={withdrawingId === String(s._id)}
                              className="rounded-[4px] border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              onClick={() => withdrawInlineSession(s, inlineNote(rowId))}
                              disabled={withdrawingId === String(s._id)}
                              className="rounded-[4px] bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              {withdrawingId === String(s._id) ? 'Withdrawing…' : 'Confirm'}
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Awaiting payment
                            </span>
                            <button
                              type="button"
                              onClick={() => setWithdrawConfirmId(String(s._id))}
                              className="rounded-[4px] border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              Withdraw offer
                            </button>
                          </>
                        )}
                      </div>
                    ) : declineConfirmId === String(s._id) ? (
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-600">
                          Decline and release the hold?
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeclineConfirmId(null)}
                          disabled={decliningId === String(s._id)}
                          className="rounded-[4px] border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() => submitInlineDecline(s)}
                          disabled={decliningId === String(s._id)}
                          className="rounded-[4px] bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                          {decliningId === String(s._id) ? 'Declining…' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => acceptInlineSession(s, inlineNote(rowId))}
                          disabled={acceptingId === String(s._id)}
                          className="inline-flex items-center rounded-[4px] bg-[#234C6A] px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
                        >
                          {acceptingId === String(s._id) ? 'Accepting…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeclineConfirmId(String(s._id))}
                          disabled={acceptingId === String(s._id)}
                          className="inline-flex items-center rounded-[4px] border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                  {showNote ? (
                    <div className="mt-2.5 border-t border-amber-200/70 pt-2">
                      <DecisionNoteField
                        id={`inline-decision-note-${rowId}`}
                        value={inlineNote(rowId)}
                        onChange={next => setInlineNote(rowId, next)}
                        required={noteRequired}
                        disabled={
                          acceptingId === rowId ||
                          decliningId === rowId ||
                          withdrawingId === rowId
                        }
                        label={
                          noteRequired
                            ? 'Note to the student (required to decline)'
                            : 'Note to the student (optional)'
                        }
                      />
                      {inlineNoteErrors[rowId] ? (
                        <p className="mt-1 text-[10px] font-semibold text-rose-600">
                          {inlineNoteErrors[rowId]}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  </div>
                );
              })}
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
                      {sessionDurationLabel(s) ? ` · ${sessionDurationLabel(s)}` : ''}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Confirmed
                  </span>
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
            onViewProfile={handleViewPeerProfile}
            onJoinSession={
              expertUpcomingModal.status === 'booked'
                ? handleExpertJoinSession
                : undefined
            }
            onAcceptSeatRequest={
              expertUpcomingModal.kind === 'seminar' && expertUpcomingModal.status === 'pending'
                ? (s, note) => handleSeatDecision(s, 'accept', note)
                : undefined
            }
            onDeclineSeatRequest={
              expertUpcomingModal.kind === 'seminar' && expertUpcomingModal.status === 'pending'
                ? (s, note) => handleSeatDecision(s, 'decline', note)
                : undefined
            }
            onAcceptSession={
              expertUpcomingModal.kind === 'oneToOne' && expertUpcomingModal.status === 'pending'
                ? (s, note) => handleAcceptSession({ _id: s.id, name: s.title, with: s.with }, note)
                : undefined
            }
            onWithdrawSession={
              expertUpcomingModal.kind === 'oneToOne' && expertUpcomingModal.status === 'pending'
                ? (s, note) => handleWithdrawSession({ _id: s.id, name: s.title, with: s.with }, note)
                : undefined
            }
            onDeclineSession={
              expertUpcomingModal.kind === 'oneToOne' && expertUpcomingModal.status === 'pending'
                ? (s, note) => handleDeclineSession({ _id: s.id, name: s.title, with: s.with }, note)
                : undefined
            }
          />
        ) : null}
        <FollowersModal
          isOpen={followersOpen}
          followers={followers}
          loading={followersLoading}
          onClose={() => setFollowersOpen(false)}
          onSelect={handleSelectFollower}
        />
        {peerProfile ? (
          <ProfileModal
            isOpen={peerProfileOpen}
            onClose={handleClosePeerProfile}
            userDetails={peerProfile}
            viewerRole={userDetails?.role}
            previewImage={peerProfile?.image}
          />
        ) : null}
        {inlineDetailSession?.detail ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={e => {
              if (e.target === e.currentTarget) setInlineDetailSession(null);
            }}
          >
            <div
              className="w-full max-w-[460px] max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {inlineDetailSession.briefLabel || 'Session details'}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">
                    {inlineDetailSession.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInlineDetailSession(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="px-5 py-4">
                <SeminarDetails {...inlineDetailSession.detail} theme="light" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

