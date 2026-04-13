import { Request, Response } from 'express';

const MeetingThread = require('../models/MeetingThread');
const Message = require('../models/Message');
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

        // Generate a unique Jitsi room name
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

        // Create a special "meeting started" message in the parent conversation/group
        const me = await User.findById(userId);
        const meetingMessage = new Message({
            author: userId,
            content: `__MEETING_STARTED__::${meetingThread._id}::${jitsiRoomName}::${me?.username || 'Unknown'}`,
            type: 'meeting',
        });
        await meetingMessage.save();

        // Attach to the conversation or group
        if (conversationId) {
            await Conversation.findByIdAndUpdate(conversationId, {
                $push: { messages: meetingMessage._id }
            });
        } else if (groupChatId) {
            await GroupChat.findByIdAndUpdate(groupChatId, {
                $push: { messages: meetingMessage._id }
            });
        }

        return res.status(200).json({
            meetingThreadId: meetingThread._id,
            jitsiRoomName,
            jitsiUrl: `https://${JITSI_DOMAIN}/${jitsiRoomName}`,
            message: await Message.findById(meetingMessage._id).populate('author', 'username _id image role status'),
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

        const meeting = await MeetingThread.findById(meetingThreadId);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting already ended' });

        meeting.endedAt = new Date();
        meeting.duration = Math.round((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000);
        meeting.status = 'ended';
        await meeting.save();

        // Create a "meeting ended" message in the parent conversation/group
        const endMessage = new Message({
            author: meeting.startedBy,
            content: `__MEETING_ENDED__::${meetingThreadId}::${meeting.duration}::${meeting.participants.length}`,
            type: 'meeting',
        });
        await endMessage.save();

        if (meeting.conversationId) {
            await Conversation.findByIdAndUpdate(meeting.conversationId, {
                $push: { messages: endMessage._id }
            });
        } else if (meeting.groupChatId) {
            await GroupChat.findByIdAndUpdate(meeting.groupChatId, {
                $push: { messages: endMessage._id }
            });
        }

        return res.status(200).json({
            meeting,
            endMessage: await Message.findById(endMessage._id).populate('author', 'username _id image role status'),
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

        // Add participant if not already in the list
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
