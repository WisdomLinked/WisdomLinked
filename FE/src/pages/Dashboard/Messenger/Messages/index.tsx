import React, { useState, useEffect, useRef, useMemo } from "react";
import MessagesHeader from "./Header";
import Message from "./Message";
import { useAppSelector } from "../../../../store";
import { Message as MessageType } from "../../../../actions/types";
import DateSeparator from "./DateSeparator";
import ChatSystemNotice from "./ChatSystemNotice";
import {
    WL_COMMUNITY_SYS_PREFIX,
    parseCommunityGroupRealtimeMessage,
    rewriteStaleCommunitySlugMessage,
} from "../../../../utils/communityChatMessages";
import { canonicalMembershipSide, wlRcSubtypeFromRocketType } from "../../../../utils/rcMembershipTypes";
import {doGetEventsBetweenCustomerAndExpert, profileImageFetch} from "../../../../api/api";
import { useDispatch } from "react-redux";
import { formatDateHH_MM_AMPM, isTheEventGoingOn } from "../../../../actions/common";
import MessageCalendar from "./calendar";
import CloseIcon from '@mui/icons-material/Close';
import SeminarDetails from "../../seminarDetails";
import { deleteGroupAction } from "../../../../actions/groupChatActions";
import ExpertSeminar from "../../_ExpertDashboard/seminar";
import MeetingCard from "../../../../components/MeetingCard";

// Chat API + realtime
import { getOrCreateDM, fetchDirectHistory, fetchGroupHistory, fetchGroupMemberByRcSlug, markChatRead, getRCToken, deleteChatMessage, fetchReadReceiptsBatch, fetchDmUnreadSnapshot } from "../../../../api/chatApi";
import { notifyChatMessage, stripChatHtml } from "../../../../utils/chatBrowserNotifications";
import {
    setChatChannelInfo,
    setMessages,
    addNewMessage,
    setChosenGroupChatDetails,
    replaceChatMessages,
    incrementDmUnreadRid,
    clearDmUnreadRid,
    removeChatMessage,
    setDmUnreadByRidBulk,
} from "../../../../actions/chatActions";
import { showAlert } from "../../../../actions/alertActions";
import { store } from "../../../../store";
import {
    connectToRC,
    subscribeToRoom,
    unsubscribeFromRoom,
    onNewMessage,
    isRCConnected,
    normalizeRcStreamRoomMessage,
} from "../../../../services/rcRealtime";
import { toRocketChatUsername } from "../../../../utils/rocketchatUsername";

/** RC `u.username` is email-derived; WL `userDetails.username` is display name — never equal. */
function isRcStreamFromMe(rcMsg: any, me: any): boolean {
    if (!rcMsg?.u?.username || !me?.email) return false;
    return String(rcMsg.u.username).toLowerCase() === toRocketChatUsername(me.email).toLowerCase();
}

/**
 * Outgoing = right. History from RC often has `author._id` = Rocket.Chat user id (not Mongo) when WL user lookup misses.
 * Pass `myRcUserId` from GET /chat/rc-token so those messages still count as yours.
 * For DMs, pass `dmOtherWlUserId` (chosen peer Mongo id) so we never treat their messages as yours when display names match.
 */
function isOutgoingAuthor(
    message: any,
    me: any,
    myRcUserId?: string | null,
    dmOtherWlUserId?: string | null,
    opts?: { isGroupChat?: boolean }
): boolean {
    if (!message?.author || !me) return false;
    const isGroupChat = opts?.isGroupChat === true;
    const aid = String(message.author._id ?? message.author.id ?? "");
    const otherId = dmOtherWlUserId != null && dmOtherWlUserId !== '' ? String(dmOtherWlUserId) : '';
    if (otherId && aid === otherId) return false;
    if (myRcUserId && aid === String(myRcUserId)) return true;
    const myIds = [me._id, me.id, me.userId].filter(Boolean).map((x: any) => String(x));
    if (aid && myIds.includes(aid)) return true;
    const rcSlug = me.email ? toRocketChatUsername(me.email).toLowerCase() : "";
    const aUser = String(message.author.username ?? "").toLowerCase();
    if (rcSlug && aUser === rcSlug) return true;
    // Group/community: RC uses email slug for u.username — never match WL display names (avoids wrong side).
    if (isGroupChat) return false;
    // In a 1:1 DM, infer "me" from display name only when safe.
    if (!otherId) {
        const display = String(me.username ?? "").trim().toLowerCase();
        if (display && aUser === display) return true;
    }
    return false;
}

/** Single-tick “sent” only — Rocket.Chat read receipts are often unavailable on OSS / without enterprise. */
function deliveryStatusForMessage(
    message: any,
    me: any,
    myRcUserId?: string | null,
    dmOtherWlUserId?: string | null,
    hasPeerRead?: boolean,
    opts?: { isGroupChat?: boolean }
): "sending" | "sent" | "delivered" | "seen" | undefined {
    if (!message || !isOutgoingAuthor(message, me, myRcUserId, dmOtherWlUserId, opts)) return undefined;
    const id = String(message._id ?? "");
    if (id.startsWith("temp-")) return "sending";
    if (hasPeerRead) return "seen";
    return "delivered";
}

const Messages = ({ theme = "dark" }: any) => {
    const dispatch = useDispatch()
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const prevMessagesLength = useRef(0);
    const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { chat, auth: { userDetails },  friends: { friends } } = useAppSelector((state) => state);
    const { chosenChatDetails, messages, chosenGroupChatDetails, gotAllChats, isNewMessage, conversationId, rcChannelId } = chat;

    const dmOtherWlUserId = chosenChatDetails?.userId != null ? String(chosenChatDetails.userId) : null;

    const groupAuthorOpts = useMemo(
        () => ({ isGroupChat: Boolean(chosenGroupChatDetails) }),
        [chosenGroupChatDetails],
    );

    /** Backend returns chronological (oldest first); reducer must not re-reverse. Keep sorted for polling + pagination merges. */
    const displayMessages = useMemo(() => {
        const sorted = [...messages].sort(
            (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
                String(a._id).localeCompare(String(b._id)),
        );
        const extraForSlug = [userDetails, ...(friends || [])].filter(Boolean);
        return sorted.map((m: any) => {
            if (m.type === 'wl-community-sys') return m;
            const c = String(m.content ?? '');
            if (c.startsWith(WL_COMMUNITY_SYS_PREFIX)) {
                return { ...m, content: c.slice(WL_COMMUNITY_SYS_PREFIX.length), type: 'wl-community-sys' };
            }
            let out = m;
            if (chosenGroupChatDetails?.type === 'community') {
                out = rewriteStaleCommunitySlugMessage(out, chosenGroupChatDetails, extraForSlug as any[]);
            }
            return out;
        });
    }, [messages, chosenGroupChatDetails, friends, userDetails]);

    const handleDeleteMessage = React.useCallback(
        async (messageId: string, mode: 'me' | 'both') => {
            const st = store.getState().chat;
            const rid = st.rcChannelId;
            const g = st.chosenGroupChatDetails;
            const gid = g?.groupId ?? g?._id;
            /** Only send DM conversation id when a 1:1 thread is active (never reuse group id stored here by mistake). */
            const cid = st.chosenChatDetails ? st.conversationId : null;
            const groupIdStr = gid != null && gid !== '' ? String(gid) : '';
            if (mode === 'both' && !rid) {
                dispatch(showAlert('Chat room not ready — try again.'));
                return;
            }
            if (mode === 'me' && !cid && !groupIdStr) {
                dispatch(showAlert('Chat is not ready — try again.'));
                return;
            }
            const r = await deleteChatMessage({
                mode,
                messageId,
                roomId: rid || undefined,
                conversationId: cid || undefined,
                groupChatId: groupIdStr || undefined,
            });
            if (!r?.success) {
                dispatch(showAlert((r as { error?: string })?.error || 'Could not delete message'));
                return;
            }
            if (groupIdStr) {
                const historyData = await fetchGroupHistory(groupIdStr, 0);
                dispatch(
                    replaceChatMessages(Array.isArray(historyData?.messages) ? historyData.messages : []),
                );
            } else {
                dispatch(removeChatMessage(messageId));
            }
        },
        [dispatch],
    );

    const [scrollPosition, setScrollPosition] = useState(0);
    const [isScrollToTop, set_isScrollToTop] = useState(false)
    const [isFirstLoad, set_isFirstLoad] = useState(true)

    const [events, set_events] = useState<Array<any>>([])
    const [eventsModalShow, set_eventsModalShow] = useState(false)
    const [seminarDetailsModalShow, set_seminarDetailsModalShow] = useState(false)
    const [editSeminarModalShow, set_editSeminarModalShow] = useState(false)
    const [profiles, setProfiles] = useState(new Map<string, any>()); // Map to store unique user profiles
    const [profileImages, setProfileImages] = useState(new Map<string, string>()); // Map to store profile images in Base64

    /** Rocket.Chat user id for the logged-in account — matches `author._id` on history messages when WL user lookup missed. */
    const [myRcUserId, setMyRcUserId] = useState<string | null>(null);
    const [peerReadByMessageId, setPeerReadByMessageId] = useState<Record<string, boolean>>({});
    const [peerLastSeenMs, setPeerLastSeenMs] = useState<number | null>(null);
    const lastMarkReadAtRef = useRef<number>(0);
    const receiptFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastReceiptFetchAtRef = useRef<number>(0);

    useEffect(() => {
        let alive = true;
        getRCToken().then((d) => {
            if (alive && d?.rcUserId) setMyRcUserId(String(d.rcUserId));
        });
        return () => {
            alive = false;
        };
    }, []);

    const handleDeleteCommunityChat = () => {
        if (!chosenGroupChatDetails?.groupId) return;
        if (!window.confirm("Are you sure you want to delete this community chat?")) return;
        dispatch(deleteGroupAction({
            groupChatId: chosenGroupChatDetails.groupId,
            groupChatName: chosenGroupChatDetails.groupName
        }));
        set_seminarDetailsModalShow(false);
    };

    // ── RC Realtime Connection ──────────────────────────────
    useEffect(() => {
        const initRC = async () => {
            if (!isRCConnected()) {
                await connectToRC();
            }
        };
        initRC();
    }, []);

    /** Align Redux unread map with RC (bell + header badge) when messenger mounts. */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await fetchDmUnreadSnapshot();
            if (cancelled || !res?.success) return;
            const map =
                res.unreadByRid && typeof res.unreadByRid === "object" ? res.unreadByRid : {};
            dispatch(setDmUnreadByRidBulk(map));
        })();
        return () => {
            cancelled = true;
        };
    }, [dispatch]);

    // Subscribe to RC room for live messages when chat changes
    useEffect(() => {
        if (!rcChannelId) return;
        subscribeToRoom(rcChannelId);

        const unsubMsg = onNewMessage((rawRc: any) => {
            void (async () => {
            const rcMsg = normalizeRcStreamRoomMessage(rawRc);
            // Skip echoes of our own sends (REST already appended with Mongo author._id)
            if (isRcStreamFromMe(rcMsg, userDetails)) return;
            if (rcMsg?._hidden) return;
            const t = rcMsg?.t;
            if (t === 'rm' || t === 'message_removed') return;

            const activeRid = store.getState().chat.rcChannelId;
            const msgRid = rcMsg.rid ? String(rcMsg.rid) : '';
            if (msgRid && String(activeRid || '') !== msgRid) {
                dispatch(incrementDmUnreadRid(msgRid));
            }

            const st = store.getState();
            const peerName =
                st.chat.chosenChatDetails?.username ||
                st.chat.chosenGroupChatDetails?.groupName ||
                'New message';
            const bodyText = stripChatHtml(String(rcMsg.msg || ''));
            const tabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
            const otherRoom = Boolean(msgRid && String(activeRid || '') !== msgRid);
            const skipNotifyForRcSystem = canonicalMembershipSide(String(t || '')) != null;
            const windowBlurred =
                typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus();
            const shouldNotify =
                bodyText &&
                !skipNotifyForRcSystem &&
                (tabHidden || otherRoom || windowBlurred);
            if (shouldNotify) {
                notifyChatMessage(peerName, bodyText, msgRid || 'wl-chat', {
                    allowWhenVisible: otherRoom || windowBlurred,
                });
            }

            // Convert RC message format to our format (group: map RC slug → WL user from participants)
            const stChat = store.getState().chat;
            let gDetails = stChat.chosenGroupChatDetails;
            const slugBody = String(rcMsg.msg || '').trim();
            const groupId = gDetails?.groupId ?? gDetails?._id;
            const maybeRcMembershipRow =
                canonicalMembershipSide(rcMsg?.t ?? rcMsg?.type) != null;
            let serverResolved: any = null;
            if (groupId && slugBody && maybeRcMembershipRow) {
                const r = await fetchGroupMemberByRcSlug(String(groupId), slugBody);
                if (r?.user) {
                    serverResolved = r.user;
                    if (serverResolved?._id && gDetails) {
                        const pid = String(serverResolved._id);
                        const exists = (gDetails.participants || []).some(
                            (p: any) => String(p?._id ?? p?.id) === pid,
                        );
                        if (!exists) {
                            const next = {
                                ...gDetails,
                                participants: [...(gDetails.participants || []), serverResolved],
                            };
                            dispatch(setChosenGroupChatDetails(next as any));
                            gDetails = next;
                        }
                    }
                }
            }

            const rcSlug = String(rcMsg.u?.username || '').toLowerCase();
            let author: any = {
                _id: rcMsg.u?._id || 'unknown',
                username: rcMsg.alias || rcMsg.u?.username || 'Unknown',
                image: null,
                role: 'user',
                status: 'active',
            };
            const plistForAuthor = [...(gDetails?.participants || [])];
            const admA = gDetails?.admin;
            if (admA && typeof admA === 'object' && admA._id && !plistForAuthor.some((x: any) => String(x?._id) === String(admA._id))) {
                plistForAuthor.push(admA);
            }
            if (serverResolved?._id) {
                if (!plistForAuthor.some((x: any) => String(x?._id) === String(serverResolved._id))) {
                    plistForAuthor.push(serverResolved);
                }
            }
            const matchAuthor =
                plistForAuthor.find(
                    (x: any) => x?.email && toRocketChatUsername(String(x.email)).toLowerCase() === rcSlug,
                ) || null;
            if (matchAuthor) {
                author = {
                    _id: matchAuthor._id,
                    username: matchAuthor.username,
                    image: matchAuthor.image ?? null,
                    role: matchAuthor.role ?? 'user',
                    status: matchAuthor.status ?? 'active',
                };
            } else if (serverResolved?._id && canonicalMembershipSide(rcMsg?.t ?? rcMsg?.type)) {
                /** RC bot may be `u`; attach author from resolved member for join/leave lines. */
                author = {
                    _id: serverResolved._id,
                    username: serverResolved.username,
                    image: serverResolved.image ?? null,
                    role: serverResolved.role ?? 'user',
                    status: serverResolved.status ?? 'active',
                };
            }

            const extraUsers = [userDetails, ...(friends || [])].filter(Boolean);
            const parsed = parseCommunityGroupRealtimeMessage(
                String(rcMsg.msg || ''),
                gDetails,
                rcMsg?.t ?? rcMsg?.type,
                rcMsg?.u?.username,
                extraUsers,
                serverResolved,
            );
            const wlRcSubtype = wlRcSubtypeFromRocketType(rcMsg?.t ?? rcMsg?.type);
            const newMsg = {
                _id: rcMsg._id || `rc-${Date.now()}`,
                content: parsed.content,
                author,
                createdAt: rcMsg.ts?.$date ? new Date(rcMsg.ts.$date).toISOString() : new Date().toISOString(),
                type: parsed.type,
                ...(wlRcSubtype ? { wlRcSubtype } : {}),
            };
            dispatch(addNewMessage(newMsg as any));
            })();
        });

        return () => {
            unsubMsg();
            unsubscribeFromRoom(rcChannelId);
        };
    }, [rcChannelId, userDetails, friends, dispatch]);

    // Mark RC room read with throttling (avoid RC rate-limit spam).
    useEffect(() => {
        if (!rcChannelId) return;
        const last = displayMessages[displayMessages.length - 1];
        if (!last) return;
        const incomingLast = !isOutgoingAuthor(last, userDetails, myRcUserId, dmOtherWlUserId, groupAuthorOpts);
        if (!incomingLast) return;
        if (Date.now() - lastMarkReadAtRef.current < 8000) return;
        if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = setTimeout(() => {
            markChatRead(rcChannelId);
            lastMarkReadAtRef.current = Date.now();
        }, 1200);
        return () => {
            if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        };
    }, [rcChannelId, displayMessages, userDetails, myRcUserId, dmOtherWlUserId, groupAuthorOpts]);

    // Event/dependency-driven receipt refresh (no polling interval).
    useEffect(() => {
        if (!chosenChatDetails || !rcChannelId) {
            setPeerReadByMessageId({});
            setPeerLastSeenMs(null);
            return;
        }
        const outgoingIds = displayMessages
            .filter((m: any) => isOutgoingAuthor(m, userDetails, myRcUserId, dmOtherWlUserId, groupAuthorOpts))
            .map((m: any) => String(m?._id || ''))
            .filter((id: string) => id && !id.startsWith('temp-'))
            .slice(-15);
        // Poll only messages not already seen to keep calls minimal and fast for fresh messages.
        const pendingIds = outgoingIds.filter((id) => !peerReadByMessageId[id]);
        if (pendingIds.length === 0) {
            return;
        }

        let cancelled = false;
        const fetchOnce = async () => {
            const res = await fetchReadReceiptsBatch(pendingIds, conversationId || undefined);
            if (cancelled || !res?.byMessageId) return;
            const next: Record<string, boolean> = {};
            Object.entries(res.byMessageId).forEach(([mid, data]: any) => {
                next[String(mid)] = Boolean(data?.hasPeerRead);
            });
            // Never downgrade seen state on transient API failures/rate limits.
            setPeerReadByMessageId((prev) => {
                const merged: Record<string, boolean> = { ...prev };
                Object.entries(next).forEach(([mid, seen]) => {
                    merged[mid] = Boolean(merged[mid] || seen);
                });
                return merged;
            });
            if (typeof res?.peerLastSeenMs === 'number' && !Number.isNaN(res.peerLastSeenMs)) {
                setPeerLastSeenMs((prev) =>
                    prev == null ? res.peerLastSeenMs! : Math.max(prev, res.peerLastSeenMs!),
                );
            }
            lastReceiptFetchAtRef.current = Date.now();
        };
        const now = Date.now();
        const elapsed = now - lastReceiptFetchAtRef.current;
        const delay = elapsed >= 3000 ? 250 : 3000 - elapsed;
        if (receiptFetchTimerRef.current) clearTimeout(receiptFetchTimerRef.current);
        receiptFetchTimerRef.current = setTimeout(() => {
            void fetchOnce();
        }, delay);
        return () => {
            cancelled = true;
            if (receiptFetchTimerRef.current) {
                clearTimeout(receiptFetchTimerRef.current);
                receiptFetchTimerRef.current = null;
            }
        };
    }, [chosenChatDetails, rcChannelId, conversationId, displayMessages, userDetails, myRcUserId, dmOtherWlUserId, peerReadByMessageId, groupAuthorOpts]);

    // ── Fetch History via REST ──────────────────────────────
    useEffect(() => {
        const processMessages = async () => {
            const tempProfiles = new Map<string, any>();
            const tempImages = new Map<string, string>();

            for (const message of messages) {
                const { author, author:{_id} } = message;

                if (!tempProfiles.has(_id)) {
                    tempProfiles.set(_id, author);

                    if (author.image) {
                        try {
                            const base64Image = await profileImageFetch(author.image, 'small');
                            tempImages.set(_id, base64Image as string);
                        } catch (error) {
                            console.error(`Error fetching Base64 image for userId ${_id}:`, error);
                        }
                    }
                }
            }

            setProfiles(tempProfiles);
            setProfileImages(tempImages);
        };

        processMessages();
    }, []);

    useEffect(() => {
        const processMessages = async () => {
            const tempImages = new Map<string, string>();

            for (const message of messages) {
                const userId = message.author._id;
                if (message.author.image && !tempImages.has(userId)) {
                    try {
                        const base64Image = await profileImageFetch(message.author.image, 'small');
                        tempImages.set(userId, base64Image as string);
                    } catch (error) {
                        console.error(`Error fetching Base64 image for userId ${userId}:`, error);
                    }
                }
            }

            setProfileImages(tempImages);
        };

        processMessages();
    }, [messages]);

    const sameAuthor = (message: MessageType, index: number) => {
        if (index === 0) {
            return false;
        }
        return String(message.author._id ?? '') === String(displayMessages[index - 1].author._id ?? '');
    };

    const groupSenderLabel = (message: any) => {
        const aid = String(message?.author?._id ?? message?.author?.id ?? '');
        const parts = chosenGroupChatDetails?.participants ?? [];
        const admin = chosenGroupChatDetails?.admin;
        const adminObj = admin && typeof admin === 'object' ? admin : null;
        const all: any[] = [...parts];
        if (
            adminObj?._id &&
            !all.some((x: any) => String(x?._id ?? x?.id) === String(adminObj._id))
        ) {
            all.push(adminObj);
        }
        let p = all.find((x: any) => String(x?._id ?? x?.id) === aid);
        if (!p) {
            const slug = String(message?.author?.username ?? '').toLowerCase();
            p = all.find(
                (x: any) =>
                    x?.email && toRocketChatUsername(String(x.email)).toLowerCase() === slug,
            );
        }
        const fromParticipant = String(p?.username ?? '').trim();
        const adminId = adminObj ? String(adminObj._id ?? '') : String(admin ?? '');
        const fromAdmin =
            adminId && aid === adminId ? String(adminObj?.username ?? '').trim() : '';
        const fromAuthor = String(message?.author?.username ?? '').trim();
        return fromParticipant || fromAdmin || fromAuthor || 'Member';
    };

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        const el = scrollContainerRef.current;
        if (!el) return;
        if (behavior === "smooth" && typeof el.scrollTo === "function") {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
            el.scrollTop = el.scrollHeight;
        }
        if (isFirstLoad) set_isFirstLoad(false);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
        setScrollPosition(e.currentTarget.scrollTop);
        if (e.currentTarget.scrollTop === 0 && e.currentTarget.scrollHeight !== e.currentTarget.clientHeight)
            set_isScrollToTop(true)
    };

    const getChatHistory = async () => {
        const st = store.getState().chat;
        const page = st.currentPage;
        if (st.chosenChatDetails && st.conversationId) {
            const data = await fetchDirectHistory(st.conversationId, page);
            if (data?.messages) {
                dispatch(setMessages(data.messages));
            }
        } else if (st.chosenGroupChatDetails) {
            const data = await fetchGroupHistory(st.chosenGroupChatDetails.groupId, page);
            if (data?.messages) {
                dispatch(setMessages(data.messages));
            }
        }
    }

    const setEvents = async () => {
        const expertId = userDetails?.role === 'expert' ? userDetails?._id : chosenChatDetails?.userId
        const customerId = userDetails?.role !== 'expert' ? userDetails?._id : chosenChatDetails?.userId
        if (chosenChatDetails) {
            let temp = userDetails.events.filter((x: any) => {
                if (userDetails?.role === 'expert') {
                    return x.customer._id === customerId || x.customer === customerId
                } else {
                    return x.expert._id === expertId || x.expert === expertId
                }
            })
            set_events([...temp])
        } else if (chosenGroupChatDetails) {
            let temp = userDetails.groupChats.filter((x: any) => x._id === chosenGroupChatDetails.groupId)
            set_events([...temp])
        }
    }

    useEffect(() => {
        setEvents()
        set_eventsModalShow(false)
        set_seminarDetailsModalShow(false)
        set_editSeminarModalShow(false)
    }, [chosenChatDetails, chosenGroupChatDetails])

    useEffect(() => {
        if (isScrollToTop && !gotAllChats) {
            getChatHistory()
        }
        set_isScrollToTop(false)
    }, [isScrollToTop])

    // When a new chat is selected: get/create DM conversation + fetch history (replace, never merge with another thread)
    useEffect(() => {
        let cancelled = false;
        const dmPeerId = chosenChatDetails?.userId != null ? String(chosenChatDetails.userId) : null;
        const groupId =
            chosenGroupChatDetails?.groupId != null
                ? String(chosenGroupChatDetails.groupId)
                : chosenGroupChatDetails?._id != null
                  ? String(chosenGroupChatDetails._id)
                  : null;

        const initChat = async () => {
            if (chosenChatDetails && dmPeerId) {
                const dmData = await getOrCreateDM(chosenChatDetails.userId);
                if (cancelled) return;
                const stillPeer = String(store.getState().chat.chosenChatDetails?.userId ?? '') === dmPeerId;
                if (!stillPeer || !dmData) return;
                dispatch(
                    setChatChannelInfo({
                        conversationId: dmData.conversationId,
                        rcChannelId: dmData.rcChannelId ?? null,
                    }),
                );
                if (dmData.rcChannelId) {
                    dispatch(clearDmUnreadRid(String(dmData.rcChannelId)));
                }
                const historyData = await fetchDirectHistory(dmData.conversationId, 0);
                if (cancelled) return;
                if (String(store.getState().chat.chosenChatDetails?.userId ?? '') !== dmPeerId) return;
                dispatch(replaceChatMessages(Array.isArray(historyData?.messages) ? historyData.messages : []));
                return;
            }

            if (chosenGroupChatDetails && groupId) {
                const historyData = await fetchGroupHistory(chosenGroupChatDetails.groupId, 0);
                if (cancelled) return;
                const stillGroup =
                    String(
                        store.getState().chat.chosenGroupChatDetails?.groupId ??
                            store.getState().chat.chosenGroupChatDetails?._id ??
                            '',
                    ) === groupId;
                if (!stillGroup) return;
                const rcRid = historyData?.rcChannelId || null;
                dispatch(
                    setChatChannelInfo({
                        conversationId: null,
                        rcChannelId: rcRid,
                    }),
                );
                if (rcRid) {
                    dispatch(clearDmUnreadRid(String(rcRid)));
                }
                dispatch(replaceChatMessages(Array.isArray(historyData?.messages) ? historyData.messages : []));
            }
        };

        set_isFirstLoad(true);
        initChat();
        return () => {
            cancelled = true;
        };
    }, [chosenChatDetails, chosenGroupChatDetails, dispatch]);

    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            if (!isFirstLoad && audioRef.current) {
                audioRef.current.volume = 0.005;
                audioRef.current
                    .play()
                    .then(() => console.log("Audio played successfully"))
                    .catch((err) => console.error("Error playing audio:", err));
            }
            scrollToBottom();
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    // Helper to parse meeting message content
    const parseMeetingMessage = (content: string) => {
        if (content.startsWith('__MEETING_STARTED__::')) {
            const parts = content.split('::');
            return { type: 'started', meetingThreadId: parts[1], jitsiRoomName: parts[2], starterName: parts[3] };
        }
        if (content.startsWith('__MEETING_ENDED__::')) {
            const parts = content.split('::');
            return { type: 'ended', meetingThreadId: parts[1], duration: parseInt(parts[2]) || 0, participantCount: parseInt(parts[3]) || 0 };
        }
        return null;
    };

    return (
        <div
            className={`relative flex min-h-0 w-full flex-1 flex-col ${theme === "light" ? "bg-white" : ""}`}
        >
            <audio ref={audioRef} preload="auto">
                <source
                    src="https://www.soundjay.com/buttons/sounds/button-16a.mp3"
                    type="audio/mp3"
                />
                Your browser does not support the audio element.
            </audio>
            <div className="shrink-0">
                <MessagesHeader
                    events={events}
                    scrollPosition={scrollPosition}
                    openCalendarModal={() => set_eventsModalShow(true)}
                    openSeminarModal={() => set_seminarDetailsModalShow(true)}
                    openEditSeminarModal={() => set_editSeminarModalShow(true)}
                    theme={theme}
                />
            </div>
            <div
                ref={scrollContainerRef}
                className={`flex min-h-0 w-full flex-1 flex-col items-stretch overflow-y-auto overscroll-y-contain ${theme === "light" ? "bg-white" : ""}`}
                onScroll={handleScroll}
            >
            {
                gotAllChats ?
                    <div className={`mt-[15px] text-[13px] text-center px-6 ${theme === "light" ? "text-slate-500" : "text-grey"}`}>
                        {chat.chosenChatDetails?.userId
                            ? `This is the beginning of your conversation with ${chat.chosenChatDetails?.username}`
                            : chat.chosenGroupChatDetails?.type === 'community'
                              ? 'This is the beginning of the conversation with your community.'
                              : 'This is the beginning of the conversation with your friends!'}
                    </div>
                    : null
            }
            {displayMessages.map((message: any, index) => {
                // Check if this is a meeting message
                const meetingData = parseMeetingMessage(message.content);
                if (meetingData) {
                    if (meetingData.type === 'started') {
                        return (
                            <div key={message._id + index} className="w-full px-2 sm:px-3">
                                <MeetingCard
                                    meetingThreadId={meetingData.meetingThreadId}
                                    jitsiRoomName={meetingData.jitsiRoomName}
                                    starterName={meetingData.starterName}
                                    isEnded={false}
                                    theme={theme}
                                    onJoin={(url) => window.open(url, '_blank')}
                                />
                            </div>
                        );
                    }
                    if (meetingData.type === 'ended') {
                        return (
                            <div key={message._id + index} className="w-full px-2 sm:px-3">
                                <MeetingCard
                                    meetingThreadId={meetingData.meetingThreadId}
                                    jitsiRoomName=""
                                    starterName=""
                                    isEnded={true}
                                    duration={meetingData.duration}
                                    participantCount={meetingData.participantCount}
                                    theme={theme}
                                />
                            </div>
                        );
                    }
                }

                const thisMessageDate = new Date(
                    message.createdAt
                ).toDateString();
                const prevMessageDate =
                    index > 0 &&
                    new Date(displayMessages[index - 1]?.createdAt).toDateString();

                const isSameDay =
                    index > 0 ? thisMessageDate === prevMessageDate : true;

                const thisMessageTime = formatDateHH_MM_AMPM(new Date(message.createdAt));
                const prevMessageTime = index > 0 && formatDateHH_MM_AMPM(new Date(displayMessages[index - 1]?.createdAt));
                const isSameTime = index > 0 ? thisMessageTime === prevMessageTime : false;

                if (message.type === 'wl-community-sys') {
                    return (
                        <div key={message._id + index} className="w-full px-2 sm:px-3">
                            {(!isSameDay || index === 0) && (
                                <DateSeparator date={message.createdAt} theme={theme} />
                            )}
                            <ChatSystemNotice text={message.content} theme={theme} />
                        </div>
                    );
                }

                const incomingMessage = !isOutgoingAuthor(message, userDetails, myRcUserId, dmOtherWlUserId, groupAuthorOpts);

                // Handle direct chat and group chat scenarios
                let participantImage = null;

                if (chosenChatDetails) {
                    // Direct chat
                    participantImage = chosenChatDetails.image;
                } else if (chosenGroupChatDetails) {
                    // Group chat: Find the participant in the group
                    const participant = chosenGroupChatDetails?.participants?.find(
                        (participant: any) =>
                            String(participant?._id ?? participant?.id) === String(message.author?._id ?? ''),
                    );
                    participantImage = participant?.image;
                }

                const isFriend = friends.find((x: any) => (x._id === message.author._id))
                const disableBookButton = message.author?.role === 'admin' || userDetails?.role === 'admin' || userDetails?.status === 'review' || message.author?.status === 'review'
                const showGroupSender =
                    Boolean(chosenGroupChatDetails) &&
                    incomingMessage &&
                    !sameAuthor(message, index);

                return (
                    <div key={message._id + index} className="w-full px-2 sm:px-3">
                        {(!isSameDay || index === 0) && (
                            <DateSeparator date={message.createdAt} theme={theme} />
                        )}

                        {showGroupSender ? (
                            <div
                                className={`mb-0.5 pl-1 text-[11px] font-semibold ${
                                    theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                                }`}
                            >
                                {groupSenderLabel(message)}
                            </div>
                        ) : null}

                        <Message
                            content={message.content}
                            userId={message.author._id}
                            username={message.author.username}
                            image={profileImages.get(message.author._id)}
                            role={message.author.role}
                            status={message.author.status}
                            sameAuthor={sameAuthor(message, index)}
                            date={message.createdAt}
                            incomingMessage={incomingMessage}
                            isFriend={isFriend}
                            disableBookButton={disableBookButton}
                            myRole={userDetails?.role}
                            hideDate={isSameDay && isSameTime}
                            theme={theme}
                            deliveryStatus={deliveryStatusForMessage(
                                message,
                                userDetails,
                                myRcUserId,
                                dmOtherWlUserId,
                                peerReadByMessageId[String(message._id)] === true ||
                                  (peerLastSeenMs != null &&
                                    !Number.isNaN(new Date(message.createdAt).getTime()) &&
                                    new Date(message.createdAt).getTime() <= peerLastSeenMs),
                                groupAuthorOpts,
                            )}
                            messageId={message._id}
                            roomId={rcChannelId}
                            canDelete={!incomingMessage && !String(message._id).startsWith('temp-')}
                            deleteForMeAvailable={Boolean(
                                (chosenChatDetails && conversationId) ||
                                    (chosenGroupChatDetails && (chosenGroupChatDetails.groupId || chosenGroupChatDetails._id)),
                            )}
                            onDeleteMessage={handleDeleteMessage}
                        />
                    </div>
                );
            })}
            <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
            </div>
            {
                eventsModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full z-[1000] p-4 sm:p-8 ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-white bg-opacity-10 backdrop-blur-sm"}`}>
                        <div className={`w-full h-full relative rounded-md p-6 flex flex-col ${theme === "light" ? "bg-white text-slate-900 shadow-xl" : "bg-black text-white"}`}>
                            <div className={`text-center text-2xl mb-6 font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>Events with "{chosenChatDetails?.username}"</div>
                            <button
                                className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-2 top-2 rounded-md hover:bg-grey"}
                                onClick={() => set_eventsModalShow(false)}
                            >
                                <CloseIcon />
                            </button>
                            <MessageCalendar events={events} />
                        </div>
                    </div> :
                    null
            }
            {
                seminarDetailsModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full z-[1000] p-4 sm:p-8 flex items-center justify-center ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-white bg-opacity-10 backdrop-blur-sm"}`}>
                        <div
                            className="absolute top-0 left-0 w-full h-full cursor-pointer"
                            onClick={() => set_seminarDetailsModalShow(false)}
                        />
                        <div className={`w-full max-w-[560px] rounded-2xl p-6 relative shadow-xl ${theme === "light" ? "bg-white text-slate-900" : "bg-black text-white"}`}>
                            <div className={`text-center text-2xl mb-6 font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                                {chosenGroupChatDetails?.type === "community" ? "Chat Details" : "Seminar Details"}
                            </div>
                            <button
                                className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-2 top-2 rounded-md hover:bg-grey"}
                                onClick={() => set_seminarDetailsModalShow(false)}
                            >
                                <CloseIcon />
                            </button>
                            <SeminarDetails
                                title={chosenGroupChatDetails?.groupName}
                                description={chosenGroupChatDetails?.description}
                                start={chosenGroupChatDetails?.start}
                                duration={chosenGroupChatDetails?.duration}
                                price={chosenGroupChatDetails?.price}
                                admin={chosenGroupChatDetails?.admin}
                                participants={chosenGroupChatDetails?.participants}
                                keywords={chosenGroupChatDetails?.keywords}
                                services={chosenGroupChatDetails?.services}
                                type={chosenGroupChatDetails?.type}
                                createdAt={chosenGroupChatDetails?.createdAt}
                                canDeleteCommunityChat={
                                    (() => {
                                        if (chosenGroupChatDetails?.type !== "community") return false;
                                        const adminId = typeof chosenGroupChatDetails?.admin === 'string' 
                                            ? chosenGroupChatDetails?.admin 
                                            : chosenGroupChatDetails?.admin?._id || chosenGroupChatDetails?.admin?.id;
                                        return adminId && adminId.toString() === userDetails?._id?.toString();
                                    })()
                                }
                                onDeleteCommunityChat={handleDeleteCommunityChat}
                            />
                        </div>
                    </div> :
                    null
            }
            {
                editSeminarModalShow ?
                    <div className={`absolute top-0 left-0 w-full h-full z-[1000] p-4 sm:p-8 ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-white bg-opacity-10 backdrop-blur-sm"}`}>
                        <div className={`w-full h-full relative rounded-md p-6 flex flex-col ${theme === "light" ? "bg-white text-slate-900 shadow-xl" : "bg-black text-white"}`}>
                            <div className={`text-center text-2xl mb-6 font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>Edit Seminar Details</div>
                            <button
                                className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-2 top-2 rounded-md hover:bg-grey"}
                                onClick={() => set_editSeminarModalShow(false)}
                            >
                                <CloseIcon />
                            </button>
                            <div className="w-full h-[calc(100%-60px)]">
                                <ExpertSeminar
                                    selectedSeminar={chosenGroupChatDetails}
                                />
                            </div>
                        </div>
                    </div> :
                    null
            }
        </div>
    );
};

export default Messages;
