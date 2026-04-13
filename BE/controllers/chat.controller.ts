import { Request, Response } from 'express';
import { getOrCreateDMChannel, getOrCreateGroupChannel, sendMessageToRC, generateUserToken, RC_URL } from '../services/rocketchat.service';

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

// ── DM Endpoints ────────────────────────────────────────────

/**
 * POST /api/chat/dm
 * Get or create a DM conversation between the logged-in user and another user.
 * Body: { otherUserId }
 * Returns: { conversationId, rcChannelId }
 */
export const getOrCreateDM = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { otherUserId } = req.body;

        if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

        // Find or create a Conversation between the two users
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, otherUserId], $size: 2 }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [userId, otherUserId],
                messages: []
            });
            await conversation.save();
        }

        // Also ensure a RC DM channel exists
        const me = await User.findById(userId);
        const other = await User.findById(otherUserId);
        let rcChannelId = null;
        if (me && other) {
            rcChannelId = await getOrCreateDMChannel(me.username, other.username);
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

/**
 * POST /api/chat/send
 * Send a message in a DM conversation.
 * Body: { conversationId, content }
 * Saves to MongoDB AND forwards to Rocket.Chat for real-time delivery.
 */
export const sendMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId, content } = req.body;

        if (!conversationId || !content) {
            return res.status(400).json({ error: 'conversationId and content are required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        // Check user is a participant
        if (!conversation.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant of this conversation' });
        }

        // 1. Save to MongoDB
        const newMessage = new Message({
            author: userId,
            content,
            type: 'direct',
        });
        await newMessage.save();

        conversation.messages.push(newMessage._id);
        await conversation.save();

        // Populate author for the response
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('author', 'username _id image role status');

        // 2. Forward to RC for real-time delivery (fire-and-forget)
        const me = await User.findById(userId);
        const otherUserId = conversation.participants.find((p: any) => p.toString() !== userId);
        const other = await User.findById(otherUserId);
        if (me && other) {
            const rcChannelId = await getOrCreateDMChannel(me.username, other.username);
            if (rcChannelId) {
                sendMessageToRC(rcChannelId, content, me.username).catch(err =>
                    console.error('[chat.send] RC forward failed:', err.message)
                );
            }
        }

        return res.status(200).json({
            message: populatedMessage,
        });
    } catch (err: any) {
        console.error('[chat.sendMessage]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/chat/history/:conversationId
 * Fetch paginated message history from our MongoDB.
 * Query: ?page=0&limit=20
 */
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

        // Get the last N message IDs (paginated from the end)
        const totalMessages = conversation.messages.length;
        const startIndex = Math.max(0, totalMessages - (page + 1) * limit);
        const endIndex = Math.max(0, totalMessages - page * limit);
        const messageIds = conversation.messages.slice(startIndex, endIndex);

        const messages = await Message.find({ _id: { $in: messageIds } })
            .populate('author', 'username _id image role status')
            .sort({ createdAt: 1 });

        return res.status(200).json({ messages });
    } catch (err: any) {
        console.error('[chat.getDirectHistory]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ── Group Chat Endpoints ────────────────────────────────────

/**
 * POST /api/chat/group/send
 * Send a message to a group chat.
 * Body: { groupChatId, content }
 */
export const sendGroupMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { groupChatId, content } = req.body;

        if (!groupChatId || !content) {
            return res.status(400).json({ error: 'groupChatId and content are required' });
        }

        const groupChat = await GroupChat.findById(groupChatId);
        if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });

        // Check participant
        if (!groupChat.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant of this group' });
        }

        // 1. Save to MongoDB
        const newMessage = new Message({
            author: userId,
            content,
            type: 'group',
        });
        await newMessage.save();

        groupChat.messages.push(newMessage._id);
        await groupChat.save();

        const populatedMessage = await Message.findById(newMessage._id)
            .populate('author', 'username _id image role status');

        // 2. Forward to RC group channel (fire-and-forget)
        const me = await User.findById(userId);
        if (me) {
            // Build a clean RC channel name from the group
            const rcChannelName = `wl-group-${groupChatId}`;
            const rcChannelId = await getOrCreateGroupChannel(rcChannelName, [me.username]);
            if (rcChannelId) {
                sendMessageToRC(rcChannelId, content, me.username).catch(err =>
                    console.error('[chat.groupSend] RC forward failed:', err.message)
                );
            }
        }

        return res.status(200).json({
            message: populatedMessage,
        });
    } catch (err: any) {
        console.error('[chat.sendGroupMessage]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/chat/group/history/:groupChatId
 * Fetch paginated group chat history from our MongoDB.
 * Query: ?page=0&limit=20
 */
export const getGroupHistory = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.params;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 20;

        const groupChat = await GroupChat.findById(groupChatId);
        if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });

        if (!groupChat.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant' });
        }

        const totalMessages = groupChat.messages.length;
        const startIndex = Math.max(0, totalMessages - (page + 1) * limit);
        const endIndex = Math.max(0, totalMessages - page * limit);
        const messageIds = groupChat.messages.slice(startIndex, endIndex);

        const messages = await Message.find({ _id: { $in: messageIds } })
            .populate('author', 'username _id image role status')
            .sort({ createdAt: 1 });

        return res.status(200).json({ messages });
    } catch (err: any) {
        console.error('[chat.getGroupHistory]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ── RC Token Endpoint ───────────────────────────────────────

/**
 * GET /api/chat/rc-token
 * Generate a Rocket.Chat auth token for the logged-in user so the frontend
 * can connect to RC's realtime WebSocket for typing + live messages.
 */
export const getRCToken = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const tokenData = await generateUserToken(user.username);
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
