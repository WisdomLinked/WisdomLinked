import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { MessageCircle, Users, Plus, X, CheckCircle2, MoreVertical, UserPlus, ArrowLeft } from 'lucide-react';
import Messenger from '../../pages/Dashboard/Messenger/Messenger';
import { useAppSelector } from '../../store';
import { onSubscriptionChanged, subscribeToRoom } from '../../services/rcRealtime';
import {
  doGetMyEvents,
  getAllCommunityChats,
  profileImageFetch,
  createCommunityChat,
  joinCommunityChat,
  doFilterCustomers,
  doFilterExperts,
  searchPrivateChatUsers,
  joinPrivateChat,
  addParticipantsToCommunityChat,
} from '../../api/api';
import { clearDmThread, hideDmFromList, fetchDmUnreadSnapshot, fetchOnlineUsers } from '../../api/chatApi';
import { setOnlineUsers } from '../../actions/friendActions';
import { setDmUnreadByRidBulk, patchDmUnreadRid } from '../../actions/chatActions';
import {
  setChosenChatDetails,
  setChosenGroupChatDetails,
  clearDmUnreadRid,
  resetChatAction,
} from '../../actions/chatActions';
import { showAlert } from '../../actions/alertActions';
import { updateMe } from '../../actions/authActions';
import { leaveGroupAction } from '../../actions/groupChatActions';
import { actionTypes } from '../../actions/types';
import { isTheEventGoingOn } from '../../actions/common';
import { resolveProfileImageSrc } from '../../utils/profileImage';
import { shouldShowMobileMessenger } from '../../utils/mobileChatLayout';
import { buildOnlineUserIdSet, hasOnlineUserId } from '../../utils/onlinePresence';
import { canAdminInitiateDmWithRole } from '../../utils/adminChatRules';

type CommunityRow = {
  raw: any;
  _id: string;
  name: string;
  missedChats?: number;
  lastLine: string;
};

type PrivateRow =
  | { kind: 'friend'; id: string; title: string; lastLine: string; missedChats?: number; image?: string | null }
  /** Student: 1:1 DM (Rocket.Chat IM), not a group channel. */
  | {
      kind: 'privateDm';
      otherUserId: string;
      title: string;
      lastLine: string;
      image?: string | null;
      /** When persisted on Conversation — used for unread badge. */
      rcChannelId?: string;
      /** Mongo Conversation id — needed for DM clear/delete actions. */
      conversationId?: string;
    }
  /** Expert: customer from directory search (not necessarily in friends yet). */
  | { kind: 'expertCustomer'; id: string; title: string; lastLine: string; raw: any }
  /** Student: expert from directory search (opens / ensures 1:1 DM). */
  | { kind: 'studentSearchedExpert'; id: string; title: string; lastLine: string; raw: any }
  /** Admin: expert from directory search (admins cannot initiate with students). */
  | { kind: 'adminSearchedExpert'; id: string; title: string; lastLine: string; raw: any };

const StudentChat: React.FC = () => {
  const dispatch = useDispatch();
  const {
    auth: { userDetails },
    friends: { friends, groupChatList, onlineUsers },
    chat: { chosenChatDetails, chosenGroupChatDetails, dmUnreadByRid },
  } = useAppSelector((s: any) => s);

  const [communityQuery, setCommunityQuery] = useState('');
  const [privateQuery, setPrivateQuery] = useState('');
  const [communityChats, setCommunityChats] = useState<CommunityRow[]>([]);
  const [privateRows, setPrivateRows] = useState<PrivateRow[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [resetCurrentEventFlag, setResetCurrentEventFlag] = useState(false);
  const [rcUnreadByRid, setRcUnreadByRid] = useState<Record<string, number>>({});

  const isCustomer =
    userDetails && String(userDetails.role || '').toLowerCase() === 'customer';
  const isExpert = userDetails && String(userDetails.role || '').toLowerCase() === 'expert';
  const isAdmin = userDetails && String(userDetails.role || '').toLowerCase() === 'admin';

  const onlineIdSet = useMemo(() => {
    return buildOnlineUserIdSet(onlineUsers);
  }, [onlineUsers]);

  const currentUserId = userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [privateDmMenuOpenId, setPrivateDmMenuOpenId] = useState<string | null>(null);
  const [communityMenuOpenId, setCommunityMenuOpenId] = useState<string | null>(null);
  const [communityMenuRow, setCommunityMenuRow] = useState<CommunityRow | null>(null);
  const [leaveCommunityConfirmOpen, setLeaveCommunityConfirmOpen] = useState(false);
  const [leaveCommunityRow, setLeaveCommunityRow] = useState<CommunityRow | null>(null);
  const [privateDmMenuRow, setPrivateDmMenuRow] = useState<Extract<PrivateRow, { kind: 'privateDm' }> | null>(null);
  const [addToCommunityOpen, setAddToCommunityOpen] = useState(false);
  const [addToCommunityTarget, setAddToCommunityTarget] = useState<Extract<PrivateRow, { kind: 'privateDm' }> | null>(null);
  const [addingToCommunityId, setAddingToCommunityId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOpenToAll, setNewOpenToAll] = useState(true);
  const [creating, setCreating] = useState(false);
  const [communityInviteQuery, setCommunityInviteQuery] = useState('');
  const [communityInviteRows, setCommunityInviteRows] = useState<PrivateRow[]>([]);
  const [communityInviteSelected, setCommunityInviteSelected] = useState<Array<{ id: string; title: string }>>([]);
  const [expertCustomerSearchRows, setExpertCustomerSearchRows] = useState<PrivateRow[]>([]);
  const [studentExpertSearchRows, setStudentExpertSearchRows] = useState<PrivateRow[]>([]);

  /** 1:1 DM sidebar: Rocket.Chat-backed `Conversation` rows only (no legacy GroupChat / generalChats merge). */
  const privateDmSidebarDerived = useMemo(() => {
    if (!userDetails || (!isCustomer && !isExpert && !isAdmin)) return [];
    const pid = (v: any) => (v == null || v === '' ? '' : String(v).trim());
    const me = pid(currentUserId);
    const seen = new Set<string>();
    const results: Array<{
      otherUserId: string;
      title: string;
      lastLine: string;
      image?: string | null;
      rcChannelId?: string;
      conversationId?: string;
    }> = [];

    const dcs = userDetails.directConversations ?? [];
    for (const conv of dcs) {
      if (!conv?.participants?.length) continue;
      const other = conv.participants.find((p: any) => pid(p?._id ?? p?.id) !== me);
      if (!other) continue;
      const otherUserId = pid(other._id ?? other.id);
      if (!otherUserId || seen.has(otherUserId)) continue;
      seen.add(otherUserId);
      const convId = conv?._id != null ? String(conv._id) : undefined;
      results.push({
        otherUserId,
        title: other.username ?? other.email ?? otherUserId,
        lastLine: 'Direct message',
        image: other.image ?? null,
        rcChannelId: conv.rcChannelId ? String(conv.rcChannelId) : undefined,
        conversationId: convId,
      });
    }

    return results;
  }, [userDetails, isCustomer, isExpert, isAdmin, currentUserId]);

  const loadCommunityChats = React.useCallback(async () => {
    const uid = userDetails?._id ?? userDetails?.id ?? userDetails?.userId;
    if (!uid) return;
    try {
      const response = await getAllCommunityChats();
      if (response === false) return;
      if (response?.status === 'SUCCESS' && response.chats) {
        const rows: CommunityRow[] = response.chats.map((chat: any) => {
          const missed = userDetails?.missedChats?.[chat._id] || 0;
          return {
            raw: chat,
            _id: chat._id,
            name: chat.name || 'Community chat',
            missedChats: missed,
            lastLine: chat.description || 'Community room',
          };
        });
        setCommunityChats(rows);
      } else if (response?.error || response?.message) {
        dispatch(showAlert(response.error || response.message));
      }
    } catch (e: any) {
      dispatch(showAlert(e?.message || 'Failed to fetch community chats'));
    }
  }, [currentUserId, userDetails?.missedChats, dispatch]);

  useEffect(() => {
    loadCommunityChats();
  }, [loadCommunityChats]);

  // Hydrate DM unread/highlight state as soon as chat section opens (covers messages received while user was on another page).
  useEffect(() => {
    if (!isCustomer && !isExpert && !isAdmin) return;
    let cancelled = false;
    (async () => {
      const res = await fetchDmUnreadSnapshot();
      if (cancelled) return;
      if (res?.success && res.unreadByRid && typeof res.unreadByRid === 'object') {
        setRcUnreadByRid(res.unreadByRid);
        dispatch(setDmUnreadByRidBulk(res.unreadByRid));
      } else {
        setRcUnreadByRid({});
        dispatch(setDmUnreadByRidBulk({}));
      }
      // Also refresh directConversations list once on entry so newly-created DMs appear without click.
      dispatch(updateMe() as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, isCustomer, isExpert, isAdmin]);

  // Online presence: keep friend/direct-chat online ids fresh for green-dot indicators.
  useEffect(() => {
    if (!isCustomer && !isExpert && !isAdmin) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pullOnlineUsers = async () => {
      const res = await fetchOnlineUsers();
      if (cancelled) return;
      if (res?.success && Array.isArray(res.onlineUsers)) {
        dispatch(setOnlineUsers(res.onlineUsers) as any);
      } else {
        // Avoid stale "online" dots when presence cannot be confirmed.
        dispatch(setOnlineUsers([]) as any);
      }
    };

    void pullOnlineUsers();
    timer = setInterval(() => {
      void pullOnlineUsers();
    }, 20000);

    const onFocus = () => {
      void pullOnlineUsers();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullOnlineUsers();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dispatch, isCustomer, isExpert, isAdmin]);

  // Event-driven refresh: react to RC user subscription updates (DMs + community channels/groups).
  useEffect(() => {
    if (!isCustomer && !isExpert && !isAdmin) return;
    let lastRefreshAt = 0;
    let communityRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onSubscriptionChanged(({ roomId, type, unread }) => {
      if (type && !['d', 'c', 'p'].includes(type)) return;
      const rid = String(roomId || '');
      if (!rid) return;
      if (typeof unread === 'number') {
        setRcUnreadByRid(prev => {
          const next = { ...prev };
          if (unread > 0) next[rid] = unread;
          else delete next[rid];
          return next;
        });
        dispatch(patchDmUnreadRid(rid, unread));
      }
      if (type === 'c' || type === 'p') {
        if (communityRefreshTimer) window.clearTimeout(communityRefreshTimer);
        /** Ensure community rid/name mapping stays hot so unread highlight appears without manual refresh. */
        communityRefreshTimer = window.setTimeout(() => {
          void loadCommunityChats();
        }, 350);
      }
      const knownDm = privateRows.some((r) => r.kind === 'privateDm' && String(r.rcChannelId || '') === rid);
      const knownCommunity = communityChats.some((c) => String(c.raw?.rcChannelId || '') === rid);
      if (knownDm || knownCommunity) return;
      const now = Date.now();
      if (now - lastRefreshAt < 3000) return;
      lastRefreshAt = now;
      dispatch(updateMe() as any);
    });
    return () => {
      unsub();
      if (communityRefreshTimer) window.clearTimeout(communityRefreshTimer);
    };
  }, [dispatch, isCustomer, isExpert, isAdmin, privateRows, communityChats, loadCommunityChats]);

  useEffect(() => {
    communityChats.forEach(c => {
      const rid = c.raw?.rcChannelId;
      if (rid) subscribeToRoom(String(rid));
    });
  }, [communityChats]);

  useEffect(() => {
    let cancelled = false;
    const resolveProfileImage = async (imageRef: unknown): Promise<string | null> => {
      return resolveProfileImageSrc(imageRef, 'small', profileImageFetch as any);
    };

    const loadPrivate = async () => {
      if (isCustomer) {
        const rows: PrivateRow[] = await Promise.all(
          privateDmSidebarDerived.map(async p => ({
            kind: 'privateDm' as const,
            otherUserId: p.otherUserId,
            title: p.title,
            lastLine: p.lastLine,
            image: await resolveProfileImage(p.image),
            rcChannelId: p.rcChannelId,
            conversationId: p.conversationId,
          })),
        );
        if (!cancelled) setPrivateRows(rows);
        return;
      }
      if (isExpert) {
        const friendRows: PrivateRow[] = await Promise.all(
          (friends || []).map(async (friend: any) => {
            return {
              kind: 'friend' as const,
              id: friend.id,
              title: friend.username,
              lastLine: friend.email || '',
              missedChats: friend.missedChats,
              image: await resolveProfileImage(friend.image),
            };
          }),
        );
        const friendIds = new Set(friendRows.map(f => f.id));
        const dmRows: PrivateRow[] = await Promise.all(
          privateDmSidebarDerived.filter(p => !friendIds.has(p.otherUserId)).map(async p => ({
            kind: 'privateDm' as const,
            otherUserId: p.otherUserId,
            title: p.title,
            lastLine: p.lastLine,
            image: await resolveProfileImage(p.image),
            rcChannelId: p.rcChannelId,
            conversationId: p.conversationId,
          })),
        );
        if (!cancelled) setPrivateRows([...friendRows, ...dmRows]);
        return;
      }
      if (isAdmin) {
        const rows: PrivateRow[] = await Promise.all(
          privateDmSidebarDerived.map(async p => ({
            kind: 'privateDm' as const,
            otherUserId: p.otherUserId,
            title: p.title,
            lastLine: p.lastLine,
            image: await resolveProfileImage(p.image),
            rcChannelId: p.rcChannelId,
            conversationId: p.conversationId,
          })),
        );
        if (!cancelled) setPrivateRows(rows);
        return;
      }
      const updated = await Promise.all(
        (friends || []).map(async (friend: any) => {
          return {
            kind: 'friend' as const,
            id: friend.id,
            title: friend.username,
            lastLine: friend.email || '',
            missedChats: friend.missedChats,
            image: await resolveProfileImage(friend.image),
          };
        }),
      );
      if (!cancelled) setPrivateRows(updated);
    };
    loadPrivate();
    return () => {
      cancelled = true;
    };
  }, [isCustomer, isExpert, isAdmin, privateDmSidebarDerived, friends]);

  useEffect(() => {
    if (!isExpert) {
      setExpertCustomerSearchRows([]);
      return;
    }
    const q = privateQuery.trim();
    if (!q) {
      setExpertCustomerSearchRows([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res: any = await searchPrivateChatUsers(q);
        if (cancelled) return;
        const list = Array.isArray(res?.result) ? res.result : [];
        const rows: PrivateRow[] = list.map((u: any) => ({
          kind: 'expertCustomer' as const,
          id: String(u._id),
          title: String(u.username || u.email || 'User'),
          lastLine: String(u.email || ''),
          raw: u,
        }));
        setExpertCustomerSearchRows(rows);
      } catch {
        if (!cancelled) setExpertCustomerSearchRows([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isExpert, privateQuery]);

  useEffect(() => {
    if (!isExpert || !createOpen || newOpenToAll) {
      setCommunityInviteRows([]);
      return;
    }
    const q = communityInviteQuery.trim();
    if (!q) {
      setCommunityInviteRows([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res: any = await doFilterCustomers({
          username: q,
          keywords: [],
          services: [],
          sortBy: 'Name in ASC',
        });
        if (cancelled) return;
        const list = Array.isArray(res?.result) ? res.result : [];
        const rows: PrivateRow[] = list.map((u: any) => ({
          kind: 'expertCustomer' as const,
          id: String(u._id),
          title: String(u.username || u.email || 'User'),
          lastLine: String(u.email || ''),
          raw: u,
        }));
        setCommunityInviteRows(rows);
      } catch {
        if (!cancelled) setCommunityInviteRows([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isExpert, createOpen, newOpenToAll, communityInviteQuery]);

  useEffect(() => {
    if (newOpenToAll) {
      setCommunityInviteSelected([]);
      setCommunityInviteQuery('');
      setCommunityInviteRows([]);
    }
  }, [newOpenToAll]);

  useEffect(() => {
    if (!isCustomer) {
      setStudentExpertSearchRows([]);
      return;
    }
    const q = privateQuery.trim();
    if (!q) {
      setStudentExpertSearchRows([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res: any = await searchPrivateChatUsers(q);
        if (cancelled) return;
        const list = Array.isArray(res?.result) ? res.result : [];
        const rows: PrivateRow[] = list.map((u: any) => ({
          kind: 'studentSearchedExpert' as const,
          id: String(u._id),
          title: String(u.username || u.email || 'Expert'),
          lastLine: String(u.email || ''),
          raw: u,
        }));
        setStudentExpertSearchRows(rows);
      } catch {
        if (!cancelled) setStudentExpertSearchRows([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isCustomer, privateQuery]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    const q = privateQuery.trim();
    if (!q) {
      setStudentExpertSearchRows([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res: any = await doFilterExperts({
          username: q,
          keywords: [],
          services: [],
          sortBy: 'Name in ASC',
        });
        if (cancelled) return;
        const list = Array.isArray(res?.result) ? res.result : [];
        const rows: PrivateRow[] = list
          .filter((u: any) => canAdminInitiateDmWithRole(u?.role ?? 'expert'))
          .map((u: any) => ({
            kind: 'adminSearchedExpert' as const,
            id: String(u._id),
            title: String(u.username || u.email || 'Expert'),
            lastLine: String(u.email || ''),
            raw: u,
          }));
        setStudentExpertSearchRows(rows);
      } catch {
        if (!cancelled) setStudentExpertSearchRows([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isAdmin, privateQuery]);

  const getEvents = async () => {
    const response = await doGetMyEvents();
    if (!response?.result) return;
    dispatch({ type: 'updateUserDetails', payload: response.result });
    const ev = response.result.events || [];
    let temp = ev.map((event: any) => ({
      ...event,
      id: event._id,
      start: new Date(event.start),
      end: new Date(event.end),
      type: 'event',
    }));
    (response.result.groupChats || []).forEach((seminar: any) => {
      temp.push({
        ...seminar,
        id: seminar._id,
        start: new Date(seminar.start),
        end: new Date(seminar.end),
        type: 'seminar',
      });
    });
    setEvents([...temp]);
  };

  useEffect(() => {
    getEvents();
  }, [friends, groupChatList]);

  useEffect(() => {
    if (!resetCurrentEventFlag) return;
    let current: any = null;
    for (let i = 0; i < events.length; i++) {
      if (isTheEventGoingOn(events[i].start, events[i].end)) {
        current = events[i];
        break;
      }
    }
    dispatch({ type: actionTypes.setCurrentEvent, payload: current });
    setResetCurrentEventFlag(false);
  }, [resetCurrentEventFlag, events, dispatch]);

  useEffect(() => {
    setResetCurrentEventFlag(true);
    const intervalId = setInterval(() => setResetCurrentEventFlag(true), 5000);
    return () => clearInterval(intervalId);
  }, [events]);

  const filteredCommunity = useMemo(() => {
    const q = communityQuery.trim().toLowerCase();
    if (!q) return communityChats;
    return communityChats.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.lastLine.toLowerCase().includes(q),
    );
  }, [communityChats, communityQuery]);

  const filteredPrivate = useMemo(() => {
    const q = privateQuery.trim().toLowerCase();

    if (isExpert) {
      const friendRows = privateRows.filter((r): r is Extract<PrivateRow, { kind: 'friend' }> => r.kind === 'friend');
      const dmRows = privateRows.filter((r): r is Extract<PrivateRow, { kind: 'privateDm' }> => r.kind === 'privateDm');
      const friendFiltered = !q
        ? friendRows
        : friendRows.filter(
            row =>
              row.title.toLowerCase().includes(q) ||
              (row.lastLine && row.lastLine.toLowerCase().includes(q)),
          );
      const dmFiltered = !q
        ? dmRows
        : dmRows.filter(
            row =>
              row.title.toLowerCase().includes(q) ||
              row.lastLine.toLowerCase().includes(q),
          );
      const friendIds = new Set(friendFiltered.map(r => r.id));
      const dmIds = new Set(dmFiltered.map(r => r.otherUserId));
      const extras = expertCustomerSearchRows.filter(
        (r): r is Extract<PrivateRow, { kind: 'expertCustomer' }> =>
          r.kind === 'expertCustomer' && !friendIds.has(r.id) && !dmIds.has(r.id),
      );
      return [...friendFiltered, ...dmFiltered, ...extras];
    }

    if (isCustomer || isAdmin) {
      const localFiltered = !q
        ? privateRows
        : privateRows.filter(row => {
            if (row.kind === 'friend') {
              return (
                row.title.toLowerCase().includes(q) ||
                (row.lastLine && row.lastLine.toLowerCase().includes(q))
              );
            }
            return row.title.toLowerCase().includes(q) || row.lastLine.toLowerCase().includes(q);
          });
      if (!q) return localFiltered;
      const existingIds = new Set(
        localFiltered.map(r => (r.kind === 'privateDm' ? r.otherUserId : r.id)),
      );
      const extras = studentExpertSearchRows.filter(
        (r): r is Extract<PrivateRow, { kind: 'studentSearchedExpert' | 'adminSearchedExpert' }> =>
          (r.kind === 'studentSearchedExpert' || r.kind === 'adminSearchedExpert') && !existingIds.has(r.id),
      );
      return [...localFiltered, ...extras];
    }

    if (!q) return privateRows;
    return privateRows.filter(row => {
      if (row.kind === 'friend') {
        return (
          row.title.toLowerCase().includes(q) ||
          (row.lastLine && row.lastLine.toLowerCase().includes(q))
        );
      }
      return row.title.toLowerCase().includes(q) || row.lastLine.toLowerCase().includes(q);
    });
  }, [privateRows, privateQuery, isExpert, isCustomer, isAdmin, expertCustomerSearchRows, studentExpertSearchRows]);

  const openCommunity = React.useCallback(
    async (row: CommunityRow) => {
      const rid = row.raw?.rcChannelId ? String(row.raw.rcChannelId) : '';
      if (rid) {
        dispatch(clearDmUnreadRid(rid));
        setRcUnreadByRid(prev => {
          const next = { ...prev };
          delete next[rid];
          return next;
        });
      }
      if (isExpert && !row.raw?.isJoined) {
        try {
          const res: any = await joinCommunityChat(row._id);
          if (res?.status === 'SUCCESS') {
            dispatch(updateMe() as any);
            await loadCommunityChats();
          } else if (res?.error) {
            dispatch(showAlert(res.error));
          }
        } catch {
          /* may already be a member */
        }
      }
      dispatch(
        setChosenGroupChatDetails({
          ...row.raw,
          groupId: row._id,
          groupName: row.name,
          name: row.name,
        } as any),
      );
      dispatch({
        type: 'updateMissedChatsOfGeneralChat',
        payload: { receiverId: row._id, count: 0 },
      });
    },
    [dispatch, isExpert, loadCommunityChats],
  );

  const onCreateCommunity = async () => {
    if (!newName.trim()) {
      dispatch(showAlert('Community name is required'));
      return;
    }
    if (!newOpenToAll && communityInviteSelected.length === 0) {
      dispatch(showAlert('Add at least one member, or turn on “Open to all users”.'));
      return;
    }
    setCreating(true);
    try {
      const res: any = await createCommunityChat({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        isOpenToAll: newOpenToAll,
        participants: !newOpenToAll ? communityInviteSelected.map(p => p.id) : undefined,
      });
      if (res?.status === 'SUCCESS') {
        dispatch(showAlert('Community created'));
        setCreateOpen(false);
        setNewName('');
        setNewDescription('');
        setNewOpenToAll(true);
        setCommunityInviteSelected([]);
        setCommunityInviteQuery('');
        setCommunityInviteRows([]);
        dispatch(updateMe() as any);
        await loadCommunityChats();
      } else {
        dispatch(showAlert(res?.error || 'Failed to create community'));
      }
    } finally {
      setCreating(false);
    }
  };

  const openPrivateDm = React.useCallback(
    (row: Extract<PrivateRow, { kind: 'privateDm' }>) => {
      if (row.rcChannelId) {
        const rid = String(row.rcChannelId);
        dispatch(clearDmUnreadRid(rid));
        setRcUnreadByRid(prev => {
          const next = { ...prev };
          delete next[rid];
          return next;
        });
      }
      dispatch(
        setChosenChatDetails({
          userId: row.otherUserId,
          username: row.title,
          image: row.image,
        }),
      );
    },
    [dispatch],
  );

  const consumeStorageChatNav = React.useCallback(() => {
    const dmRid = localStorage.getItem('wl_open_dm_rid');
    if (dmRid) {
      const row = privateRows.find(
        (r): r is Extract<PrivateRow, { kind: 'privateDm' }> =>
          r.kind === 'privateDm' && String(r.rcChannelId || '') === String(dmRid),
      );
      if (row) {
        openPrivateDm(row);
        localStorage.removeItem('wl_open_dm_rid');
      }
    }
    const comRid = localStorage.getItem('wl_open_community_rc_rid');
    if (comRid) {
      const row = communityChats.find(c => String(c.raw?.rcChannelId || '') === String(comRid));
      if (row) {
        void openCommunity(row);
        localStorage.removeItem('wl_open_community_rc_rid');
      }
    }
  }, [privateRows, communityChats, openPrivateDm, openCommunity]);

  useEffect(() => {
    consumeStorageChatNav();
  }, [consumeStorageChatNav]);

  useEffect(() => {
    const onNav = () => consumeStorageChatNav();
    window.addEventListener('wl-open-chat-nav', onNav);
    return () => window.removeEventListener('wl-open-chat-nav', onNav);
  }, [consumeStorageChatNav]);

  const closePrivateDmMenu = () => {
    setPrivateDmMenuOpenId(null);
    setPrivateDmMenuRow(null);
  };

  const closeCommunityMenu = () => {
    setCommunityMenuOpenId(null);
    setCommunityMenuRow(null);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (communityMenuOpenId) {
        const insideCommunityMenu = target.closest('[data-community-menu-root="true"]');
        if (!insideCommunityMenu) closeCommunityMenu();
      }

      if (privateDmMenuOpenId) {
        const insidePrivateMenu = target.closest('[data-private-dm-menu-root="true"]');
        if (!insidePrivateMenu) closePrivateDmMenu();
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (communityMenuOpenId) closeCommunityMenu();
      if (privateDmMenuOpenId) closePrivateDmMenu();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [communityMenuOpenId, privateDmMenuOpenId]);

  const openCommunityMenu = (e: React.MouseEvent<HTMLElement>, row: CommunityRow, menuId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCommunityMenuOpenId(menuId);
    setCommunityMenuRow(row);
  };

  const openLeaveCommunityConfirm = () => {
    const row = communityMenuRow;
    closeCommunityMenu();
    if (!row?._id) return;
    setLeaveCommunityRow(row);
    setLeaveCommunityConfirmOpen(true);
  };

  const confirmLeaveCommunity = () => {
    const row = leaveCommunityRow;
    setLeaveCommunityConfirmOpen(false);
    setLeaveCommunityRow(null);
    if (!row?._id) return;
    dispatch(leaveGroupAction({ groupChatId: String(row._id) }));
  };

  const openPrivateDmMenu = (
    e: React.MouseEvent<HTMLElement>,
    row: Extract<PrivateRow, { kind: 'privateDm' }>,
    menuId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setPrivateDmMenuOpenId(menuId);
    setPrivateDmMenuRow(row);
  };

  const deletePrivateDmFromSidebar = async () => {
    const row = privateDmMenuRow;
    closePrivateDmMenu();
    if (!row?.conversationId) {
      dispatch(showAlert('This chat cannot be removed yet. Open it once so it syncs, then try again.'));
      return;
    }
    // "Delete chat" in sidebar = clear thread for me + remove row from sidebar.
    const clearRes = await clearDmThread(row.conversationId);
    if (!clearRes?.success) {
      dispatch(showAlert((clearRes as { error?: string })?.error || 'Could not delete chat'));
      return;
    }
    const hideRes = await hideDmFromList(row.conversationId);
    if (hideRes?.success) {
      if (row.rcChannelId) dispatch(clearDmUnreadRid(String(row.rcChannelId)));
      if (chosenChatDetails?.userId && String(chosenChatDetails.userId) === String(row.otherUserId)) {
        dispatch(resetChatAction());
      }
      dispatch(updateMe() as any);
      dispatch(showAlert('Chat deleted for you'));
    } else {
      dispatch(showAlert((hideRes as { error?: string })?.error || 'Chat was cleared, but removing from list failed'));
    }
  };

  const openAddToCommunityDialog = () => {
    const row = privateDmMenuRow;
    closePrivateDmMenu();
    if (!row?.otherUserId) return;
    setAddToCommunityTarget(row);
    setAddToCommunityOpen(true);
  };

  const closeAddToCommunityDialog = () => {
    setAddToCommunityOpen(false);
    setAddToCommunityTarget(null);
    setAddingToCommunityId(null);
  };

  const isAlreadyInCommunity = (chat: CommunityRow, userId: string) => {
    const participants = chat?.raw?.participants ?? [];
    return participants.some((p: any) => String(p?._id ?? p?.id ?? p) === String(userId));
  };

  const addStudentToCommunity = async (chat: CommunityRow) => {
    const target = addToCommunityTarget;
    if (!target?.otherUserId) return;
    const communityChatId = String(chat._id);
    setAddingToCommunityId(communityChatId);
    try {
      const res: any = await addParticipantsToCommunityChat({
        communityChatId,
        participantIds: [String(target.otherUserId)],
      });
      if (res?.status === 'SUCCESS' || res?.success) {
        dispatch(showAlert(`Added ${target.title} to ${chat.name}`));
        await loadCommunityChats();
        dispatch(updateMe() as any);
        closeAddToCommunityDialog();
      } else {
        dispatch(showAlert(res?.error || res?.message || 'Could not add member to community'));
      }
    } catch (e: any) {
      dispatch(showAlert(e?.response?.data?.error || e?.message || 'Could not add member to community'));
    } finally {
      setAddingToCommunityId(null);
    }
  };

  const openFriend = (row: Extract<PrivateRow, { kind: 'friend' }>) => {
    dispatch(setChosenChatDetails({ userId: row.id, username: row.title, image: row.image }));
    dispatch({
      type: actionTypes.updateMissedChats,
      payload: { receiverId: row.id, count: 0 },
    });
  };

  const openDmWithOtherUser = async (row: { id: string; title: string; raw?: any }) => {
    const otherUserId = row.raw?._id ?? row.id;
    if (!otherUserId) return;
    try {
      const response: any = await joinPrivateChat(String(otherUserId));
      const payload = response?.data ?? response;
      const user = payload?.user ?? payload;
      const other = payload?.otherUser;
      if (user) {
        dispatch({ type: 'updateUserDetails', payload: user });
      }
      dispatch(
        setChosenChatDetails({
          userId: String(otherUserId),
          username: other?.username ?? row.raw?.username ?? row.title,
          image: other?.image ?? row.raw?.image,
        }),
      );
    } catch (e: any) {
      dispatch(showAlert(e?.message || 'Failed to start private chat'));
    }
  };

  const openExpertCustomer = async (row: Extract<PrivateRow, { kind: 'expertCustomer' }>) => {
    await openDmWithOtherUser(row);
  };

  const openStudentSearchedExpert = async (row: Extract<PrivateRow, { kind: 'studentSearchedExpert' }>) => {
    await openDmWithOtherUser(row);
  };
  const openAdminSearchedExpert = async (row: Extract<PrivateRow, { kind: 'adminSearchedExpert' }>) => {
    await openDmWithOtherUser(row);
  };

  const isCommunityActive = (id: string) =>
    String(chosenGroupChatDetails?.groupId) === String(id) ||
    String(chosenGroupChatDetails?._id) === String(id);

  const isFriendActive = (id: string) => String(chosenChatDetails?.userId) === String(id);
  const isUserOnline = (userId: string) => {
    return hasOnlineUserId(onlineIdSet, userId);
  };
  const showMobileMessenger = shouldShowMobileMessenger(chosenChatDetails, chosenGroupChatDetails);

  return (
    <div className="flex h-full bg-wl-chatGold text-slate-900">
      <aside className={`${showMobileMessenger ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-200 bg-white`}>
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Shared community chats
            </p>
            {isExpert ? (
              <button
                type="button"
                onClick={() => {
                  setNewName('');
                  setNewDescription('');
                  setNewOpenToAll(true);
                  setCommunityInviteSelected([]);
                  setCommunityInviteQuery('');
                  setCommunityInviteRows([]);
                  setCreateOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#234C6A] px-2.5 py-1 text-[10px] font-semibold text-white hover:brightness-95"
              >
                <Plus className="h-3 w-3" aria-hidden />
                New
              </button>
            ) : null}
          </div>
          <div className="mt-2 rounded-lg bg-slate-100 px-3 py-2 flex items-center gap-2 text-xs text-slate-500">
            <MessageCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
            <input
              type="text"
              value={communityQuery}
              onChange={e => setCommunityQuery(e.target.value)}
              placeholder="Search by name or last message…"
              aria-label="Search community chats by title or last message"
              className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Communities</p>
              {filteredCommunity.some(chat => {
                const crid = chat.raw?.rcChannelId ? String(chat.raw.rcChannelId) : '';
                const liveUnread = crid
                  ? Math.max(Number(dmUnreadByRid?.[crid] || 0), Number(rcUnreadByRid?.[crid] || 0))
                  : 0;
                const persistedUnread = Math.max(Number(chat.missedChats || 0), 0);
                return liveUnread > 0 || persistedUnread > 0;
              }) ? (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                  title="New community messages"
                  aria-label="New community messages"
                />
              ) : null}
            </div>
            {filteredCommunity.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-500">
                {communityQuery.trim()
                  ? 'No community chats match your search.'
                  : 'No community chats.'}
              </p>
            ) : (
              filteredCommunity.map(chat => {
                const active = isCommunityActive(chat._id);
                const crid = chat.raw?.rcChannelId ? String(chat.raw.rcChannelId) : '';
                /** Same unread source as private DM rows: Redux snapshot + live RC subscription. */
                const unreadCount = crid
                  ? Math.max(
                      Number(dmUnreadByRid?.[crid] || 0),
                      Number(rcUnreadByRid?.[crid] || 0),
                    )
                  : 0;
                const persistedUnread = Math.max(Number(chat.missedChats || 0), 0);
                const hasUnread = unreadCount > 0 || persistedUnread > 0;
                const lastLine = chat.lastLine;
                const rowTone = active
                  ? 'bg-[#E8EEF4] text-slate-900'
                  : hasUnread
                    ? 'bg-amber-50/80 text-slate-900 ring-1 ring-amber-200/80 hover:bg-amber-50'
                    : 'hover:bg-slate-100 text-slate-700';
                const menuId = String(chat._id);
                const menuOpen = communityMenuOpenId === menuId;
                const inner = (
                  <>
                    <div className="mt-0.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[#234C6A] text-[10px]">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[11px]">{chat.name}</p>
                        {hasUnread ? (
                          <span
                            className="ml-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-white"
                            title="New community messages"
                            aria-label="New community messages"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{lastLine}</p>
                    </div>
                  </>
                );
                return (
                  <div
                    key={chat._id}
                    data-community-menu-root="true"
                    className={`relative mb-1 flex w-full items-stretch overflow-visible rounded-xl text-xs transition-colors ${rowTone}`}
                  >
                    {hasUnread ? (
                      <span className="pointer-events-none absolute right-1.5 top-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void openCommunity(chat)}
                      className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left"
                    >
                      {inner}
                    </button>
                    <IconButton
                      size="small"
                      aria-label="Community chat actions"
                      className="shrink-0 self-stretch rounded-none px-1 text-slate-600"
                      onClick={e => {
                        if (menuOpen) {
                          e.preventDefault();
                          e.stopPropagation();
                          closeCommunityMenu();
                          return;
                        }
                        openCommunityMenu(e, chat, menuId);
                      }}
                    >
                      <MoreVertical className="h-4 w-4" strokeWidth={2} />
                    </IconButton>
                    {menuOpen ? (
                      <div className="absolute right-2 top-[calc(100%+4px)] z-20 min-w-[150px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="w-full rounded-md px-3 py-2 text-left text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                          onClick={() => openLeaveCommunityConfirm()}
                        >
                          Leave community
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-1 border-t border-slate-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Private chats</p>
              {(() => {
                const n = privateRows.reduce((acc, r) => {
                  if (r.kind === 'privateDm' && r.rcChannelId) {
                    const rid = String(r.rcChannelId);
                    return acc + Math.max(Number(dmUnreadByRid?.[rid] || 0), Number(rcUnreadByRid?.[rid] || 0));
                  }
                  return acc;
                }, 0);
                return n > 0 ? (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {n > 99 ? '99+' : n}
                  </span>
                ) : null;
              })()}
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-2 mb-2 flex items-center gap-2 text-xs text-slate-500">
              <MessageCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
              <input
                type="text"
                value={privateQuery}
                onChange={e => setPrivateQuery(e.target.value)}
                placeholder={
                  isExpert
                    ? 'Search chats or users by name…'
                    : 'Search chats or users by name…'
                }
                aria-label="Search private chats"
                className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
            {filteredPrivate.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-500">
                {privateQuery.trim()
                  ? isExpert
                    ? 'No chats or users match your search.'
                    : isAdmin
                      ? 'No chats or experts match your search.'
                      : 'No chats or users match your search.'
                  : isExpert
                    ? 'Type a name to search users, or open a friend or direct chat below.'
                    : isAdmin
                      ? 'No private chats yet. Type an expert name to start one.'
                      : 'No private chats yet. Type a name to find users.'}
              </p>
            ) : (
              filteredPrivate.map(row => {
                const active =
                  row.kind === 'friend'
                    ? isFriendActive(row.id)
                    : row.kind === 'expertCustomer' || row.kind === 'studentSearchedExpert' || row.kind === 'adminSearchedExpert'
                      ? isFriendActive(row.id)
                      : row.kind === 'privateDm'
                        ? isFriendActive(row.otherUserId)
                        : false;
                const title = row.title;
                const presenceUserId =
                  row.kind === 'privateDm'
                    ? row.otherUserId
                    : row.kind === 'friend' || row.kind === 'expertCustomer' || row.kind === 'studentSearchedExpert' || row.kind === 'adminSearchedExpert'
                      ? row.id
                      : '';
                const online = presenceUserId ? isUserOnline(presenceUserId) : false;
                const unreadCount =
                  row.kind === 'privateDm' && row.rcChannelId
                    ? Math.max(Number(dmUnreadByRid?.[row.rcChannelId] || 0), Number(rcUnreadByRid?.[row.rcChannelId] || 0))
                    : 0;
                const lastLine =
                  row.kind === 'privateDm' && unreadCount > 0
                    ? `${unreadCount > 99 ? '99+' : unreadCount}+ new message${unreadCount > 1 ? 's' : ''}`
                    : row.lastLine;
                const initials = title
                  .split(' ')
                  .map(w => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const rowKey =
                  row.kind === 'friend'
                    ? `f-${row.id}`
                    : row.kind === 'expertCustomer'
                      ? `c-${row.id}`
                      : row.kind === 'studentSearchedExpert'
                        ? `s-${row.id}`
                        : row.kind === 'adminSearchedExpert'
                          ? `a-${row.id}`
                        : row.kind === 'privateDm'
                          ? `dm-${row.conversationId ?? row.otherUserId}`
                          : `row`;
                const rowTone = active
                  ? 'bg-[#E8EEF4] text-slate-900'
                  : row.kind === 'privateDm' && unreadCount > 0
                    ? 'bg-amber-50/80 text-slate-900 ring-1 ring-amber-200/80 hover:bg-amber-50'
                    : 'hover:bg-slate-100 text-slate-700';

                const openRow = () => {
                  if (row.kind === 'friend') openFriend(row);
                  else if (row.kind === 'expertCustomer') void openExpertCustomer(row);
                  else if (row.kind === 'studentSearchedExpert') void openStudentSearchedExpert(row);
                  else if (row.kind === 'adminSearchedExpert') void openAdminSearchedExpert(row);
                  else if (row.kind === 'privateDm') openPrivateDm(row);
                };

                const inner = (
                  <>
                    <div className="mt-0.5">
                      <span className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[#BCD6EA] bg-[#E8EEF4] text-[10px] font-semibold text-[#234C6A]">
                        {online ? (
                          <span
                            className="absolute left-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                            aria-label="Online"
                            title="Online"
                          />
                        ) : null}
                        {row.image ? (
                          <img src={row.image} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[11px] flex items-center gap-1">
                          {title}
                        </p>
                        {row.kind === 'friend' && row.missedChats ? (
                          <span className="ml-1 shrink-0 rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-600">
                            {row.missedChats}
                          </span>
                        ) : row.kind === 'privateDm' && unreadCount > 0 ? (
                          <span className="ml-1 shrink-0 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-800">
                            {(unreadCount > 99 ? '99+' : unreadCount) + '+'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{lastLine}</p>
                    </div>
                  </>
                );

                if (row.kind === 'privateDm' && row.conversationId) {
                  const menuId = row.conversationId ?? row.otherUserId;
                  const menuOpen = privateDmMenuOpenId === menuId;
                  return (
                    <div
                      key={rowKey}
                      data-private-dm-menu-root="true"
                      className={`relative mb-1 flex w-full items-stretch overflow-visible rounded-xl text-xs transition-colors ${rowTone}`}
                    >
                      <button
                        type="button"
                        onClick={openRow}
                        className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left"
                      >
                        {inner}
                      </button>
                      <IconButton
                        size="small"
                        aria-label="Chat actions"
                        className="shrink-0 self-stretch rounded-none px-1 text-slate-600"
                        onClick={e => {
                          if (menuOpen) {
                            e.preventDefault();
                            e.stopPropagation();
                            closePrivateDmMenu();
                            return;
                          }
                          openPrivateDmMenu(e, row, menuId);
                        }}
                      >
                        <MoreVertical className="h-4 w-4" strokeWidth={2} />
                      </IconButton>
                      {menuOpen ? (
                        <div className="absolute right-2 top-[calc(100%+4px)] z-20 min-w-[150px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                          {isExpert ? (
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                              onClick={openAddToCommunityDialog}
                            >
                              Add to community
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="w-full rounded-md px-3 py-2 text-left text-[12px] font-semibold text-rose-700 hover:bg-rose-50"
                            onClick={() => void deletePrivateDmFromSidebar()}
                          >
                            Delete chat
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <button
                    key={rowKey}
                    type="button"
                    onClick={openRow}
                    className={`mb-1 flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors ${rowTone}`}
                  >
                    {inner}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <section className={`${showMobileMessenger ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 min-w-0 bg-wl-chatGold`}>
        <div className="md:hidden border-b border-slate-200 bg-white px-3 py-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-[#234C6A] hover:bg-slate-100"
            onClick={() => dispatch(resetChatAction())}
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
            Chats
          </button>
        </div>
        <Messenger videoChaton={false} theme="light" />
      </section>

      <Dialog
        open={leaveCommunityConfirmOpen}
        onClose={() => {
          setLeaveCommunityConfirmOpen(false);
          setLeaveCommunityRow(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Leave this community?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-600">
            You won’t see <strong>{leaveCommunityRow?.name ?? 'this community'}</strong> in your list anymore. Other
            members remain in the chat, and a short notice will appear in the room that you left.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setLeaveCommunityConfirmOpen(false);
              setLeaveCommunityRow(null);
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmLeaveCommunity}>
            Leave community
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={addToCommunityOpen}
        onClose={closeAddToCommunityDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add to community</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-600 mb-3">
            Add <strong>{addToCommunityTarget?.title ?? 'this user'}</strong> to one of your communities.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {communityChats.length === 0 ? (
              <p className="text-xs text-slate-500">No community chats available.</p>
            ) : (
              communityChats.map(chat => {
                const already = addToCommunityTarget?.otherUserId
                  ? isAlreadyInCommunity(chat, addToCommunityTarget.otherUserId)
                  : false;
                return (
                  <div
                    key={chat._id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{chat.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{chat.lastLine}</p>
                    </div>
                    <button
                      type="button"
                      disabled={already || addingToCommunityId === chat._id}
                      onClick={() => void addStudentToCommunity(chat)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {already ? 'Added' : addingToCommunityId === chat._id ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddToCommunityDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {createOpen && isExpert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Create community</h2>
                <p className="mt-1 text-sm text-slate-500">Create a room others can join from the list.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCommunityInviteSelected([]);
                  setCommunityInviteQuery('');
                  setCommunityInviteRows([]);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">Name</div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/60"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Resume clinic"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">Description (optional)</div>
                <textarea
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/60"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What is this community for?"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newOpenToAll}
                  onChange={e => setNewOpenToAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#234C6A] focus:ring-[#234C6A]"
                />
                Open to all users
              </label>
              {!newOpenToAll ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="mb-1 text-xs font-semibold text-slate-600">Invite members</div>
                  <p className="mb-2 text-[11px] text-slate-500">
                    Search your customers and add them to this community. At least one invite is required when the room is
                    not open to everyone.
                  </p>
                  <input
                    className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#234C6A] focus:ring-2 focus:ring-[#234C6A]/60"
                    value={communityInviteQuery}
                    onChange={e => setCommunityInviteQuery(e.target.value)}
                    placeholder="Search customers by name…"
                    aria-label="Search customers to invite"
                  />
                  {communityInviteSelected.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {communityInviteSelected.map(p => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded-full bg-[#234C6A]/10 px-2 py-0.5 text-[11px] font-medium text-[#234C6A]"
                        >
                          {p.title}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-[#234C6A]/20"
                            aria-label={`Remove ${p.title}`}
                            onClick={() =>
                              setCommunityInviteSelected(prev => prev.filter(x => x.id !== p.id))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    {communityInviteRows.length > 0 ? (
                      communityInviteRows.map(r => {
                        if (r.kind !== 'expertCustomer') return null;
                        const selected = communityInviteSelected.some(x => x.id === r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={selected}
                            onClick={() =>
                              setCommunityInviteSelected(prev =>
                                prev.some(x => x.id === r.id)
                                  ? prev
                                  : [...prev, { id: r.id, title: r.title }],
                              )
                            }
                            className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <span className="truncate font-medium text-slate-800">{r.title}</span>
                            <span className="shrink-0 text-[10px] text-slate-500">{r.lastLine}</span>
                          </button>
                        );
                      })
                    ) : communityInviteQuery.trim() ? (
                      <p className="px-3 py-3 text-[11px] text-slate-500">No matches.</p>
                    ) : (
                      <p className="px-3 py-3 text-[11px] text-slate-500">Type a name to search your customers.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCommunityInviteSelected([]);
                  setCommunityInviteQuery('');
                  setCommunityInviteRows([]);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => void onCreateCommunity()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#234C6A] px-3 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default StudentChat;
