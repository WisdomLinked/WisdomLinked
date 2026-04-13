import { Request, Response } from 'express';
import { getOrCreateDMChannel, getOrCreateGroupChannel, sendMessageToRC } from '../services/rocketchat.service';

const MeetingThread = require('../models/MeetingThread');
const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'meet.wisdomlinked.com';

/**
 * POST /api/meeting/start
 * Start a Jitsi meeting and create a meeting thread linked to a conversation or group.
 * Body: { conversationId?, groupChatId? }
 */
export const startMeeting = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { conversationId, groupChatId } = req.body;

        if (!conversationId && !groupChatId) {
            return res.status(400).json({ error: 'conversationId or groupChatId is required' });
        }

        const roomSuffix = conversationId || groupChatId;
        const jitsiRoomName = `wl-${roomSuffix}-${Date.now()}`;

        const meetingThread = new MeetingThread({
            conversationId: conversationId || undefined,
            groupChatId: groupChatId || undefined,
            jitsiRoomName,
            startedBy: userId,
            participants: [userId],
            status: 'active',
        });
        await meetingThread.save();

        const me = await User.findById(userId);
        const meetingContent = `__MEETING_STARTED__::${meetingThread._id}::${jitsiRoomName}::${me?.username || 'Unknown'}`;

        // Send exclusively to Rocket.Chat
        if (conversationId) {
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                const otherUserId = conversation.participants.find((p: any) => p.toString() !== userId);
                const other = await User.findById(otherUserId);
                if (me && other) {
                    const rcChannelId = await getOrCreateDMChannel(me.username, other.username);
                    if (rcChannelId) await sendMessageToRC(rcChannelId, meetingContent, me.username);
                }
            }
        } else if (groupChatId) {
            if (me) {
                const rcChannelId = await getOrCreateGroupChannel(`wl-group-${groupChatId}`, [me.username]);
                if (rcChannelId) await sendMessageToRC(rcChannelId, meetingContent, me.username);
            }
        }

        const message = {
            _id: `temp-${Date.now()}`,
            content: meetingContent,
            author: { _id: me._id, username: me.username, image: me.image, role: me.role, status: me.status },
            createdAt: new Date(),
            type: 'meeting',
        };

        return res.status(200).json({
            meetingThreadId: meetingThread._id,
            jitsiRoomName,
            jitsiUrl: `https://${JITSI_DOMAIN}/${jitsiRoomName}`,
            message,
        });
    } catch (err: any) {
        console.error('[meeting.start]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/meeting/end
 * End a meeting, calculate duration, update status.
 * Body: { meetingThreadId }
 */
export const endMeeting = async (req: any, res: Response) => {
    try {
        const { meetingThreadId } = req.body;
        if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });

        const meeting = await MeetingThread.findById(meetingThreadId).populate('startedBy');
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting already ended' });

        meeting.endedAt = new Date();
        meeting.duration = Math.round((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000);
        meeting.status = 'ended';
        await meeting.save();

        const endContent = `__MEETING_ENDED__::${meetingThreadId}::${meeting.duration}::${meeting.participants.length}`;
        const me = meeting.startedBy;

        // Send exclusively to Rocket.Chat
        if (meeting.conversationId) {
            const conversation = await Conversation.findById(meeting.conversationId);
            if (conversation) {
                const otherUserId = conversation.participants.find((p: any) => p.toString() !== me._id.toString());
                const other = await User.findById(otherUserId);
                if (other) {
                    const rcChannelId = await getOrCreateDMChannel(me.username, other.username);
                    if (rcChannelId) await sendMessageToRC(rcChannelId, endContent, me.username);
                }
            }
        } else if (meeting.groupChatId) {
            const rcChannelId = await getOrCreateGroupChannel(`wl-group-${meeting.groupChatId}`, [me.username]);
            if (rcChannelId) await sendMessageToRC(rcChannelId, endContent, me.username);
        }

        const endMessage = {
            _id: `temp-${Date.now()}`,
            content: endContent,
            author: { _id: me._id, username: me.username, image: me.image, role: me.role, status: me.status },
            createdAt: new Date(),
            type: 'meeting',
        };

        return res.status(200).json({
            meeting,
            endMessage,
        });
    } catch (err: any) {
        console.error('[meeting.end]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/meeting/transcript
 * Append a chat message from the Jitsi call to the meeting transcript.
 * Body: { meetingThreadId, content, authorName }
 */
export const addTranscriptMessage = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId, content, authorName } = req.body;

        if (!meetingThreadId || !content) {
            return res.status(400).json({ error: 'meetingThreadId and content are required' });
        }

        const meeting = await MeetingThread.findById(meetingThreadId);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

        if (!meeting.participants.some((p: any) => p.toString() === userId)) {
            meeting.participants.push(userId);
        }

        meeting.transcript.push({
            author: userId,
            authorName: authorName || 'Unknown',
            content,
            createdAt: new Date(),
        });
        await meeting.save();

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('[meeting.transcript]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/meeting/:meetingThreadId
 * Get a meeting thread with its full transcript.
 */
export const getMeetingThread = async (req: any, res: Response) => {
    try {
        const { meetingThreadId } = req.params;

        const meeting = await MeetingThread.findById(meetingThreadId)
            .populate('startedBy', 'username _id image role')
            .populate('participants', 'username _id image role')
            .populate('transcript.author', 'username _id image role');

        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

        return res.status(200).json({ meeting });
    } catch (err: any) {
        console.error('[meeting.get]', err.message);
        return res.status(500).json({ error: err.message });
    }
};
