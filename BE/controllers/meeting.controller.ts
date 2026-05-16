import { Request, Response } from 'express';
import {
    getOrCreateDMChannel,
    sendMessageToRC,
    toRocketChatUsername,
    syncRocketGroupChannelMembers,
    wlHtmlToPlainTextForRocketChat,
} from '../services/rocketchat.service';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const MeetingThread = require('../models/MeetingThread');
const Conversation = require('../models/Conversation');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');
const MeetingGuestInvite = require('../models/MeetingGuestInvite');
import { resolveMeetingRatingTargetUserId } from '../utils/meetingRatingRules';
import { buildMeetingRoomName, canStartGroupMeeting } from '../utils/meetingModerationRules';
import { appendJitsiMobileWebOverrides } from '../utils/jitsiUrl';
import { isMeetingModerator, isMeetingModeratorWithDelegates } from '../utils/meetingRoleRules';
import { buildMeetingInviteUrl, resolvePublicAppBaseUrl } from '../utils/inviteUrl';
import { wlDisplayName } from '../utils/wlDisplayName';
import { jitsiDisplayInitials } from '../utils/jitsiDisplayName';
import { encodeMeetingChatLine } from '../utils/meetingChatPayload';
import { signWlMeetingChatToken, signGuestMeetingChatToken, type MeetingChatTokenClaims } from '../utils/meetingChatSyncToken';
import { allowMeetingChatRate } from '../utils/meetingChatRateLimit';

const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'meet.wisdomlinked.com';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || process.env.FE_URL || process.env.REACT_APP_URL || '';
const MEETING_RETURN_URL = process.env.MEETING_RETURN_URL
    || (FRONTEND_BASE_URL ? `${String(FRONTEND_BASE_URL).replace(/\/$/, '')}/user` : '');
const JITSI_JWT_SECRET = process.env.JITSI_JWT_SECRET || '';
const JITSI_APP_ID = process.env.JITSI_APP_ID || 'wisdomlinked';
const JITSI_AUD = process.env.JITSI_AUD || 'jitsi';
const JITSI_ISS = process.env.JITSI_ISS || JITSI_APP_ID;
const MEETING_MAX_ACTIVE_MS = Math.max(
    30 * 60 * 1000,
    Number(process.env.MEETING_MAX_ACTIVE_HOURS || 12) * 60 * 60 * 1000,
);

const MEETING_CHAT_SYNC_RL_MAX = Math.max(10, Math.min(120, Number(process.env.MEETING_CHAT_SYNC_RL_PER_MIN || 50)));
const MEETING_CHAT_SYNC_RL_WINDOW_MS = 60_000;

const publicApiBaseForMeetingChatSync = (): string =>
    String(
        process.env.MEETING_CHAT_SYNC_PUBLIC_API_BASE
            || process.env.API_PUBLIC_BASE_URL
            || process.env.PUBLIC_API_BASE
            || process.env.FRONTEND_BASE_URL
            || process.env.FE_URL
            || '',
    )
        .trim()
        .replace(/\/$/, '');

const messengerOriginForMeet = (): string => {
    const raw = String(
        process.env.FRONTEND_BASE_URL
            || process.env.FE_URL
            || process.env.REACT_APP_URL
            || '',
    ).trim();
    if (!raw) return '';
    try {
        return new URL(raw).origin;
    } catch {
        return raw.replace(/\/$/, '');
    }
};

const MEETING_HEARTBEAT_STALE_MS = Math.max(
    60_000,
    Number(process.env.MEETING_HEARTBEAT_STALE_MS || 90_000),
);

const meetingChatSyncUrlParams = (
    userId: string | undefined,
    meetingThreadId: string,
    guest?: { inviteId: string; displayName: string; expiresInSeconds: number },
): { chatSyncToken?: string; chatSyncApiBase?: string; messengerOrigin?: string } => {
    const apiBase = publicApiBaseForMeetingChatSync();
    const messengerOrigin = messengerOriginForMeet();
    if (!apiBase) return {};
    try {
        if (guest) {
            const exp = Math.max(120, Math.min(guest.expiresInSeconds, 48 * 60 * 60));
            return {
                chatSyncToken: signGuestMeetingChatToken(guest.inviteId, meetingThreadId, guest.displayName, exp),
                chatSyncApiBase: apiBase,
                messengerOrigin,
            };
        }
        if (!userId) return {};
        return {
            chatSyncToken: signWlMeetingChatToken(userId, meetingThreadId, 8 * 60 * 60),
            chatSyncApiBase: apiBase,
            messengerOrigin,
        };
    } catch {
        return {};
    }
};

const normalizeId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '').trim();

// Meet must set WAIT_FOR_HOST_DISABLE_AUTO_OWNERS=1 (Prosody) or every JWT joiner becomes MUC owner
// despite `moderator: false` here; see BE/env.rocket.template.
const buildSignedJitsiUrl = (
    roomName: string,
    userLike: any,
    opts?: {
        moderator?: boolean;
        guest?: boolean;
        expiresInSeconds?: number;
        meetingThreadId?: string;
        chatSyncToken?: string;
        chatSyncApiBase?: string;
        messengerOrigin?: string;
    },
): string => {
    const base = `https://${JITSI_DOMAIN}/${roomName}`;
    const moderator = Boolean(opts?.moderator);
    const guest = Boolean(opts?.guest);
    const whiteboardEnabled = true;
    const wbInitials = jitsiDisplayInitials(userLike);
    if (!JITSI_JWT_SECRET) {
        return appendJitsiMobileWebOverrides(
            base,
            MEETING_RETURN_URL,
            whiteboardEnabled,
            opts?.meetingThreadId,
            opts?.chatSyncToken,
            opts?.chatSyncApiBase,
            wbInitials,
            moderator,
            opts?.messengerOrigin,
        );
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + Number(opts?.expiresInSeconds || 2 * 60 * 60);
    const userId = normalizeId(userLike?._id || userLike?.id || userLike?.userId);
    const displayName = wlDisplayName(userLike) || String(userLike?.name || 'Guest');
    const email = String(userLike?.email || '').trim().toLowerCase();
    const avatar = String(userLike?.image || '').trim();

    const token = jwt.sign(
        {
            aud: JITSI_AUD,
            iss: JITSI_ISS,
            sub: JITSI_DOMAIN,
            room: roomName,
            nbf: nowSec - 10,
            exp,
            moderator,
            context: {
                user: {
                    id: userId || undefined,
                    name: displayName,
                    email: email || undefined,
                    avatar: avatar || undefined,
                    // Lets owner-capable users skip lobby when token_lobby_bypass is enabled in Prosody.
                    lobby_bypass: moderator,
                    moderator,
                    role: moderator ? 'moderator' : guest ? 'guest' : 'participant',
                },
                features: {
                    livestreaming: false,
                    // Do not hard-disable these by token; let Jitsi runtime role checks decide.
                    recording: true,
                    transcription: true,
                    outbound_call: false,
                    whiteboard: whiteboardEnabled,
                },
            },
        },
        JITSI_JWT_SECRET,
        { algorithm: 'HS256', header: { alg: 'HS256', kid: JITSI_APP_ID } },
    );
    return appendJitsiMobileWebOverrides(
        `${base}?jwt=${encodeURIComponent(token)}`,
        MEETING_RETURN_URL,
        whiteboardEnabled,
        opts?.meetingThreadId,
        opts?.chatSyncToken,
        opts?.chatSyncApiBase,
        wbInitials,
        moderator,
        opts?.messengerOrigin,
    );
};

/**
 * POST /api/meeting/end-call
 * End meeting from Jitsi tab using meeting-chat Bearer JWT (hangup hook).
 * Body: { meetingThreadId, endReason?: 'last_participant' }
 */
export const endMeetingFromCall = async (req: any, res: Response) => {
    const claims = req.meetingChatClaims as MeetingChatTokenClaims | undefined;
    const meetingThreadId = String(req.body?.meetingThreadId || '').trim();
    if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });
    if (claims?.typ === 'wl-meeting-chat') {
        if (String(claims.mid) !== meetingThreadId) {
            return res.status(400).json({ error: 'meetingThreadId does not match token' });
        }
        req.user = { ...(req.user || {}), userId: String(claims.sub) };
    }
    return endMeeting(req, res);
};

/**
 * POST /api/meeting/heartbeat
 * Jitsi tab reports occupancy; stale alone heartbeats auto-end the meeting.
 * Body: { meetingThreadId, remoteJoinCount?, aloneInRoom? }
 */
export const meetingHeartbeat = async (req: any, res: Response) => {
    try {
        const claims = req.meetingChatClaims as MeetingChatTokenClaims | undefined;
        const meetingThreadId = String(req.body?.meetingThreadId || '').trim();
        if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });
        if (claims?.typ === 'wl-meeting-chat' && String(claims.mid) !== meetingThreadId) {
            return res.status(400).json({ error: 'meetingThreadId does not match token' });
        }

        const meeting = await MeetingThread.findById(meetingThreadId);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (meeting.status === 'ended') {
            return res.status(200).json({ success: true, status: 'ended' });
        }

        const remote = Number(req.body?.remoteJoinCount);
        meeting.lastHeartbeatAt = new Date();
        if (Number.isFinite(remote)) {
            meeting.lastReportedRemoteCount = Math.max(0, Math.floor(remote));
        }
        await meeting.save();

        const endedByStale = await reconcileStaleActiveMeetingFromHeartbeat(meeting);
        if (endedByStale) {
            return res.status(200).json({ success: true, status: 'ended', reason: 'heartbeat_stale' });
        }

        return res.status(200).json({
            success: true,
            status: meeting.status,
        });
    } catch (err: any) {
        console.error('[meeting.heartbeat]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

const isLastParticipantEndReason = (reason: unknown): boolean => {
    const r = String(reason || '').trim();
    return r === 'last_participant' || r === 'last_participant_return';
};

const delegatedIdsFromMeeting = (meeting: any): string[] =>
    (Array.isArray(meeting?.delegatedModerators) ? meeting.delegatedModerators : []).map((id: any) => normalizeId(id));

const canUserJoinMeeting = async (meeting: any, userId: string): Promise<{ allowed: boolean; moderator: boolean }> => {
    const uid = String(userId || '').trim();
    if (!meeting || !uid) return { allowed: false, moderator: false };
    const delegated = delegatedIdsFromMeeting(meeting);
    if (meeting.conversationId) {
        const conversation = await Conversation.findById(meeting.conversationId).select('participants').lean();
        const isParticipant = Array.isArray(conversation?.participants)
            && conversation.participants.some((p: any) => normalizeId(p) === uid);
        return {
            allowed: isParticipant,
            moderator: isMeetingModeratorWithDelegates({
                conversationId: meeting.conversationId,
                userId: uid,
                startedBy: meeting.startedBy,
                delegatedModeratorIds: delegated,
            }),
        };
    }
    if (meeting.groupChatId) {
        const groupChat = await GroupChat.findById(meeting.groupChatId)
            .select('admin participants coModerators')
            .lean();
        if (!groupChat) return { allowed: false, moderator: false };
        const adminId = normalizeId(groupChat?.admin);
        const participantIds = Array.isArray(groupChat?.participants)
            ? groupChat.participants.map((p: any) => normalizeId(p))
            : [];
        const coModeratorIds = Array.isArray(groupChat?.coModerators)
            ? groupChat.coModerators.map((p: any) => normalizeId(p))
            : [];
        const allowed = participantIds.includes(uid) || adminId === uid || coModeratorIds.includes(uid);
        const moderator = isMeetingModeratorWithDelegates({
            userId: uid,
            groupAdminId: adminId,
            delegatedModeratorIds: delegated,
        });
        return { allowed, moderator };
    }
    return { allowed: false, moderator: false };
};

const isRemovedFromMeeting = (meeting: any, userId: string): boolean => {
    const uid = String(userId || '');
    if (!uid) return false;
    return Array.isArray(meeting?.removedParticipants) && meeting.removedParticipants.some(
        (r: any) => normalizeId(r?.userId) === uid,
    );
};

const meetingStartedMs = (meeting: any): number => {
    const started = meeting?.startedAt ? new Date(meeting.startedAt).getTime() : 0;
    return Number.isFinite(started) && started > 0 ? started : Date.now();
};

const isMeetingStale = (meeting: any): boolean =>
    meeting?.status === 'active' && Date.now() - meetingStartedMs(meeting) > MEETING_MAX_ACTIVE_MS;

const markMeetingEnded = async (meeting: any, endedAt = new Date()): Promise<boolean> => {
    if (!meeting || meeting.status === 'ended') return false;
    meeting.endedAt = endedAt;
    meeting.duration = Math.max(0, Math.round((endedAt.getTime() - meetingStartedMs(meeting)) / 1000));
    meeting.status = 'ended';
    if (typeof meeting.save === 'function') await meeting.save();
    return true;
};

const expireStaleMeetingIfNeeded = async (meeting: any): Promise<boolean> => {
    if (!isMeetingStale(meeting)) return false;
    await markMeetingEnded(meeting);
    return true;
};

const sendMeetingEndedToRocketChat = async (meeting: any, endContent: string): Promise<void> => {
    const me = meeting.startedBy;
    if (!me) return;
    if (meeting.conversationId) {
        const conversation = await Conversation.findById(meeting.conversationId);
        if (conversation) {
            const otherUserId = conversation.participants.find((p: any) => p.toString() !== me._id.toString());
            const other = await User.findById(otherUserId);
            if (other && me.email && other.email) {
                const rcChannelId = await getOrCreateDMChannel(
                    toRocketChatUsername(me.email),
                    toRocketChatUsername(other.email),
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
};

/** End active meeting when Jitsi heartbeats stop while alone (tab closed without hangup). */
const reconcileStaleActiveMeetingFromHeartbeat = async (meeting: any): Promise<boolean> => {
    if (!meeting || meeting.status !== 'active') return false;
    const lastAt = meeting.lastHeartbeatAt ? new Date(meeting.lastHeartbeatAt).getTime() : 0;
    if (!lastAt || !Number.isFinite(lastAt)) return false;
    const remote = Number(meeting.lastReportedRemoteCount);
    if (!Number.isFinite(remote) || remote > 0) return false;
    if (Date.now() - lastAt <= MEETING_HEARTBEAT_STALE_MS) return false;

    const populated = await MeetingThread.findById(meeting._id).populate('startedBy');
    if (!populated || populated.status !== 'active') return false;
    await markMeetingEnded(populated);
    const meetingThreadId = String(populated._id);
    const endContent = `__MEETING_ENDED__::${meetingThreadId}::${populated.duration}::${populated.participants.length}`;
    await sendMeetingEndedToRocketChat(populated, endContent);
    return true;
};

const closeActiveMeetingsForScope = async (scope: { conversationId?: any; groupChatId?: any }) => {
    const query = scope.conversationId
        ? { conversationId: scope.conversationId, status: 'active' }
        : scope.groupChatId
          ? { groupChatId: scope.groupChatId, status: 'active' }
          : null;
    if (!query) return;
    const activeMeetings = await MeetingThread.find(query);
    await Promise.all(activeMeetings.map((meeting: any) => markMeetingEnded(meeting)));
};

const hasJoinedMeeting = (meeting: any, userId: string): boolean => {
    const uid = normalizeId(userId);
    if (!uid || !meeting) return false;
    const participantJoined = Array.isArray(meeting?.participants) && meeting.participants.some(
        (p: any) => normalizeId(p) === uid,
    );
    const eventJoined = Array.isArray(meeting?.joinEvents) && meeting.joinEvents.some(
        (event: any) => normalizeId(event?.userId) === uid,
    );
    return participantJoined || eventJoined;
};

const requireMeetingAccess = async (
    meeting: any,
    userId: string,
    opts: { moderator?: boolean } = {},
): Promise<{ allowed: boolean; moderator: boolean; error?: string }> => {
    if (!meeting) return { allowed: false, moderator: false, error: 'Meeting not found' };
    if (isRemovedFromMeeting(meeting, userId)) {
        return { allowed: false, moderator: false, error: 'You were removed from this active call by a moderator' };
    }
    const auth = await canUserJoinMeeting(meeting, userId);
    if (!auth.allowed) return { ...auth, error: 'You do not have access to this meeting' };
    if (opts.moderator && !auth.moderator) {
        return { ...auth, allowed: false, error: 'Only meeting moderators can perform this action' };
    }
    return auth;
};

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

        const me = await User.findById(userId).select('email username image role status');
        if (!me) return res.status(404).json({ error: 'User not found' });

        let roomScope = String(conversationId || groupChatId || "");
        let groupAdminId = "";
        if (conversationId) {
            const conversation = await Conversation.findById(conversationId);
            if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
            const isParticipant = (conversation.participants || []).some((p: any) => String(p) === String(userId));
            if (!isParticipant) return res.status(403).json({ error: 'Only participants can start this call' });

            const otherUserId = (conversation.participants || []).find((p: any) => String(p) !== String(userId));
            const otherParticipant = otherUserId
                ? await User.findById(otherUserId).select('role').lean()
                : null;
            const myRole = String(me?.role || '').toLowerCase();
            const otherRole = String(otherParticipant?.role || '').toLowerCase();
            if (myRole === 'customer' && otherRole === 'expert') {
                return res.status(403).json({
                    error:
                        'Only your expert can start a video or audio call. You can continue the conversation in text chat.',
                });
            }
        }
        if (groupChatId) {
            const groupChat = await GroupChat.findById(groupChatId)
                .populate('participants', 'email role')
                .populate('admin', 'email role');
            if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });
            if (!canStartGroupMeeting(groupChat, me)) {
                return res.status(403).json({ error: 'Only the group admin can start this group call' });
            }
            groupAdminId = normalizeId(groupChat?.admin);
            roomScope = String(groupChatId);
        }
        await closeActiveMeetingsForScope({ conversationId, groupChatId });
        const jitsiRoomName = buildMeetingRoomName(roomScope);

        const meetingThread = new MeetingThread({
            conversationId: conversationId || undefined,
            groupChatId: groupChatId || undefined,
            jitsiRoomName,
            startedBy: userId,
            participants: [userId],
            joinEvents: [{ userId, joinedAt: new Date(), source: 'start' }],
            status: 'active',
        });
        await meetingThread.save();

        const meetingContent = `__MEETING_STARTED__::${meetingThread._id}::${jitsiRoomName}::${me?.username || 'Unknown'}`;

        // Send exclusively to Rocket.Chat
        if (conversationId) {
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                const otherUserId = conversation.participants.find((p: any) => String(p) !== String(userId));
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

        const chatSync = meetingChatSyncUrlParams(String(userId), String(meetingThread._id));
        const signedUrl = buildSignedJitsiUrl(jitsiRoomName, me, {
            moderator: isMeetingModerator({
                conversationId,
                userId,
                startedBy: userId,
                groupAdminId,
            }),
            guest: false,
            meetingThreadId: String(meetingThread._id),
            chatSyncToken: chatSync.chatSyncToken,
            chatSyncApiBase: chatSync.chatSyncApiBase,
            messengerOrigin: chatSync.messengerOrigin,
        });
        return res.status(200).json({
            meetingThreadId: meetingThread._id,
            jitsiRoomName,
            jitsiUrl: signedUrl,
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
        const { userId } = req.user;
        const { meetingThreadId } = req.body;
        if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });

        const meeting = await MeetingThread.findById(meetingThreadId).populate('startedBy');
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        await expireStaleMeetingIfNeeded(meeting);
        if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting already ended' });
        const lastParticipantLeaving = isLastParticipantEndReason(req.body?.endReason);
        const access = await requireMeetingAccess(meeting, String(userId));
        if (!access.allowed) return res.status(403).json({ error: access.error || 'You do not have access to this meeting' });
        if (!lastParticipantLeaving && !access.moderator) {
            return res.status(403).json({
                error: 'Only meeting moderators can end the meeting while others may still be in the call',
            });
        }

        await markMeetingEnded(meeting);

        const endContent = `__MEETING_ENDED__::${meetingThreadId}::${meeting.duration}::${meeting.participants.length}`;
        const me = meeting.startedBy;
        await sendMeetingEndedToRocketChat(meeting, endContent);

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
        if (await expireStaleMeetingIfNeeded(meeting)) {
            return res.status(400).json({ error: 'Meeting is no longer active' });
        }
        const access = await requireMeetingAccess(meeting, String(userId));
        if (!access.allowed) return res.status(403).json({ error: access.error || 'You do not have access to this meeting' });
        if (!hasJoinedMeeting(meeting, String(userId))) {
            return res.status(403).json({ error: 'Only joined meeting participants can add transcript messages' });
        }

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

const MAX_MEETING_CHAT_BODY = 3000;
const MAX_MEETING_CHAT_AUTHOR = 80;

function sanitizeMeetingChatBody(raw: unknown): string {
    const t = wlHtmlToPlainTextForRocketChat(String(raw ?? ''));
    const trimmed = t.trim();
    if (!trimmed) return '';
    return trimmed.length > MAX_MEETING_CHAT_BODY ? trimmed.slice(0, MAX_MEETING_CHAT_BODY) : trimmed;
}

/**
 * POST /api/meeting/chat-sync
 * Mirror an in-call line into Rocket.Chat (parent DM or group) and append Mongo transcript.
 * Auth: WisdomLinked session cookie, or `Authorization: Bearer <meeting chat JWT>` from the Jitsi tab.
 * Body: { meetingThreadId, content }
 */
export const syncMeetingChatMessage = async (req: any, res: Response) => {
    try {
        const claims = req.meetingChatClaims as MeetingChatTokenClaims | undefined;
        const meetingThreadId = String(req.body?.meetingThreadId || '').trim();
        const rawContent = req.body?.content;

        if (!meetingThreadId || rawContent == null || String(rawContent).trim() === '') {
            return res.status(400).json({ error: 'meetingThreadId and content are required' });
        }
        if (claims && String(claims.mid) !== meetingThreadId) {
            return res.status(400).json({ error: 'meetingThreadId does not match token' });
        }

        const meeting = await MeetingThread.findById(meetingThreadId);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (await expireStaleMeetingIfNeeded(meeting)) {
            return res.status(400).json({ error: 'Meeting is no longer active' });
        }
        if (meeting.status !== 'active') {
            return res.status(400).json({ error: 'Meeting is no longer active' });
        }

        const isGuest = claims?.typ === 'guest-meeting-chat';
        let wlUserId: string | null = null;
        let author = '';
        let rateKey = '';
        let posterForRc: { username: string; email: string } | null = null;

        if (isGuest && claims.typ === 'guest-meeting-chat') {
            rateKey = `g:${claims.inv}:${meetingThreadId}`;
            const inv = await MeetingGuestInvite.findById(claims.inv).lean();
            if (!inv || String(inv.meetingThreadId) !== String(meeting._id)) {
                return res.status(403).json({ error: 'Invite is not valid for this meeting' });
            }
            if (inv.revokedAt || new Date(inv.expiresAt).getTime() <= Date.now()) {
                return res.status(403).json({ error: 'Invite is no longer valid' });
            }
            author = String(claims.nm || 'Guest').trim().slice(0, MAX_MEETING_CHAT_AUTHOR) || 'Guest';
        } else {
            wlUserId = claims?.typ === 'wl-meeting-chat' ? String(claims.sub) : String(req.user?.userId || '');
            if (!wlUserId) return res.status(401).json({ error: 'Unauthorized' });
            rateKey = `u:${wlUserId}:${meetingThreadId}`;
            const access = await requireMeetingAccess(meeting, wlUserId);
            if (!access.allowed) return res.status(403).json({ error: access.error || 'You do not have access to this meeting' });
            if (isRemovedFromMeeting(meeting, wlUserId)) {
                return res.status(403).json({ error: 'You were removed from this meeting' });
            }
            if (!hasJoinedMeeting(meeting, wlUserId)) {
                return res.status(403).json({ error: 'Only joined meeting participants can sync meeting chat' });
            }
            const me = await User.findById(wlUserId).select('email username').lean();
            if (!me?.email) return res.status(400).json({ error: 'User profile incomplete' });
            author =
                wlDisplayName(me as any).trim().slice(0, MAX_MEETING_CHAT_AUTHOR) ||
                String(me.username || '').trim().slice(0, MAX_MEETING_CHAT_AUTHOR) ||
                'Member';
            posterForRc = { username: String(me.username), email: String(me.email) };
        }

        if (!allowMeetingChatRate(rateKey, MEETING_CHAT_SYNC_RL_MAX, MEETING_CHAT_SYNC_RL_WINDOW_MS)) {
            return res.status(429).json({ error: 'Too many meeting chat sync requests; try again shortly' });
        }

        const msg = sanitizeMeetingChatBody(rawContent);
        if (!msg) return res.status(400).json({ error: 'content is empty after sanitization' });

        const rcLine = encodeMeetingChatLine(String(meeting._id), { v: 1, author, guest: isGuest, msg });
        let rcMessageId: string | null = null;

        if (meeting.conversationId) {
            const conversation = await Conversation.findById(meeting.conversationId);
            if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
            const partIds = (conversation.participants || []).map((p: any) => String(p));
            const ua = partIds[0] ? await User.findById(partIds[0]).select('email username').lean() : null;
            const ub = partIds[1] ? await User.findById(partIds[1]).select('email username').lean() : null;
            if (!ua?.email || !ub?.email) return res.status(500).json({ error: 'Could not resolve conversation participants' });
            const rcChannelId = await getOrCreateDMChannel(
                toRocketChatUsername(ua.email),
                toRocketChatUsername(ub.email),
            );
            if (rcChannelId) {
                if (isGuest) {
                    rcMessageId = await sendMessageToRC(rcChannelId, rcLine, `Meet · ${author}`, undefined);
                } else if (posterForRc?.email) {
                    rcMessageId = await sendMessageToRC(
                        rcChannelId,
                        rcLine,
                        posterForRc.username,
                        posterForRc.email,
                    );
                }
            }
        } else if (meeting.groupChatId) {
            const groupChat = await GroupChat.findById(meeting.groupChatId)
                .populate('participants', 'email')
                .populate('admin', 'email');
            if (!groupChat) return res.status(404).json({ error: 'Group chat not found' });
            const emails: string[] = [];
            for (const p of groupChat.participants || []) {
                if ((p as any)?.email) emails.push(String((p as any).email).toLowerCase());
            }
            const adm = groupChat.admin as any;
            if (adm?.email) emails.push(String(adm.email).toLowerCase());
            const rcChannelId = await syncRocketGroupChannelMembers(String(meeting.groupChatId), emails);
            if (rcChannelId) {
                if (isGuest) {
                    rcMessageId = await sendMessageToRC(rcChannelId, rcLine, `Meet · ${author}`, undefined);
                } else if (posterForRc?.email) {
                    rcMessageId = await sendMessageToRC(
                        rcChannelId,
                        rcLine,
                        posterForRc.username,
                        posterForRc.email,
                    );
                }
            }
        }

        if (!rcMessageId) {
            return res.status(502).json({ error: 'Could not post meeting chat to messenger' });
        }

        if (!isGuest && wlUserId && !meeting.participants.some((p: any) => p.toString() === wlUserId)) {
            meeting.participants.push(wlUserId);
        }

        const transcriptEntry: { author?: any; authorName: string; content: string; createdAt: Date } = {
            authorName: author,
            content: msg,
            createdAt: new Date(),
        };
        if (!isGuest && wlUserId) transcriptEntry.author = wlUserId;
        meeting.transcript.push(transcriptEntry);
        await meeting.save();

        return res.status(200).json({ success: true, messageId: rcMessageId });
    } catch (err: any) {
        console.error('[meeting.chat-sync]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/meeting/:meetingThreadId
 * Get a meeting thread with its full transcript.
 */
export const getMeetingThread = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId } = req.params;

        const rawMeeting = await MeetingThread.findById(meetingThreadId).select(
            'jitsiRoomName status conversationId groupChatId removedParticipants participants startedBy delegatedModerators startedAt endedAt duration lastHeartbeatAt lastReportedRemoteCount',
        );
        if (!rawMeeting) return res.status(404).json({ error: 'Meeting not found' });
        await expireStaleMeetingIfNeeded(rawMeeting);
        await reconcileStaleActiveMeetingFromHeartbeat(rawMeeting);
        const access = await requireMeetingAccess(rawMeeting, String(userId));
        if (!access.allowed) return res.status(403).json({ error: access.error || 'You do not have access to this meeting' });

        const meeting = await MeetingThread.findById(meetingThreadId)
            .populate('startedBy', 'username _id image role')
            .populate('participants', 'username _id image role')
            .populate('delegatedModerators', 'username _id image role')
            .populate('transcript.author', 'username _id image role');

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
        await expireStaleMeetingIfNeeded(meeting);
        const targetId = resolveMeetingRatingTargetUserId(meeting, String(userId));
        const hasPresence = !!targetId && hasJoinedMeeting(meeting, String(userId)) && hasJoinedMeeting(meeting, String(targetId));
        const existing = (meeting.ratings || []).find(
            (r: any) => String(r?.rater?._id ?? r?.rater) === String(userId),
        );
        const targetUser =
            targetId && (meeting.participants || []).find((p: any) => String(p?._id) === String(targetId)) ||
            (targetId && String(meeting.startedBy?._id) === String(targetId) ? meeting.startedBy : null);
        return res.status(200).json({
            success: true,
            canRate: meeting.status === 'ended' && !!targetId && hasPresence,
            ratingBlockedReason:
                meeting.status !== 'ended'
                    ? 'Meeting must be ended before rating'
                    : !targetId
                      ? 'You cannot rate this meeting'
                      : !hasPresence
                        ? 'Both users must join the Jitsi call before rating'
                        : '',
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
        await expireStaleMeetingIfNeeded(meeting);
        if (meeting.status !== 'ended') return res.status(400).json({ error: 'Meeting must be ended before rating' });
        const targetId = resolveMeetingRatingTargetUserId(meeting, String(userId));
        if (!targetId) return res.status(403).json({ error: 'You cannot rate this meeting' });
        if (!hasJoinedMeeting(meeting, String(userId)) || !hasJoinedMeeting(meeting, String(targetId))) {
            return res.status(403).json({ error: 'Both users must join the Jitsi call before rating' });
        }

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

const hashInviteToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * POST /api/meeting/guest-invite
 * Body: { meetingThreadId, ttlHours? } -> { inviteUrl, expiresAt }
 */
export const createMeetingGuestInvite = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId, ttlHours } = req.body || {};
        if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });
        const meeting = await MeetingThread.findById(meetingThreadId);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        await expireStaleMeetingIfNeeded(meeting);
        if (meeting.status !== 'active') return res.status(400).json({ error: 'Guest invites are only allowed for active meetings' });
        const isParticipant = (meeting.participants || []).some((p: any) => String(p) === String(userId));
        if (!isParticipant) return res.status(403).json({ error: 'Only meeting participants can create guest invites' });
        const maxHours = 2;
        const finalHours = Math.max(1, Math.min(maxHours, Number(ttlHours) || 2));
        const expiresAt = new Date(Date.now() + finalHours * 60 * 60 * 1000);
        const rawToken = crypto.randomBytes(24).toString('hex');
        const tokenHash = hashInviteToken(rawToken);

        await MeetingGuestInvite.create({
            meetingThreadId,
            invitedBy: userId,
            tokenHash,
            expiresAt,
        });

        const base = resolvePublicAppBaseUrl(String(FRONTEND_BASE_URL || ''), {
            origin: String(req.get?.('origin') || ''),
            host: String(req.get?.('host') || ''),
            xForwardedHost: String(req.get?.('x-forwarded-host') || ''),
            xForwardedProto: String(req.get?.('x-forwarded-proto') || ''),
        });
        const inviteUrl = buildMeetingInviteUrl(base, rawToken);
        return res.status(200).json({
            success: true,
            inviteUrl,
            expiresAt,
            ttlHours: finalHours,
        });
    } catch (err: any) {
        console.error('[meeting.createGuestInvite]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/meeting/guest-invite/:token
 * Public endpoint to resolve a guest invite.
 */
export const resolveMeetingGuestInvite = async (req: Request, res: Response) => {
    try {
        const rawToken = String((req.params as any).token || '').trim();
        if (!rawToken) return res.status(400).json({ error: 'token is required' });
        const tokenHash = hashInviteToken(rawToken);
        const invite = await MeetingGuestInvite.findOne({ tokenHash }).lean();
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.revokedAt) return res.status(410).json({ error: 'Invite is no longer valid' });
        if (new Date(invite.expiresAt).getTime() <= Date.now()) {
            return res.status(410).json({ error: 'Invite has expired' });
        }
        const meeting = await MeetingThread.findById(invite.meetingThreadId);
        if (meeting) await expireStaleMeetingIfNeeded(meeting);
        if (!meeting || meeting.status !== 'active') {
            return res.status(410).json({ error: 'Meeting is no longer active' });
        }
        const guestIdentity = {
            username: 'Guest participant',
            email: '',
            image: '',
            _id: `guest-${String(invite._id)}`,
        };
        const inviteExpSec = Math.max(120, Math.floor((new Date(invite.expiresAt).getTime() - Date.now()) / 1000));
        const chatSync = meetingChatSyncUrlParams(undefined, String(invite.meetingThreadId), {
            inviteId: String(invite._id),
            displayName: guestIdentity.username,
            expiresInSeconds: inviteExpSec,
        });
        const jitsiUrl = buildSignedJitsiUrl(String(meeting.jitsiRoomName), guestIdentity, {
            guest: true,
            moderator: false,
            expiresInSeconds: Math.max(5 * 60, inviteExpSec),
            meetingThreadId: String(invite.meetingThreadId),
            chatSyncToken: chatSync.chatSyncToken,
            chatSyncApiBase: chatSync.chatSyncApiBase,
            messengerOrigin: chatSync.messengerOrigin,
        });
        return res.status(200).json({
            success: true,
            jitsiUrl,
            expiresAt: invite.expiresAt,
            loginUrl: '/login',
        });
    } catch (err: any) {
        console.error('[meeting.resolveGuestInvite]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/meeting/guest-invite/:token/join
 * Authenticated endpoint: join a meeting using a guest invite token, but with the user's real identity.
 *
 * This is used to ensure "Login for full experience" lands in the meeting (not dashboard),
 * and to auto-enter the meeting when a logged-in user opens an invite link.
 */
export const joinMeetingFromGuestInvite = async (req: any, res: Response) => {
    try {
        const { userId } = req.user || {};
        const rawToken = String((req.params as any).token || '').trim();
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!rawToken) return res.status(400).json({ error: 'token is required' });

        const tokenHash = hashInviteToken(rawToken);
        const invite = await MeetingGuestInvite.findOne({ tokenHash }).lean();
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.revokedAt) return res.status(410).json({ error: 'Invite is no longer valid' });
        if (new Date(invite.expiresAt).getTime() <= Date.now()) {
            return res.status(410).json({ error: 'Invite has expired' });
        }

        const meeting = await MeetingThread.findById(invite.meetingThreadId).select(
            'jitsiRoomName status conversationId groupChatId removedParticipants joinEvents participants startedBy delegatedModerators startedAt endedAt duration',
        );
        if (!meeting || meeting.status !== 'active') {
            return res.status(410).json({ error: 'Meeting is no longer active' });
        }
        if (await expireStaleMeetingIfNeeded(meeting)) {
            return res.status(410).json({ error: 'Meeting is no longer active' });
        }
        if (isRemovedFromMeeting(meeting, String(userId))) {
            return res.status(403).json({ error: 'You were removed from this active call by a moderator' });
        }

        const me = await User.findById(userId).select('_id username email image');
        if (!me) return res.status(404).json({ error: 'User not found' });

        const chatSync = meetingChatSyncUrlParams(String(userId), String(invite.meetingThreadId));
        const jitsiUrl = buildSignedJitsiUrl(String(meeting.jitsiRoomName), me, {
            // Guest-invite token is the authorization gate for this path.
            // Any authenticated account with a valid invite joins as participant.
            moderator: false,
            guest: false,
            meetingThreadId: String(invite.meetingThreadId),
            chatSyncToken: chatSync.chatSyncToken,
            chatSyncApiBase: chatSync.chatSyncApiBase,
            messengerOrigin: chatSync.messengerOrigin,
        });

        meeting.joinEvents = Array.isArray(meeting.joinEvents) ? meeting.joinEvents : [];
        meeting.joinEvents.push({
            userId: me._id,
            joinedAt: new Date(),
            source: 'guest-invite',
        });
        if (!Array.isArray(meeting.participants)) {
            meeting.participants = [];
        }
        if (!meeting.participants.some((p: any) => normalizeId(p) === normalizeId(me._id))) {
            meeting.participants.push(me._id);
        }
        await meeting.save();

        return res.status(200).json({
            success: true,
            meetingThreadId: String(invite.meetingThreadId),
            jitsiRoomName: String(meeting.jitsiRoomName),
            role: 'participant',
            jitsiUrl,
        });
    } catch (err: any) {
        console.error('[meeting.joinFromGuestInvite]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/meeting/:meetingThreadId/join
 * Return signed Jitsi URL for authenticated participants.
 */
export const getMeetingJoinInfo = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId } = req.params;
        if (!meetingThreadId) return res.status(400).json({ error: 'meetingThreadId is required' });
        const meeting = await MeetingThread.findById(meetingThreadId).select(
            'jitsiRoomName status conversationId groupChatId removedParticipants joinEvents participants startedBy delegatedModerators startedAt endedAt duration',
        );
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (await expireStaleMeetingIfNeeded(meeting)) {
            return res.status(400).json({ error: 'Meeting is no longer active' });
        }
        if (meeting.status !== 'active') return res.status(400).json({ error: 'Meeting is no longer active' });
        if (isRemovedFromMeeting(meeting, String(userId))) {
            return res.status(403).json({ error: 'You were removed from this active call by a moderator' });
        }

        const me = await User.findById(userId).select('_id username email image');
        if (!me) return res.status(404).json({ error: 'User not found' });

        const auth = await canUserJoinMeeting(meeting, String(userId));
        if (!auth.allowed) return res.status(403).json({ error: 'You do not have access to this meeting' });
        const chatSync = meetingChatSyncUrlParams(String(userId), meetingThreadId);
        const jitsiUrl = buildSignedJitsiUrl(String(meeting.jitsiRoomName), me, {
            moderator: auth.moderator,
            guest: false,
            meetingThreadId: String(meetingThreadId),
            chatSyncToken: chatSync.chatSyncToken,
            chatSyncApiBase: chatSync.chatSyncApiBase,
            messengerOrigin: chatSync.messengerOrigin,
        });
        meeting.joinEvents = Array.isArray(meeting.joinEvents) ? meeting.joinEvents : [];
        meeting.joinEvents.push({
            userId: me._id,
            joinedAt: new Date(),
            source: 'join-link',
        });
        if (!Array.isArray(meeting.participants)) {
            meeting.participants = [];
        }
        if (!meeting.participants.some((p: any) => normalizeId(p) === normalizeId(me._id))) {
            meeting.participants.push(me._id);
        }
        await meeting.save();
        return res.status(200).json({
            success: true,
            meetingThreadId,
            jitsiRoomName: meeting.jitsiRoomName,
            role: auth.moderator ? 'moderator' : 'participant',
            jitsiUrl,
        });
    } catch (err: any) {
        console.error('[meeting.joinInfo]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/meeting/revoke-participant
 * Body: { meetingThreadId, targetUserId, reason? }
 */
export const revokeMeetingParticipant = async (req: any, res: Response) => {
    try {
        const { userId } = req.user;
        const { meetingThreadId, targetUserId, reason } = req.body || {};
        if (!meetingThreadId || !targetUserId) {
            return res.status(400).json({ error: 'meetingThreadId and targetUserId are required' });
        }
        const meeting = await MeetingThread.findById(meetingThreadId).select(
            'status groupChatId conversationId removedParticipants participants startedBy delegatedModerators',
        );
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (meeting.status !== 'active') return res.status(400).json({ error: 'Meeting is not active' });

        const auth = await canUserJoinMeeting(meeting, String(userId));
        if (!auth.moderator) {
            return res.status(403).json({ error: 'Only moderators can revoke participant call access' });
        }
        if (String(targetUserId) === String(userId)) {
            return res.status(400).json({ error: 'Moderator cannot revoke own access' });
        }
        const targetIsEligible = await canUserJoinMeeting(meeting, String(targetUserId));
        if (!targetIsEligible.allowed) {
            return res.status(400).json({ error: 'Target user is not eligible for this meeting' });
        }
        meeting.removedParticipants = Array.isArray(meeting.removedParticipants) ? meeting.removedParticipants : [];
        if (!isRemovedFromMeeting(meeting, String(targetUserId))) {
            meeting.removedParticipants.push({
                userId: targetUserId,
                removedBy: userId,
                removedAt: new Date(),
                reason: String(reason || '').trim(),
            });
            if (Array.isArray(meeting.delegatedModerators) && meeting.delegatedModerators.length > 0) {
                meeting.delegatedModerators = meeting.delegatedModerators.filter(
                    (id: any) => normalizeId(id) !== normalizeId(targetUserId),
                );
            }
            await meeting.save();
        }

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('[meeting.revokeParticipant]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/** Whether user is moderator by policy (starter / group admin only), excluding delegatedModerators array. */
const isCanonicalMeetingModerator = async (meeting: any, userId: string): Promise<boolean> => {
    const uid = normalizeId(userId);
    if (!meeting || !uid) return false;
    if (meeting.conversationId) {
        return isMeetingModerator({
            conversationId: meeting.conversationId,
            userId: uid,
            startedBy: meeting.startedBy,
        });
    }
    if (meeting.groupChatId) {
        const groupChat = await GroupChat.findById(meeting.groupChatId).select('admin').lean();
        return isMeetingModerator({
            userId: uid,
            groupAdminId: normalizeId(groupChat?.admin),
        });
    }
    return false;
};

/**
 * POST /api/meeting/delegate-moderator
 * Body: { meetingThreadId, targetUserId }
 *
 * Gives target moderator privileges for our signed join URLs (JWT), on re-join after promotion.
 * Any current moderator (starter / admin / delegated) may delegate.
 */
export const delegateMeetingModerator = async (req: any, res: Response) => {
    try {
        const { userId } = req.user || {};
        const { meetingThreadId, targetUserId } = req.body || {};
        if (!meetingThreadId || !targetUserId) {
            return res.status(400).json({ error: 'meetingThreadId and targetUserId are required' });
        }
        const meeting = await MeetingThread.findById(meetingThreadId).select(
            'status conversationId groupChatId removedParticipants delegatedModerators startedBy',
        );
        if (!meeting || meeting.status !== 'active') {
            return res.status(400).json({ error: 'Meeting is not active' });
        }
        if (isRemovedFromMeeting(meeting, String(userId))) {
            return res.status(403).json({ error: 'You cannot modify roles while removed from this call' });
        }
        const callerAuth = await canUserJoinMeeting(meeting, String(userId));
        if (!callerAuth.moderator) {
            return res.status(403).json({ error: 'Only moderators can grant moderator access' });
        }
        const targetUid = normalizeId(targetUserId);
        if (!targetUid || targetUid === normalizeId(userId)) {
            return res.status(400).json({ error: 'Invalid target user' });
        }
        const targetAuth = await canUserJoinMeeting(meeting, targetUid);
        if (!targetAuth.allowed) {
            return res.status(400).json({ error: 'Target user is not eligible for this meeting' });
        }
        if (await isCanonicalMeetingModerator(meeting, targetUid)) {
            return res.status(400).json({ error: 'Meeting host is already the moderator for this meeting' });
        }

        meeting.delegatedModerators = Array.isArray(meeting.delegatedModerators) ? meeting.delegatedModerators : [];
        const already = meeting.delegatedModerators.some((id: any) => normalizeId(id) === targetUid);
        if (!already) meeting.delegatedModerators.push(targetUserId);
        await meeting.save();

        return res.status(200).json({ success: true, delegatedModeratorIds: delegatedIdsFromMeeting(meeting) });
    } catch (err: any) {
        console.error('[meeting.delegateModerator]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/meeting/revoke-delegate-moderator
 * Body: { meetingThreadId, targetUserId }
 */
export const revokeDelegatedMeetingModerator = async (req: any, res: Response) => {
    try {
        const { userId } = req.user || {};
        const { meetingThreadId, targetUserId } = req.body || {};
        if (!meetingThreadId || !targetUserId) {
            return res.status(400).json({ error: 'meetingThreadId and targetUserId are required' });
        }
        const meeting = await MeetingThread.findById(meetingThreadId).select(
            'status conversationId groupChatId removedParticipants delegatedModerators startedBy',
        );
        if (!meeting || meeting.status !== 'active') {
            return res.status(400).json({ error: 'Meeting is not active' });
        }
        if (isRemovedFromMeeting(meeting, String(userId))) {
            return res.status(403).json({ error: 'You cannot modify roles while removed from this call' });
        }
        const callerAuth = await canUserJoinMeeting(meeting, String(userId));
        if (!callerAuth.moderator) {
            return res.status(403).json({ error: 'Only moderators can revoke delegated moderator access' });
        }

        const targetUid = normalizeId(targetUserId);
        if (await isCanonicalMeetingModerator(meeting, targetUid)) {
            return res.status(400).json({ error: 'Cannot revoke moderator role from the meeting host' });
        }
        const delegated = delegatedIdsFromMeeting(meeting);
        if (!delegated.includes(targetUid)) {
            return res.status(400).json({ error: 'User is not a delegated moderator' });
        }

        meeting.delegatedModerators = (Array.isArray(meeting.delegatedModerators) ? meeting.delegatedModerators : [])
            .filter((id: any) => normalizeId(id) !== targetUid);
        await meeting.save();

        return res.status(200).json({ success: true, delegatedModeratorIds: delegatedIdsFromMeeting(meeting) });
    } catch (err: any) {
        console.error('[meeting.revokeDelegatedModerator]', err.message);
        return res.status(500).json({ error: err.message });
    }
};
