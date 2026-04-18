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
    getRCMessageReadReceipts,
    ensureBothWlUsersSyncedToRocketChat,
    deleteMessageAsUser,
    cleanRoomHistoryAsUser,
    purgeRoomMessagesBestEffort,
} from '../services/rocketchat.service';

const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

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
    username: u.username,
    image: u.image,
    role: u.role,
    status: u.status,
});

// Helper to map Rocket.Chat messages to WisdomLinked format so the frontend React UI doesnt break
/** For DMs, pass `dmParticipants` so RC login slugs always resolve to Mongo `author._id` (fixes expert vs student mismatch). */
const mapRCMessagesToWL = async (
    rcMessages: any[],
    dmParticipants?: { me?: any; other?: any }
) => {
    // Collect all unique usernames
    // Include both RC login (email-derived) and optional display alias so User lookup succeeds
    const usernames = [
        ...new Set(
            rcMessages.flatMap((m: any) => [m.u?.username, m.alias].filter(Boolean))
        ),
    ];
    const users = await User.find({
        $or: [{ username: { $in: usernames } }, { rocketChatUsername: { $in: usernames } }]
    }).select('_id username rocketChatUsername image role status email');

    const userMap: Record<string, any> = {};
    users.forEach((user: any) => {
        if (user.username) userMap[user.username] = user;
        if (user.rocketChatUsername) userMap[user.rocketChatUsername] = user;
    });

    // Always map the two DM participants by their Rocket.Chat usernames (email-derived slugs)
    if (dmParticipants?.me?.email) {
        userMap[toRocketChatUsername(dmParticipants.me.email)] = wlAuthorFromUser(dmParticipants.me);
    }
    if (dmParticipants?.other?.email) {
        userMap[toRocketChatUsername(dmParticipants.other.email)] = wlAuthorFromUser(dmParticipants.other);
    }

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

        return {
            _id: m._id,
            content: m.msg,
            author,
            createdAt: normalizeRcMessageTs(m.ts),
            type: m.t || 'message'
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

        // Real RC `_id` enables `chat.getMessageReadReceipts` on the client; fallback if send fails.
        let sentId = `temp-${Date.now()}`;
        if (me && other && me.email && other.email) {
            await ensureBothWlUsersSyncedToRocketChat(me, other);
            const rcChannelId = await getOrCreateDMChannel(
                toRocketChatUsername(me.email),
                toRocketChatUsername(other.email)
            );
            if (rcChannelId) {
                // EXCLUSIVELY send to RC. We no longer save to our MongoDB Message model!
                const rid = await sendMessageToRC(rcChannelId, content, me.username, me.email);
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
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 20;

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
                const messages = await mapRCMessagesToWL(sorted, { me, other });
                return res.status(200).json({ messages });
            }
        }

        return res.status(200).json({ messages: [] });
    } catch (err: any) {
        console.error('[chat.getDirectHistory]', err.message);
        return res.status(500).json({ error: err.message });
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
                const rid = await sendMessageToRC(rcChannelId, content, me.username, me.email);
                if (rid) sentId = rid;
            }
        }

        const populatedMessage = {
            _id: sentId,
            content,
            author: { _id: me!._id, username: me!.username, image: me!.image, role: me!.role, status: me!.status },
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
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 20;

        const groupChat = await GroupChat.findById(groupChatId)
            .populate('participants', 'email')
            .populate('admin', 'email');
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
                const messages = await mapRCMessagesToWL(sorted);
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
        const byMessageId: Record<string, { hasPeerRead: boolean; receipts: any[] }> = {};
        for (const mid of ids) {
            const data = await getRCMessageReadReceipts(mid, reader);
            const receipts = data?.receipts || [];
            const hasPeerRead = receipts.some(
                (r: any) =>
                    String(r.userId || r.user?._id || r.user?.id || '') !== String(myRcUserId)
            );
            byMessageId[mid] = { hasPeerRead, receipts };
        }
        return res.status(200).json({ success: true, myRcUserId, byMessageId });
    } catch (err: any) {
        console.error('[chat.getReadReceiptsBatch]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** POST body: { roomId, messageId } — deletes message in RC as the current user (own messages / allowed by RC). */
export const deleteChatMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { roomId, messageId } = req.body || {};
        if (!roomId || !messageId) {
            return res.status(400).json({ error: 'roomId and messageId are required' });
        }
        const me = await User.findById(userId);
        if (!me?.email) return res.status(400).json({ error: 'User not found' });
        const ok = await deleteMessageAsUser(
            { email: me.email, username: me.username, name: me.username },
            String(roomId),
            String(messageId)
        );
        return res.status(200).json({ success: ok });
    } catch (err: any) {
        console.error('[chat.deleteChatMessage]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Clear all messages in a DM’s Rocket.Chat room for the current user’s workspace.
 * Tries `rooms.cleanHistory` first (needs RC permission `clean-room-history`), then best-effort per-message delete.
 */
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

        const me = await User.findById(userId);
        const otherUserId = conv.participants.find((p: any) => p.toString() !== userId);
        const other = await User.findById(otherUserId);
        if (!me?.email || !other?.email) {
            return res.status(400).json({ error: 'Missing participant email for Rocket.Chat' });
        }

        let rcChannelId = (conv as any).rcChannelId as string | undefined;
        if (!rcChannelId) {
            await ensureBothWlUsersSyncedToRocketChat(me, other);
            rcChannelId = await getOrCreateDMChannel(
                toRocketChatUsername(me.email),
                toRocketChatUsername(other.email)
            );
            if (rcChannelId) {
                await Conversation.updateOne({ _id: conv._id }, { $set: { rcChannelId } }).exec();
            }
        }
        if (!rcChannelId) {
            return res.status(502).json({ error: 'Could not resolve Rocket.Chat room for this conversation' });
        }

        const reader = { email: me.email, username: me.username, name: me.username };
        const cleaned = await cleanRoomHistoryAsUser(reader, rcChannelId);
        let fallbackDeleted = 0;
        if (!cleaned) {
            fallbackDeleted = await purgeRoomMessagesBestEffort(reader, rcChannelId);
        }

        if (!cleaned && fallbackDeleted === 0) {
            return res.status(502).json({
                error:
                    'Rocket.Chat did not clear this thread. In Rocket.Chat Admin, enable permission **clean-room-history** for the user role (or use an RC version that allows it for DMs). As a fallback, only messages you are allowed to delete one-by-one were attempted.',
                success: false,
            });
        }

        /** Same as “remove from sidebar”: drop this conversation from the current user’s list. */
        await User.updateOne({ _id: userId }, { $pull: { directConversations: conv._id } }).exec();

        return res.status(200).json({
            success: true,
            usedCleanHistory: cleaned,
            fallbackDeletedCount: fallbackDeleted,
            removedFromSidebar: true,
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
