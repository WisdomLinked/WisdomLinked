import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import IconButton from '@mui/material/IconButton';
import { MessageCircle, Users, Plus, X, CheckCircle2, MoreVertical } from 'lucide-react';
import Messenger from '../../pages/Dashboard/Messenger/Messenger';
import { useAppSelector } from '../../store';
import { onSubscriptionChanged } from '../../services/rcRealtime';
import {
  doGetMyEvents,
  getAllCommunityChats,
  profileImageFetch,
  createCommunityChat,
  joinCommunityChat,
  doFilterCustomers,
  doFilterExperts,
  joinPrivateChat,
} from '../../api/api';
import { clearDmThread, hideDmFromList, fetchDmUnreadSnapshot } from '../../api/chatApi';
import {
  setChosenChatDetails,
  setChosenGroupChatDetails,
  clearDmUnreadRid,
  resetChatAction,
} from '../../actions/chatActions';
import { showAlert } from '../../actions/alertActions';
import { updateMe } from '../../actions/authActions';
import { actionTypes } from '../../actions/types';
import { isTheEventGoingOn } from '../../actions/common';

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
  | { kind: 'studentSearchedExpert'; id: string; title: string; lastLine: string; raw: any };

const StudentChat: React.FC = () => {
  const dispatch = useDispatch();
  const {
    auth: { userDetails },
    friends: { friends, groupChatList },
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

  const currentUserId = userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [privateDmMenuOpenId, setPrivateDmMenuOpenId] = useState<string | null>(null);
  const [privateDmMenuRow, setPrivateDmMenuRow] = useState<Extract<PrivateRow, { kind: 'privateDm' }> | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOpenToAll, setNewOpenToAll] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expertCustomerSearchRows, setExpertCustomerSearchRows] = useState<PrivateRow[]>([]);
  const [studentExpertSearchRows, setStudentExpertSearchRows] = useState<PrivateRow[]>([]);

  /** 1:1 DM sidebar: Rocket.Chat-backed `Conversation` rows only (no legacy GroupChat / generalChats merge). */
  const privateDmSidebarDerived = useMemo(() => {
    if (!userDetails || (!isCustomer && !isExpert)) return [];
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
  }, [userDetails, isCustomer, isExpert, currentUserId]);

  const loadCommunityChats = React.useCallback(async () => {
    if (!userDetails?.userId) return;
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
  }, [userDetails?.userId, userDetails?.missedChats, dispatch]);

  useEffect(() => {
    loadCommunityChats();
  }, [loadCommunityChats]);

  // Hydrate DM unread/highlight state as soon as chat section opens (covers messages received while user was on another page).
  useEffect(() => {
    if (!isCustomer && !isExpert) return;
    let cancelled = false;
    (async () => {
      const res = await fetchDmUnreadSnapshot();
      if (cancelled) return;
      if (res?.success && res.unreadByRid && typeof res.unreadByRid === 'object') {
        setRcUnreadByRid(res.unreadByRid);
      } else {
        setRcUnreadByRid({});
      }
      // Also refresh directConversations list once on entry so newly-created DMs appear without click.
      dispatch(updateMe() as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, isCustomer, isExpert]);

  // Event-driven refresh: react to RC user subscription updates (includes brand-new DMs not yet opened).
  useEffect(() => {
    if (!isCustomer && !isExpert) return;
    let lastRefreshAt = 0;
    const unsub = onSubscriptionChanged(({ roomId, type, unread }) => {
      if (type && type !== 'd') return; // only direct messages
      const rid = String(roomId || '');
      if (!rid) return;
      if (typeof unread === 'number') {
        setRcUnreadByRid(prev => {
          const next = { ...prev };
          if (unread > 0) next[rid] = unread;
          else delete next[rid];
          return next;
        });
      }
      const known = privateRows.some((r) => r.kind === 'privateDm' && String(r.rcChannelId || '') === rid);
      if (known) return;
      const now = Date.now();
      if (now - lastRefreshAt < 3000) return;
      lastRefreshAt = now;
      dispatch(updateMe() as any);
    });
    return () => unsub();
  }, [dispatch, isCustomer, isExpert, privateRows]);

  useEffect(() => {
    let cancelled = false;
    const loadPrivate = async () => {
      if (isCustomer) {
        const rows: PrivateRow[] = privateDmSidebarDerived.map(p => ({
          kind: 'privateDm' as const,
          otherUserId: p.otherUserId,
          title: p.title,
          lastLine: p.lastLine,
          image: p.image ?? null,
          rcChannelId: p.rcChannelId,
          conversationId: p.conversationId,
        }));
        if (!cancelled) setPrivateRows(rows);
        return;
      }
      if (isExpert) {
        const friendRows: PrivateRow[] = await Promise.all(
          (friends || []).map(async (friend: any) => {
            let image: string | null = null;
            if (friend.image) {
              try {
                image = (await profileImageFetch(friend.image, 'small')) as string;
              } catch {
                image = null;
              }
            }
            return {
              kind: 'friend' as const,
              id: friend.id,
              title: friend.username,
              lastLine: friend.email || '',
              missedChats: friend.missedChats,
              image,
            };
          }),
        );
        const friendIds = new Set(friendRows.map(f => f.id));
        const dmRows: PrivateRow[] = privateDmSidebarDerived
          .filter(p => !friendIds.has(p.otherUserId))
          .map(p => ({
            kind: 'privateDm' as const,
            otherUserId: p.otherUserId,
            title: p.title,
            lastLine: p.lastLine,
            image: p.image ?? null,
            rcChannelId: p.rcChannelId,
            conversationId: p.conversationId,
          }));
        if (!cancelled) setPrivateRows([...friendRows, ...dmRows]);
        return;
      }
      const updated = await Promise.all(
        (friends || []).map(async (friend: any) => {
          let image: string | null = null;
          if (friend.image) {
            try {
              image = (await profileImageFetch(friend.image, 'small')) as string;
            } catch {
              image = null;
            }
          }
          return {
            kind: 'friend' as const,
            id: friend.id,
            title: friend.username,
            lastLine: friend.email || '',
            missedChats: friend.missedChats,
            image,
          };
        }),
      );
      if (!cancelled) setPrivateRows(updated);
    };
    loadPrivate();
    return () => {
      cancelled = true;
    };
  }, [isCustomer, isExpert, privateDmSidebarDerived, friends]);

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
        const res: any = await doFilterExperts({
          username: q,
          keywords: [],
          services: [],
          sortBy: 'Name in ASC',
        });
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

    if (isCustomer) {
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
        (r): r is Extract<PrivateRow, { kind: 'studentSearchedExpert' }> =>
          r.kind === 'studentSearchedExpert' && !existingIds.has(r.id),
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
  }, [privateRows, privateQuery, isExpert, isCustomer, expertCustomerSearchRows, studentExpertSearchRows]);

  const openCommunity = async (row: CommunityRow) => {
    if (isExpert) {
      try {
        const res: any = await joinCommunityChat(row._id);
        if (res?.status === 'SUCCESS') {
          dispatch(updateMe() as any);
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
  };

  const onCreateCommunity = async () => {
    if (!newName.trim()) {
      dispatch(showAlert('Community name is required'));
      return;
    }
    setCreating(true);
    try {
      const res: any = await createCommunityChat({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        isOpenToAll: newOpenToAll,
      });
      if (res?.status === 'SUCCESS') {
        dispatch(showAlert('Community created'));
        setCreateOpen(false);
        setNewName('');
        setNewDescription('');
        setNewOpenToAll(true);
        dispatch(updateMe() as any);
        await loadCommunityChats();
      } else {
        dispatch(showAlert(res?.error || 'Failed to create community'));
      }
    } finally {
      setCreating(false);
    }
  };

  const openPrivateDm = (row: Extract<PrivateRow, { kind: 'privateDm' }>) => {
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
  };

  useEffect(() => {
    const targetRid = localStorage.getItem('wl_open_dm_rid');
    if (!targetRid) return;
    const row = privateRows.find(
      (r): r is Extract<PrivateRow, { kind: 'privateDm' }> =>
        r.kind === 'privateDm' && String(r.rcChannelId || '') === String(targetRid),
    );
    if (!row) return;
    openPrivateDm(row);
    localStorage.removeItem('wl_open_dm_rid');
  }, [privateRows]);

  const closePrivateDmMenu = () => {
    setPrivateDmMenuOpenId(null);
    setPrivateDmMenuRow(null);
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

  const isCommunityActive = (id: string) =>
    String(chosenGroupChatDetails?.groupId) === String(id) ||
    String(chosenGroupChatDetails?._id) === String(id);

  const isFriendActive = (id: string) => String(chosenChatDetails?.userId) === String(id);

  return (
    <div className="flex h-full bg-wl-chatGold text-slate-900">
      <aside className="hidden md:flex md:w-80 lg:w-96 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Shared community chats
            </p>
            {isExpert ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
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
            {filteredCommunity.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-500">
                {communityQuery.trim()
                  ? 'No community chats match your search.'
                  : 'No community chats.'}
              </p>
            ) : (
              filteredCommunity.map(chat => {
                const active = isCommunityActive(chat._id);
                return (
                  <button
                    key={chat._id}
                    type="button"
                    onClick={() => void openCommunity(chat)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs mb-1 flex items-start gap-2 transition-colors ${
                      active
                        ? 'bg-[#E8EEF4] text-slate-900'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[#234C6A] text-[10px]">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[11px]">{chat.name}</p>
                        {chat.missedChats ? (
                          <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-600">
                            {chat.missedChats}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{chat.lastLine}</p>
                    </div>
                  </button>
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
                    ? 'Search friends or customers by name…'
                    : 'Search chats or experts by name…'
                }
                aria-label="Search private chats"
                className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
            {filteredPrivate.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-500">
                {privateQuery.trim()
                  ? isExpert
                    ? 'No friends or customers match your search.'
                    : 'No chats or experts match your search.'
                  : isExpert
                    ? 'Type a name to search customers, or open a friend or direct chat below.'
                    : 'No private chats yet. Type an expert’s name to find them.'}
              </p>
            ) : (
              filteredPrivate.map(row => {
                const active =
                  row.kind === 'friend'
                    ? isFriendActive(row.id)
                    : row.kind === 'expertCustomer' || row.kind === 'studentSearchedExpert'
                      ? isFriendActive(row.id)
                      : row.kind === 'privateDm'
                        ? isFriendActive(row.otherUserId)
                        : false;
                const title = row.title;
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
                  else if (row.kind === 'privateDm') openPrivateDm(row);
                };

                const inner = (
                  <>
                    <div className="mt-0.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white">
                        {initials}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[11px]">{title}</p>
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

      <section className="flex flex-1 flex-col min-h-0 min-w-0 bg-wl-chatGold">
        <Messenger videoChaton={false} theme="light" />
      </section>

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
                onClick={() => setCreateOpen(false)}
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
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
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
