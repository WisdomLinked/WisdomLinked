import { Request, Response } from 'express';
import { 
    getOrCreateDMChannel, 
    getOrCreateGroupChannel, 
    sendMessageToRC, 
    getRCIMHistory,
    getRCGroupHistory,
    generateUserToken, 
    toRocketChatUsername,
    RC_URL,
    markRoomReadAsUser,
    syncRocketGroupChannelMembers,
    getRoomLastSeenAsUser,
    getChatUnreadSnapshotAsUser,
    ensureBothWlUsersSyncedToRocketChat,
    deleteMessageAsUser,
    cleanRoomHistoryAsUser,
    purgeRoomMessagesBestEffort,
    getRocketOnlineUsernames,
} from '../services/rocketchat.service';
import { wlDisplayName } from '../utils/wlDisplayName';

const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');
const MeetingThread = require('../models/MeetingThread');
const { sendExpertResumeFormatReminderEmail } = require('../services/notifications');

/** RC REST may return `ts` as ISO string or `{ $date: n }` — normalize for the React app. */
const normalizeRcMessageTs = (ts: any): string => {
    if (ts == null) return new Date().toISOString();
    if (typeof ts === 'string') return ts;
    if (typeof ts === 'object' && ts.$date != null) {
        const n = ts.$date;
        return new Date(typeof n === 'number' ? n : n).toISOString();
    }
    if (ts instanceof Date) return ts.toISOString();
    try {
        return new Date(ts).toISOString();
    } catch {
        return new Date().toISOString();
    }
};

const wlAuthorFromUser = (u: any) => ({
    _id: u._id,
    username: wlDisplayName(u),
    image: u.image,
    role: u.role,
    status: u.status,
});

const toDateMillis = (ts: any): number => new Date(normalizeRcMessageTs(ts)).getTime();

const WL_COMMUNITY_SYS_PREFIX = '__WL_COMMUNITY_SYS__::';
const CHAT_HISTORY_PAGE_SIZE = 50;
const CHAT_HISTORY_MAX_PAGE_SIZE = 100;

export const filterOnlineUserIdsByAllowedSet = (users: any[], allowedIds: Set<string>) =>
    (users || [])
        .map((u: any) => String(u?._id || ''))
        .filter((id: string) => !!id && allowedIds.has(id))
        .map((id: string) => ({ userId: id }));

/** RC uses `t` on messages; some payloads also expose `type`. */
const normalizeRcMsgSubtype = (t: any): string => String(t ?? '').trim().toLowerCase() || 'message';

/** Aligns varied Rocket.Chat system codes (`au`, `ru`, …) with join vs leave (see MessageTypes.ts). */
const canonicalMembershipSide = (t: any): 'join' | 'leave' | null => {
    const x = normalizeRcMsgSubtype(t);
    if (!x || x === 'message') return null;
    const join = new Set([
        'uj',
        'ujt',
        'au',
        'ui',
        'ut',
        'added-user-to-team',
        'user-added-room-to-team',
    ]);
    const leave = new Set([
        'ul',
        'ult',
        'ru',
        'removed-user-from-team',
        'user-removed-room-from-team',
        'user-deleted-room-from-team',
    ]);
    if (join.has(x)) return 'join';
    if (leave.has(x)) return 'leave';
    return null;
};

const hiddenStateForUser = (doc: any, userId: string) => {
    const list = Array.isArray(doc?.hiddenForParticipants) ? doc.hiddenForParticipants : [];
    const entry = list.find((x: any) => String(x?.userId) === String(userId));
    return {
        hiddenIds: new Set<string>(Array.isArray(entry?.messageIds) ? entry.messageIds.map((x: any) => String(x)) : []),
        clearedAtMs: entry?.clearedAt ? new Date(entry.clearedAt).getTime() : null as number | null,
    };
};

// Helper to map Rocket.Chat messages to WisdomLinked format so the frontend React UI doesnt break
/** For DMs, pass `dmParticipants` so RC login slugs always resolve to Mongo `author._id` (fixes expert vs student mismatch). */
/** For group/community, pass `groupParticipants` (populated users with email) so RC slugs map to display names. */
const mapRCMessagesToWL = async (
    rcMessages: any[],
    dmParticipants?: { me?: any; other?: any },
    groupParticipants?: any[]
) => {
    const rcSystemSlugs = rcMessages
        .filter((m: any) => canonicalMembershipSide(m.t ?? m.type) != null)
        .flatMap((m: any) => {
            const raw = String(m.msg ?? '').trim();
            if (raw && !raw.includes(' ') && raw.length < 120) return [raw];
            return [];
        });

    const usernames = [
        ...new Set(
            [
                ...rcMessages.flatMap((m: any) => [m.u?.username, m.alias].filter(Boolean)),
                ...rcSystemSlugs,
            ].filter(Boolean),
        ),
    ];

    let users = usernames.length
        ? await User.find({
              $or: [{ username: { $in: usernames } }, { rocketChatUsername: { $in: usernames } }],
          }).select('_id username rocketChatUsername image role status email')
        : [];

    const mergeUsersIntoMap = (list: any[], target: Record<string, any>) => {
        list.forEach((user: any) => {
            if (user.username) target[user.username] = user;
            if (user.rocketChatUsername) target[user.rocketChatUsername] = user;
            if (user.email) {
                const slug = toRocketChatUsername(String(user.email));
                target[slug] = wlAuthorFromUser(user);
                target[slug.toLowerCase()] = wlAuthorFromUser(user);
            }
        });
    };

    const userMap: Record<string, any> = {};
    mergeUsersIntoMap(users, userMap);

    const knownSlugKeys = new Set(
        users.flatMap((u: any) => {
            const out: string[] = [];
            if (u.rocketChatUsername) out.push(String(u.rocketChatUsername).toLowerCase());
            if (u.email) out.push(toRocketChatUsername(String(u.email)).toLowerCase());
            return out;
        }),
    );
    const missingSlugsForLookup = [...new Set(rcSystemSlugs)].filter(
        (s) => s && !knownSlugKeys.has(String(s).toLowerCase()),
    );
    if (missingSlugsForLookup.length) {
        const more = await User.find({ rocketChatUsername: { $in: missingSlugsForLookup } })
            .select('_id username rocketChatUsername image role status email')
            .lean();
        users = [...users, ...more];
        mergeUsersIntoMap(more, userMap);
    }

    if (dmParticipants?.me?.email) {
        userMap[toRocketChatUsername(dmParticipants.me.email)] = wlAuthorFromUser(dmParticipants.me);
    }
    if (dmParticipants?.other?.email) {
        userMap[toRocketChatUsername(dmParticipants.other.email)] = wlAuthorFromUser(dmParticipants.other);
    }

    const parts = Array.isArray(groupParticipants) ? groupParticipants : [];
    parts.forEach((u: any) => {
        if (!u || !u.email) return;
        const wl = wlAuthorFromUser(u);
        const slug = toRocketChatUsername(String(u.email));
        userMap[slug] = wl;
        userMap[slug.toLowerCase()] = wl;
        if (u.rocketChatUsername) userMap[String(u.rocketChatUsername)] = wl;
    });

    const resolveSlugToSubject = (slugRaw: string | undefined | null): any => {
        const s = String(slugRaw ?? '').trim();
        if (!s || s.includes(' ') || s.length >= 120) return null;
        const lower = s.toLowerCase();
        for (const u of parts) {
            if (u?.email && toRocketChatUsername(String(u.email)).toLowerCase() === lower) {
                return u;
            }
        }
        const direct = userMap[s] || userMap[lower];
        if (direct) return direct;
        const key = Object.keys(userMap).find((k) => k.toLowerCase() === lower);
        return key ? userMap[key] : null;
    };

    const labelFromSubject = (subj: any): string => wlDisplayName(subj);

    return rcMessages.map(m => {
        const rcLogin = m.u?.username;
        const displayName = m.alias || rcLogin || 'Unknown';
        const author =
            (rcLogin && userMap[rcLogin]) ||
            (m.alias && userMap[m.alias]) ||
            ({
                _id: m.u?._id || 'unknown',
                username: displayName,
                image: null,
                role: 'user',
                status: 'active',
            } as any);

        const rcMetaType = normalizeRcMsgSubtype(m.t ?? m.type);
        const membershipSide = canonicalMembershipSide(m.t ?? m.type);
        let content = m.msg;
        let msgType = rcMetaType;
        if (typeof content === 'string' && content.startsWith(WL_COMMUNITY_SYS_PREFIX)) {
            content = content.slice(WL_COMMUNITY_SYS_PREFIX.length);
            msgType = 'wl-community-sys';
        } else if (groupParticipants != null && dmParticipants == null) {
            /** Community / group RC: join vs leave uses `t` (`uj`/`ul`/`au`/`ru`, …); `msg` is often the RC email-slug. */
            const raw = String(content ?? '').trim();
            let subj = resolveSlugToSubject(raw);
            if (!subj && rcLogin) subj = resolveSlugToSubject(String(rcLogin));
            const label = labelFromSubject(subj);
            if (subj && membershipSide === 'join') {
                content = `${label} has joined the community.`;
                msgType = 'wl-community-sys';
            } else if (subj && membershipSide === 'leave') {
                content = `${label} has left the community.`;
                msgType = 'wl-community-sys';
            }
        }

        if (msgType !== 'wl-community-sys' && membershipSide != null) {
            msgType = 'message';
        }

        const wlRcSubtype =
            groupParticipants != null && dmParticipants == null && membershipSide != null
                ? membershipSide === 'join'
                    ? 'uj'
                    : 'ul'
                : undefined;

        return {
            _id: m._id,
            content,
            author,
            createdAt: normalizeRcMessageTs(m.ts),
            type: msgType,
            ...(wlRcSubtype ? { wlRcSubtype } : {}),
        };
    });
};


// ── DM Endpoints ────────────────────────────────────────────

export const getOrCreateDM = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { otherUserId } = req.body;

        if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

        // Maintain the Conversation wrapper in our DB so we remember that two people have talked
        let conversation = await Conversation.findOne({
            $and: [
                { participants: userId },
                { participants: otherUserId },
                { participants: { $size: 2 } },
            ],
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [userId, otherUserId],
                messages: []
            });
            await conversation.save();
        }

        await User.updateOne({ _id: userId }, { $addToSet: { directConversations: conversation._id } });
        await User.updateOne({ _id: otherUserId }, { $addToSet: { directConversations: conversation._id } });

        // Ensure a RC DM channel exists
        const me = await User.findById(userId);
        const other = await User.findById(otherUserId);
        let rcChannelId = null;
        if (me && other && me.email && other.email) {
            if (String(process.env.RC_DEBUG_TRACE || '').toLowerCase() === 'true') {
                console.log('[RC_DEBUG_TRACE] chat.getOrCreateDM:pair', {
                    meEmail: me.email,
                    meRcUsername: toRocketChatUsername(me.email),
                    otherEmail: other.email,
                    otherRcUsername: toRocketChatUsername(other.email),
                });
            }
            await ensureBothWlUsersSyncedToRocketChat(me, other);
            rcChannelId = await getOrCreateDMChannel(
                toRocketChatUsername(me.email),
                toRocketChatUsername(other.email)
            );
            if (rcChannelId) {
                await Conversation.updateOne({ _id: conversation._id }, { $set: { rcChannelId } }).exec();
            }
        }

        return res.status(200).json({
            conversationId: conversation._id,
            rcChannelId,
        });
    } catch (err: any) {
        console.error('[chat.getOrCreateDM]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const sendMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId, content } = req.body;

        if (!conversationId || !content) {
            return res.status(400).json({ error: 'conversationId and content are required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        if (!conversation.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant of this conversation' });
        }

        const me = await User.findById(userId);
        const otherUserId = conversation.participants.find((p: any) => p.toString() !== userId);
        const other = await User.findById(otherUserId);

        // If either side previously hid this DM, a new message should bring it back.
        await User.updateOne({ _id: userId }, { $addToSet: { directConversations: conversation._id } }).exec();
        if (otherUserId) {
            await User.updateOne({ _id: otherUserId }, { $addToSet: { directConversations: conversation._id } }).exec();
        }

        // Real RC `_id` enables `chat.getMessageReadReceipts` on the client; fallback if send fails.
        let sentId = `temp-${Date.now()}`;
        if (me && other && me.email && other.email) {
            if (String(process.env.RC_DEBUG_TRACE || '').toLowerCase() === 'true') {
                console.log('[RC_DEBUG_TRACE] chat.sendMessage:pair', {
                    meEmail: me.email,
                    meRcUsername: toRocketChatUsername(me.email),
                    otherEmail: other.email,
                    otherRcUsername: toRocketChatUsername(other.email),
                    conversationId: String(conversation._id),
                });
            }
            await ensureBothWlUsersSyncedToRocketChat(me, other);
            const rcChannelId = await getOrCreateDMChannel(
                toRocketChatUsername(me.email),
                toRocketChatUsername(other.email)
            );
            if (rcChannelId) {
                if (String(process.env.RC_DEBUG_TRACE || '').toLowerCase() === 'true') {
                    console.log('[RC_DEBUG_TRACE] chat.sendMessage:rid', {
                        conversationId: String(conversation._id),
                        rcChannelId,
                    });
                }
                // EXCLUSIVELY send to RC. We no longer save to our MongoDB Message model!
                const rid = await sendMessageToRC(rcChannelId, content, wlDisplayName(me), me.email);
                if (rid) sentId = rid;
            }
        }

        // Build a fake message object just to satisfy the frontend's optimistic update
        const populatedMessage = {
            _id: sentId,
            content,
            author: { _id: me._id, username: me.username, image: me.image, role: me.role, status: me.status },
            createdAt: new Date().toISOString(),
            type: 'direct',
        };

        return res.status(200).json({
            message: populatedMessage,
        });
    } catch (err: any) {
        console.error('[chat.sendMessage]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const getDirectHistory = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId } = req.params;
        const page = Math.max(parseInt(req.query.page as string) || 0, 0);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit as string) || CHAT_HISTORY_PAGE_SIZE, 1),
            CHAT_HISTORY_MAX_PAGE_SIZE,
        );

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        if (!conversation.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant' });
        }

        const me = await User.findById(userId);
        const otherUserId = conversation.participants.find((p: any) => p.toString() !== userId);
        const other = await User.findById(otherUserId);

        if (me && other && me.email && other.email) {
            await ensureBothWlUsersSyncedToRocketChat(me, other);
            const rcChannelId = await getOrCreateDMChannel(
                toRocketChatUsername(me.email),
                toRocketChatUsername(other.email)
            );
            if (rcChannelId) {
                // Fetch as the logged-in participant — admin cannot read arbitrary users' IM rooms
                const rcMessages = await getRCIMHistory(rcChannelId, limit, page * limit, {
                    email: me.email,
                    username: me.username,
                    name: me.username,
                });
                if (!rcMessages?.length && page === 0) {
                    console.warn(
                        '[chat.getDirectHistory] Rocket.Chat returned 0 DM messages for this WL user. ' +
                            'Messages can still appear in chat.wisdomlinked.com if they were sent via admin fallback, ' +
                            'but im.history requires a valid RC session for THIS user (RC user + CREATE_TOKENS secret). ' +
                            `email=${me.email} room=${rcChannelId}`
                    );
                }
                const sorted = [...rcMessages].sort(
                    (a, b) =>
                        new Date(normalizeRcMessageTs(a.ts)).getTime() -
                        new Date(normalizeRcMessageTs(b.ts)).getTime()
                );
                const { hiddenIds, clearedAtMs } = hiddenStateForUser(conversation, String(userId));
                const visible = sorted.filter((m: any) => {
                    const mid = String(m?._id ?? '');
                    if (mid && hiddenIds.has(mid)) return false;
                    if (clearedAtMs != null && toDateMillis(m?.ts) <= clearedAtMs) return false;
                    return true;
                });
                const messages = await mapRCMessagesToWL(visible, { me, other });
                return res.status(200).json({ messages });
            }
        }

        return res.status(200).json({ messages: [] });
    } catch (err: any) {
        console.error('[chat.getDirectHistory]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** GET /api/chat/dm/call-history/:conversationId?limit=30 */
export const getDirectCallHistory = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId } = req.params;
        const limit = Math.min(
            Math.max(parseInt(req.query.limit as string) || 30, 1),
            200,
        );

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        if (!conversation.participants.some((p: any) => p.toString() === String(userId))) {
            return res.status(403).json({ error: 'You are not a participant' });
        }

        const rows = await MeetingThread.find({ conversationId })
            .sort({ startedAt: -1 })
            .limit(limit)
            .populate('startedBy', 'username image role status');

        const history = rows.map((m: any) => ({
            _id: m._id,
            startedAt: m.startedAt,
            endedAt: m.endedAt || null,
            duration: Number(m.duration || 0),
            status: m.status,
            startedBy: m.startedBy
                ? {
                      _id: m.startedBy._id,
                      username: m.startedBy.username,
                      image: m.startedBy.image,
                      role: m.startedBy.role,
                      status: m.startedBy.status,
                  }
                : null,
        }));

        return res.status(200).json({ history });
    } catch (err: any) {
        console.error('[chat.getDirectCallHistory]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** GET /api/chat/online-users */
export const getOnlineUsers = async (req: any, res: Response) => {
    try {
        const { userId } = req.user || {};
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized', onlineUsers: [] });
        }

        const me = await User.findById(userId)
            .select('_id friends directConversations generalChats groupChats')
            .populate({
                path: 'directConversations',
                select: 'participants',
                populate: { path: 'participants', select: '_id' },
            })
            .populate({
                path: 'generalChats',
                select: 'participants admin',
                populate: [
                    { path: 'participants', select: '_id' },
                    { path: 'admin', select: '_id' },
                ],
            })
            .populate({
                path: 'groupChats',
                select: 'participants admin',
                populate: [
                    { path: 'participants', select: '_id' },
                    { path: 'admin', select: '_id' },
                ],
            });

        if (!me) {
            return res.status(404).json({ success: false, error: 'User not found', onlineUsers: [] });
        }

        const allowedIds = new Set<string>();
        const pushId = (v: any) => {
            const s = String(v?._id ?? v?.id ?? v ?? '').trim();
            if (s) allowedIds.add(s);
        };
        pushId(me._id);
        (me.friends || []).forEach((f: any) => pushId(f));
        (me.directConversations || []).forEach((conv: any) => {
            (conv?.participants || []).forEach((p: any) => pushId(p));
        });
        (me.generalChats || []).forEach((chat: any) => {
            (chat?.participants || []).forEach((p: any) => pushId(p));
            pushId(chat?.admin);
        });
        (me.groupChats || []).forEach((chat: any) => {
            (chat?.participants || []).forEach((p: any) => pushId(p));
            pushId(chat?.admin);
        });

        const rcOnlineUsernames = await getRocketOnlineUsernames();
        if (!rcOnlineUsernames.length) {
            return res.status(200).json({ success: true, onlineUsers: [] });
        }

        const users = await User.find({
            $or: [
                { rocketChatUsername: { $in: rcOnlineUsernames } },
                { username: { $in: rcOnlineUsernames } },
            ],
        }).select('_id');

        const onlineUsers = filterOnlineUserIdsByAllowedSet(users, allowedIds);

        return res.status(200).json({ success: true, onlineUsers });
    } catch (err: any) {
        console.error('[chat.getOnlineUsers]', err.message);
        return res.status(500).json({ success: false, error: err.message, onlineUsers: [] });
    }
};

// ── Group Chat Endpoints ────────────────────────────────────

export const sendGroupMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { groupChatId, content } = req.body;

        if (!groupChatId || !content) {
            return res.status(400).json({ error: 'groupChatId and content are required' });
        }

        const groupChat = await GroupChat.findById(groupChatId)
            .populate('participants', 'email')
            .populate('admin', 'email');
        if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });

        if (!groupChat.participants.some((p: any) => String(p?._id ?? p) === String(userId))) {
            return res.status(403).json({ error: 'You are not a participant of this group' });
        }

        const me = await User.findById(userId);
        let sentId = `temp-${Date.now()}`;
        if (me && me.email) {
            const emails: string[] = [];
            for (const p of groupChat.participants as any[]) {
                if (p?.email) emails.push(String(p.email).toLowerCase());
            }
            const adm = groupChat.admin as any;
            if (adm?.email) emails.push(String(adm.email).toLowerCase());
            const rcChannelId = await syncRocketGroupChannelMembers(String(groupChatId), emails);
            if (rcChannelId) {
                const rid = await sendMessageToRC(rcChannelId, content, wlDisplayName(me), me.email);
                if (rid) sentId = rid;
            }
        }

        if (String((groupChat as any).type) === 'community') {
            const activityAt = new Date();
            await GroupChat.updateOne({ _id: groupChat._id }, { $set: { lastMessageAt: activityAt } }).exec();
        }

        const populatedMessage = {
            _id: sentId,
            content,
            author: {
                _id: me!._id,
                username: wlDisplayName(me!),
                image: me!.image,
                role: me!.role,
                status: me!.status,
            },
            createdAt: new Date().toISOString(),
            type: 'group',
        };

        return res.status(200).json({
            message: populatedMessage,
        });
    } catch (err: any) {
        console.error('[chat.sendGroupMessage]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

export const getGroupHistory = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.params;
        const page = Math.max(parseInt(req.query.page as string) || 0, 0);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit as string) || CHAT_HISTORY_PAGE_SIZE, 1),
            CHAT_HISTORY_MAX_PAGE_SIZE,
        );

        const groupChat = await GroupChat.findById(groupChatId)
            .populate('participants', 'email username rocketChatUsername image role status')
            .populate('admin', 'email username rocketChatUsername image role status');
        if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });

        if (!groupChat.participants.some((p: any) => String(p?._id ?? p) === String(userId))) {
            return res.status(403).json({ error: 'You are not a participant' });
        }

        const me = await User.findById(userId);
        if (me && me.email) {
            const emails: string[] = [];
            for (const p of groupChat.participants as any[]) {
                if (p?.email) emails.push(String(p.email).toLowerCase());
            }
            const adm = groupChat.admin as any;
            if (adm?.email) emails.push(String(adm.email).toLowerCase());
            const rcChannelId = await syncRocketGroupChannelMembers(String(groupChatId), emails);
            if (rcChannelId) {
                await GroupChat.updateOne(
                    { _id: groupChat._id },
                    { $set: { rcChannelId } },
                    { timestamps: false },
                ).exec();
                const rcMessages = await getRCGroupHistory(rcChannelId, limit, page * limit, {
                    email: me.email,
                    username: me.username,
                    name: me.username,
                });
                const sorted = [...rcMessages].sort(
                    (a, b) =>
                        new Date(normalizeRcMessageTs(a.ts)).getTime() -
                        new Date(normalizeRcMessageTs(b.ts)).getTime()
                );
                const { hiddenIds, clearedAtMs } = hiddenStateForUser(groupChat, String(userId));
                const visible = sorted.filter((m: any) => {
                    const mid = String(m?._id ?? '');
                    if (mid && hiddenIds.has(mid)) return false;
                    if (clearedAtMs != null && toDateMillis(m?.ts) <= clearedAtMs) return false;
                    return true;
                });
                const parts = [...(groupChat.participants as any[])];
                const adminDoc = groupChat.admin as any;
                if (
                    adminDoc &&
                    adminDoc._id &&
                    !parts.some((p: any) => String(p?._id ?? p) === String(adminDoc._id))
                ) {
                    parts.push(adminDoc);
                }
                const messages = await mapRCMessagesToWL(visible, undefined, parts);

                if (String((groupChat as any).type) === 'community' && visible.length > 0) {
                    let maxMs = 0;
                    for (const m of visible) {
                        const ms = new Date(normalizeRcMessageTs((m as any).ts)).getTime();
                        if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
                    }
                    if (maxMs > 0) {
                        await GroupChat.updateOne(
                            { _id: groupChat._id },
                            { $max: { lastMessageAt: new Date(maxMs) } },
                            { timestamps: false },
                        ).exec();
                    }
                }

                return res.status(200).json({
                    messages,
                    rcChannelId,
                });
            }
        }

        return res.status(200).json({ messages: [], rcChannelId: null });
    } catch (err: any) {
        console.error('[chat.getGroupHistory]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** POST body: { messageIds: string[] } — Rocket.Chat message ids (max 50). Returns RC read receipts per id. */
export const getReadReceiptsBatch = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const messageIds = req.body?.messageIds;
        const conversationId = req.body?.conversationId ? String(req.body.conversationId) : null;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ error: 'messageIds must be a non-empty array (max 15)' });
        }
        const ids = messageIds
            .slice(0, 15)
            .map((x: any) => String(x ?? '').trim())
            .filter(Boolean);
        const me = await User.findById(userId);
        if (!me?.email) return res.status(400).json({ error: 'User not found' });
        const reader = { email: me.email, username: me.username, name: me.username };
        const tok = await generateUserToken(reader);
        const myRcUserId = tok?.userId || '';
        let peerLastSeenMs: number | null = null;
        if (conversationId) {
            const conv = await Conversation.findById(conversationId);
            if (conv?.participants?.some((p: any) => String(p) === String(userId))) {
                let rid = String((conv as any).rcChannelId || '');
                const otherUserId = conv.participants.find((p: any) => String(p) !== String(userId));
                const other = otherUserId ? await User.findById(otherUserId) : null;
                if (!rid && other?.email) {
                    rid =
                        (await getOrCreateDMChannel(
                            toRocketChatUsername(me.email),
                            toRocketChatUsername(other.email),
                        )) || '';
                    if (rid) {
                        await Conversation.updateOne({ _id: conv._id }, { $set: { rcChannelId: rid } }).exec();
                    }
                }
                if (rid && other?.email) {
                    peerLastSeenMs = await getRoomLastSeenAsUser(rid, {
                        email: other.email,
                        username: other.username,
                        name: other.username,
                    });
                }
            }
        }
        // We intentionally avoid per-message RC receipt calls here to prevent rate-limit storms.
        // Frontend derives `seen` by comparing message.createdAt with peerLastSeenMs.
        const byMessageId: Record<string, { hasPeerRead: boolean; receipts: any[] }> = {};
        for (const mid of ids) byMessageId[mid] = { hasPeerRead: false, receipts: [] };
        return res.status(200).json({ success: true, myRcUserId, byMessageId, peerLastSeenMs });
    } catch (err: any) {
        console.error('[chat.getReadReceiptsBatch]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST body:
 * - mode='both': { roomId, messageId } -> delete message in RC for everyone (subject to RC permissions).
 * - mode='me':   { conversationId, messageId } OR { groupChatId, messageId } -> hide only for current user.
 */
export const deleteChatMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { roomId, messageId, conversationId, groupChatId, mode } = req.body || {};
        const deleteMode = String(mode || 'both');
        if (!messageId) {
            return res.status(400).json({ error: 'messageId is required' });
        }

        if (deleteMode === 'me') {
            if (conversationId) {
                const conv = await Conversation.findById(conversationId);
                if (!conv) return res.status(404).json({ error: 'Conversation not found' });
                if (!conv.participants.some((p: any) => p.toString() === String(userId))) {
                    return res.status(403).json({ error: 'Not a participant' });
                }
                await Conversation.updateOne(
                    { _id: conv._id, 'hiddenForParticipants.userId': userId },
                    { $addToSet: { 'hiddenForParticipants.$.messageIds': String(messageId) } },
                ).exec();
                await Conversation.updateOne(
                    { _id: conv._id, 'hiddenForParticipants.userId': { $ne: userId } },
                    { $push: { hiddenForParticipants: { userId, messageIds: [String(messageId)] } } },
                ).exec();
                return res.status(200).json({ success: true, mode: 'me' });
            }
            if (groupChatId) {
                const gc = await GroupChat.findById(groupChatId);
                if (!gc) return res.status(404).json({ error: 'Group chat not found' });
                if (!gc.participants.some((p: any) => String(p) === String(userId))) {
                    return res.status(403).json({ error: 'Not a participant' });
                }
                await GroupChat.updateOne(
                    { _id: gc._id, 'hiddenForParticipants.userId': userId },
                    { $addToSet: { 'hiddenForParticipants.$.messageIds': String(messageId) } },
                    { timestamps: false },
                ).exec();
                await GroupChat.updateOne(
                    { _id: gc._id, 'hiddenForParticipants.userId': { $ne: userId } },
                    { $push: { hiddenForParticipants: { userId, messageIds: [String(messageId)] } } },
                    { timestamps: false },
                ).exec();
                return res.status(200).json({ success: true, mode: 'me' });
            }
            return res.status(400).json({ error: 'conversationId or groupChatId is required for mode=me' });
        }

        if (!roomId) {
            return res.status(400).json({ error: 'roomId is required for mode=both' });
        }
        const me = await User.findById(userId);
        if (!me?.email) return res.status(400).json({ error: 'User not found' });
        const ok = await deleteMessageAsUser(
            { email: me.email, username: me.username, name: me.username },
            String(roomId),
            String(messageId)
        );
        return res.status(200).json({ success: ok, mode: 'both' });
    } catch (err: any) {
        console.error('[chat.deleteChatMessage]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** Clear DM thread for current user only (does not delete server history for the other participant). */
export const clearDmThread = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId } = req.body || {};
        if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
        const conv = await Conversation.findById(conversationId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (!conv.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'Not a participant' });
        }

        const now = new Date();
        await Conversation.updateOne(
            { _id: conv._id, 'hiddenForParticipants.userId': userId },
            { $set: { 'hiddenForParticipants.$.clearedAt': now }, $setOnInsert: {} },
        ).exec();
        await Conversation.updateOne(
            { _id: conv._id, 'hiddenForParticipants.userId': { $ne: userId } },
            { $push: { hiddenForParticipants: { userId, messageIds: [], clearedAt: now } } },
        ).exec();

        return res.status(200).json({
            success: true,
            mode: 'me',
            clearedAt: now.toISOString(),
        });
    } catch (err: any) {
        console.error('[chat.clearDmThread]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** Remove a 1:1 conversation from this user's sidebar (does not delete RC history for the other user). */
export const hideDmFromList = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId } = req.body || {};
        if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
        const conv = await Conversation.findById(conversationId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        if (!conv.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'Not a participant' });
        }
        await User.updateOne({ _id: userId }, { $pull: { directConversations: conversationId } }).exec();

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('[chat.hideDmFromList]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** POST body: { roomId } — Rocket.Chat room id (same as rcChannelId from DM / group init). */
export const markChatRead = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { roomId } = req.body;
        if (!roomId) return res.status(400).json({ error: 'roomId is required' });
        const me = await User.findById(userId);
        if (!me?.email) return res.status(400).json({ error: 'User not found' });
        const ok = await markRoomReadAsUser(String(roomId), {
            email: me.email,
            username: me.username,
            name: me.username,
        });
        return res.status(200).json({ success: ok });
    } catch (err: any) {
        console.error('[chat.markChatRead]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** One-shot snapshot for sidebar hydration when user opens chat section. */
export const getDmUnreadSnapshot = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const me = await User.findById(userId);
        if (!me?.email) return res.status(400).json({ error: 'User not found' });
        const { unreadByRid, nameByRid } = await getChatUnreadSnapshotAsUser({
            email: me.email,
            username: me.username,
            name: me.username,
        });
        return res.status(200).json({ success: true, unreadByRid, nameByRid });
    } catch (err: any) {
        console.error('[chat.getDmUnreadSnapshot]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** Authenticated private-chat target search (cross-role): experts + students, excluding self/blocked/admin. */
export const searchPrivateChatUsers = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const q = String(req.query.q || '').trim();
        if (!q) return res.status(200).json({ success: true, result: [] });
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = await User.find({
            _id: { $ne: userId },
            role: { $in: ['expert', 'customer'] },
            status: { $ne: 'blocked' },
            $or: [
                { username: { $regex: safe, $options: 'i' } },
                { email: { $regex: safe, $options: 'i' } },
            ],
        })
            .select('_id username email image role status')
            .sort({ username: 1 })
            .limit(30)
            .lean();
        return res.status(200).json({ success: true, result: users });
    } catch (err: any) {
        console.error('[chat.searchPrivateChatUsers]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** Authenticated chat profile lookup for DM header/profile modal (role-agnostic). */
export const getChatUserProfile = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const targetId = String(req.params.userId || '').trim();
        if (!targetId) return res.status(400).json({ error: 'userId is required' });
        if (targetId === String(userId)) {
            return res.status(400).json({ error: 'Cannot open own profile from DM target lookup' });
        }

        const me = await User.findById(userId).select('role').lean();
        const viewerMaySeeExpertResume =
            String(me?.role || '').toLowerCase() === 'customer';

        const doc = await User.findOne({
            _id: targetId,
            role: { $in: ['expert', 'customer'] },
            status: { $ne: 'blocked' },
        })
            .select(
                '_id username email image role status title country keywords services specialNote description resume',
            )
            .populate({ path: 'keywords', select: 'value label' })
            .populate({ path: 'services', select: 'value label' })
            .lean();

        if (!doc) return res.status(404).json({ error: 'User not found' });

        const result: Record<string, unknown> = { ...doc };
        const isTargetExpert = String(doc.role || '').toLowerCase() === 'expert';
        if (!isTargetExpert || !viewerMaySeeExpertResume) {
            delete result.resume;
        }

        return res.status(200).json({ success: true, result });
    } catch (err: any) {
        console.error('[chat.getChatUserProfile]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** Student triggered unsupported resume format while viewing an expert profile — email the expert once per attempt (client may dedupe). */
export const notifyExpertResumeFormat = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const expertId = String(req.body?.expertId || '').trim();
        if (!expertId) return res.status(400).json({ error: 'expertId is required' });

        const viewer = await User.findById(userId).select('role username').lean();
        if (!viewer || String(viewer.role || '').toLowerCase() !== 'customer') {
            return res.status(403).json({ error: 'Only students can send this reminder' });
        }

        const expert = await User.findOne({
            _id: expertId,
            role: { $regex: /^expert$/i },
            status: { $ne: 'blocked' },
        })
            .select('email username')
            .lean();
        if (!expert?.email) {
            return res.status(404).json({ error: 'Expert not found' });
        }

        await sendExpertResumeFormatReminderEmail(
            expert.email,
            expert.username || 'Expert',
            viewer.username || 'A student',
        );

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('[chat.notifyExpertResumeFormat]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ── RC Token Endpoint ───────────────────────────────────────

export const getRCToken = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const tokenData = await generateUserToken({
            email: user.email,
            username: user.username,
            name: user.username,
        });
        if (!tokenData) {
            return res.status(500).json({ error: 'Failed to generate RC token' });
        }

        return res.status(200).json({
            rcUrl: RC_URL,
            rcAuthToken: tokenData.authToken,
            rcUserId: tokenData.userId,
        });
    } catch (err: any) {
        console.error('[chat.getRCToken]', err.message);
        return res.status(500).json({ error: err.message });
    }
};
