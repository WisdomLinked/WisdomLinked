import { Request, Response } from 'express';
import { 
    getOrCreateDMChannel, 
    getOrCreateGroupChannel, 
    sendMessageToRC, 
    getRCIMHistory,
    getRCGroupHistory,
    generateUserToken, 
    RC_URL 
} from '../services/rocketchat.service';

const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

// Helper to map Rocket.Chat messages to WisdomLinked format so the frontend React UI doesnt break
const mapRCMessagesToWL = async (rcMessages: any[]) => {
    // Collect all unique usernames
    const usernames = [...new Set(rcMessages.map(m => m.alias || m.u?.username).filter(Boolean))];
    const users = await User.find({ username: { $in: usernames } }).select('_id username image role status');
    
    const userMap = users.reduce((acc: any, user: any) => {
        acc[user.username] = user;
        return acc;
    }, {});

    return rcMessages.map(m => {
        const username = m.alias || m.u?.username || 'Unknown';
        const author = userMap[username] || {
            _id: m.u?._id || 'unknown',
            username,
            image: null,
            role: 'user',
            status: 'active'
        };

        return {
            _id: m._id,
            content: m.msg,
            author,
            createdAt: m.ts,
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
            participants: { $all: [userId, otherUserId], $size: 2 }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [userId, otherUserId],
                messages: []
            });
            await conversation.save();
        }

        // Ensure a RC DM channel exists
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
        
        let rcChannelId = null;
        if (me && other) {
            rcChannelId = await getOrCreateDMChannel(me.username, other.username);
            if (rcChannelId) {
                // EXCLUSIVELY send to RC. We no longer save to our MongoDB Message model!
                await sendMessageToRC(rcChannelId, content, me.username);
            }
        }

        // Build a fake message object just to satisfy the frontend's optimistic update
        const populatedMessage = {
            _id: `temp-${Date.now()}`,
            content,
            author: { _id: me._id, username: me.username, image: me.image, role: me.role, status: me.status },
            createdAt: new Date(),
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

        if (me && other) {
            const rcChannelId = await getOrCreateDMChannel(me.username, other.username);
            if (rcChannelId) {
                // Fetch history direct from RC
                const rcMessages = await getRCIMHistory(rcChannelId, limit, page * limit);
                // Map it identically to how old Message model looked
                const messages = await mapRCMessagesToWL(rcMessages);
                return res.status(200).json({ messages: messages.reverse() });
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

        const groupChat = await GroupChat.findById(groupChatId);
        if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });

        if (!groupChat.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant of this group' });
        }

        const me = await User.findById(userId);
        if (me) {
            const rcChannelName = `wl-group-${groupChatId}`;
            const rcChannelId = await getOrCreateGroupChannel(rcChannelName, [me.username]);
            if (rcChannelId) {
                // Exclusively forward to RC
                await sendMessageToRC(rcChannelId, content, me.username);
            }
        }

        const populatedMessage = {
            _id: `temp-${Date.now()}`,
            content,
            author: { _id: me._id, username: me.username, image: me.image, role: me.role, status: me.status },
            createdAt: new Date(),
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

        const groupChat = await GroupChat.findById(groupChatId);
        if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });

        if (!groupChat.participants.some((p: any) => p.toString() === userId)) {
            return res.status(403).json({ error: 'You are not a participant' });
        }

        const me = await User.findById(userId);
        if (me) {
            const rcChannelName = `wl-group-${groupChatId}`;
            const rcChannelId = await getOrCreateGroupChannel(rcChannelName, [me.username]);
            if (rcChannelId) {
                // Fetch history direct from RC
                const rcMessages = await getRCGroupHistory(rcChannelId, limit, page * limit);
                const messages = await mapRCMessagesToWL(rcMessages);
                return res.status(200).json({ messages: messages.reverse() });
            }
        }

        return res.status(200).json({ messages: [] });
    } catch (err: any) {
        console.error('[chat.getGroupHistory]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ── RC Token Endpoint ───────────────────────────────────────

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
