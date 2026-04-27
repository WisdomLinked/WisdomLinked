import { Request, Response } from 'express';
import { getOrCreateDMChannel, sendMessageToRC, toRocketChatUsername, syncRocketGroupChannelMembers } from '../services/rocketchat.service';

const MeetingThread = require('../models/MeetingThread');
const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');
import { resolveMeetingRatingTargetUserId } from '../utils/meetingRatingRules';

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
                if (me && other && me.email && other.email) {
                    const rcChannelId = await getOrCreateDMChannel(
                        toRocketChatUsername(me.email),
                        toRocketChatUsername(other.email)
                    );
                    if (rcChannelId) await sendMessageToRC(rcChannelId, meetingContent, me.username, me.email);
                }
            }
        } else if (groupChatId) {
            const groupChat = await GroupChat.findById(groupChatId)
                .populate('participants', 'email')
                .populate('admin', 'email');
            if (me && me.email && groupChat) {
                const emails: string[] = [];
                for (const p of groupChat.participants || []) {
                    if ((p as any)?.email) emails.push(String((p as any).email).toLowerCase());
                }
                const adm = groupChat.admin as any;
                if (adm?.email) emails.push(String(adm.email).toLowerCase());
                const rcChannelId = await syncRocketGroupChannelMembers(String(groupChatId), emails);
                if (rcChannelId) await sendMessageToRC(rcChannelId, meetingContent, me.username, me.email);
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
                if (other && me.email && other.email) {
                    const rcChannelId = await getOrCreateDMChannel(
                        toRocketChatUsername(me.email),
                        toRocketChatUsername(other.email)
                    );
                    if (rcChannelId) await sendMessageToRC(rcChannelId, endContent, me.username, me.email);
                }
            }
        } else if (meeting.groupChatId && me.email) {
            const groupChat = await GroupChat.findById(meeting.groupChatId)
                .populate('participants', 'email')
                .populate('admin', 'email');
            if (groupChat) {
                const emails: string[] = [];
                for (const p of groupChat.participants || []) {
                    if ((p as any)?.email) emails.push(String((p as any).email).toLowerCase());
                }
                const adm = groupChat.admin as any;
                if (adm?.email) emails.push(String(adm.email).toLowerCase());
                const rcChannelId = await syncRocketGroupChannelMembers(String(meeting.groupChatId), emails);
                if (rcChannelId) await sendMessageToRC(rcChannelId, endContent, me.username, me.email);
            }
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

/**
 * GET /api/meeting/:meetingThreadId/rating-state
 * Return whether the current user can rate and if already rated.
 */
export const getMeetingRatingState = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId } = req.params;
        const meeting = await MeetingThread.findById(meetingThreadId)
            .populate('startedBy', 'username _id')
            .populate('participants', 'username _id');
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        const targetId = resolveMeetingRatingTargetUserId(meeting, String(userId));
        const existing = (meeting.ratings || []).find(
            (r: any) => String(r?.rater?._id ?? r?.rater) === String(userId),
        );
        const targetUser =
            targetId && (meeting.participants || []).find((p: any) => String(p?._id) === String(targetId)) ||
            (targetId && String(meeting.startedBy?._id) === String(targetId) ? meeting.startedBy : null);
        return res.status(200).json({
            success: true,
            canRate: meeting.status === 'ended' && !!targetId,
            hasRated: Boolean(existing),
            existingRating: existing
                ? { score: existing.score, comment: String(existing.comment || '') }
                : null,
            targetUser: targetUser
                ? { _id: targetUser._id, username: targetUser.username }
                : null,
        });
    } catch (err: any) {
        console.error('[meeting.ratingState]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/meeting/rate
 * Body: { meetingThreadId, score, comment? }
 */
export const submitMeetingRating = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId, score, comment } = req.body;
        const numericScore = Number(score);
        if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });
        if (!Number.isFinite(numericScore) || numericScore < 1 || numericScore > 5) {
            return res.status(400).json({ error: 'score must be between 1 and 5' });
        }
        const meeting = await MeetingThread.findById(meetingThreadId)
            .populate('startedBy', 'username _id')
            .populate('participants', 'username _id');
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (meeting.status !== 'ended') return res.status(400).json({ error: 'Meeting must be ended before rating' });
        const targetId = resolveMeetingRatingTargetUserId(meeting, String(userId));
        if (!targetId) return res.status(403).json({ error: 'You cannot rate this meeting' });

        const existingIdx = (meeting.ratings || []).findIndex(
            (r: any) => String(r?.rater?._id ?? r?.rater) === String(userId),
        );
        const payload = {
            rater: userId,
            target: targetId,
            score: Math.round(numericScore),
            comment: String(comment || '').trim(),
            updatedAt: new Date(),
        };
        if (existingIdx >= 0) {
            meeting.ratings[existingIdx] = {
                ...meeting.ratings[existingIdx],
                ...payload,
            };
        } else {
            meeting.ratings.push({ ...payload, createdAt: new Date() });
        }
        await meeting.save();

        const ratingsForTarget = (meeting.ratings || []).filter(
            (r: any) => String(r?.target?._id ?? r?.target) === String(targetId),
        );
        const averageScore = ratingsForTarget.length
            ? ratingsForTarget.reduce((sum: number, r: any) => sum + Number(r.score || 0), 0) / ratingsForTarget.length
            : 0;

        return res.status(200).json({
            success: true,
            rating: {
                score: Math.round(numericScore),
                comment: String(comment || '').trim(),
            },
            summary: {
                count: ratingsForTarget.length,
                averageScore: Number(averageScore.toFixed(2)),
            },
        });
    } catch (err: any) {
        console.error('[meeting.rate]', err.message);
        return res.status(500).json({ error: err.message });
    }
};
