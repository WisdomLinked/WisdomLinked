/**
 * Rocket.Chat integration — who is “admin” and why
 * -------------------------------------------------
 * The RC **bot/admin account** (ROCKETCHAT_ADMIN_USER / ROCKETCHAT_ADMIN_PASS) is only for
 * operations that **must** run as a server operator:
 *   - Create/sync WL users in RC (`users.create`, `users.info`)
 *   - Issue **per-user** login tokens (`users.createToken` + CREATE_TOKENS_FOR_USERS_SECRET)
 *   - Create DM rooms (`dm.create`) and app-owned channels (`channels.create`)
 *
 * **Everything that should behave like WhatsApp** (see your own messages, IM history, send as
 * yourself, typing, read state tied to *you*) must use **that user’s** RC session:
 *   - REST: `generateUserToken` → user `X-Auth-Token` + `X-User-Id` (see `sendMessageToRC`, `getRCIMHistory`, `getRCGroupHistory`)
 *   - Browser: WebSocket login with the token from `GET /api/chat/rc-token` (same user)
 *
 * Do **not** expect the admin user to see arbitrary users’ DMs or private data — RC forbids it.
 * Read receipts / delivered UI in the product come from RC message fields + realtime streams;
 * wire extra DDP subs (e.g. user notifications) if you want double-tick parity with RC mobile.
 */
import axios from 'axios';

const User = require('../models/User');

const RC_URL = process.env.ROCKETCHAT_URL || 'https://chat.wisdomlinked.com';
const RC_USER = process.env.ROCKETCHAT_ADMIN_USER || '';
const RC_PASS = process.env.ROCKETCHAT_ADMIN_PASS || '';

/** Must match Rocket.Chat `CREATE_TOKENS_FOR_USERS_SECRET` (RC 8+). See users.createToken API. */
const rcCreateTokensSecret = (): string =>
    (process.env.ROCKETCHAT_CREATE_TOKENS_SECRET || process.env.CREATE_TOKENS_FOR_USERS_SECRET || '').trim();

let adminAuthToken = '';
let adminUserId = '';

const getAdminAuthHeaders = async () => {
    if (adminAuthToken && adminUserId) {
        return {
            'X-Auth-Token': adminAuthToken,
            'X-User-Id': adminUserId,
            'Content-Type': 'application/json'
        };
    }

    try {
        const res = await axios.post(`${RC_URL}/api/v1/login`, {
            user: RC_USER,
            password: RC_PASS
        });
        
        if (res.data.status === 'success') {
            adminAuthToken = res.data.data.authToken;
            adminUserId = res.data.data.userId;
            return {
                'X-Auth-Token': adminAuthToken,
                'X-User-Id': adminUserId,
                'Content-Type': 'application/json'
            };
        }
        throw new Error('Failed to login to Rocket.Chat as admin');
    } catch (err) {
        console.error('Rocket.Chat Admin Login Error:', err.message);
        throw err;
    }
};

/**
 * Rocket.Chat rejects display names as usernames (spaces, etc.).
 * Build a stable, valid username from the WisdomLinked email.
 */
export const toRocketChatUsername = (email: string | undefined | null): string => {
    if (!email || typeof email !== 'string') {
        return `wl_${Math.random().toString(36).slice(2, 12)}`;
    }
    const trimmed = email.trim().toLowerCase();
    const at = trimmed.lastIndexOf('@');
    const sanitize = (s: string) => s.replace(/[^a-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    let combined: string;
    if (at <= 0) {
        combined = sanitize(trimmed) || 'wl_user';
    } else {
        const local = sanitize(trimmed.slice(0, at));
        const domain = sanitize(trimmed.slice(at + 1));
        combined = `${local}_${domain}`.replace(/_+/g, '_').replace(/^_|_$/g, '') || 'wl_user';
    }
    if (combined.length < 3) {
        combined = `${combined}_wl`;
    }
    if (/^[0-9._-]/.test(combined)) {
        combined = `u_${combined}`;
    }
    return combined.slice(0, 32);
};

const persistRocketChatUsername = async (email: string, rcUsername: string) => {
    try {
        await User.findOneAndUpdate({ email }, { $set: { rocketChatUsername: rcUsername } }).exec();
    } catch (e: any) {
        console.warn('Could not persist rocketChatUsername:', e.message);
    }
};

// ── User Management ─────────────────────────────────────────

export const syncUserToRocketChat = async (userData: { email: string; username: string; name: string; password?: string }) => {
    const rcUsername = toRocketChatUsername(userData.email);
    const displayName = userData.name || userData.username;

    try {
        const headers = await getAdminAuthHeaders();
        
        // 1. Check if user already exists
        try {
            const checkRes = await axios.get(
                `${RC_URL}/api/v1/users.info?username=${encodeURIComponent(rcUsername)}`,
                { headers }
            );
            if (checkRes.data.success && checkRes.data.user) {
                await persistRocketChatUsername(userData.email, rcUsername);
                return checkRes.data.user._id;
            }
        } catch (e: any) {
            // 400 error usually means user doesn't exist, which is fine
        }

        // 2. Create the user
        const createRes = await axios.post(`${RC_URL}/api/v1/users.create`, {
            email: userData.email,
            name: displayName,
            password: userData.password || Math.random().toString(36).slice(-10) + 'A1!',
            username: rcUsername,
            verified: true,
            joinDefaultChannels: true
        }, { headers });

        if (createRes.data.success) {
            console.log(`Successfully synced user ${rcUsername} (${userData.email}) to Rocket.Chat`);
            await persistRocketChatUsername(userData.email, rcUsername);
            return createRes.data.user._id;
        }
    } catch (err: any) {
        if (err.response?.data?.errorType === 'error-field-unavailable') {
            console.log(`User ${rcUsername} or email ${userData.email} already exists in Rocket.Chat`);
        } else {
            console.error('Failed to sync user to Rocket.Chat:', err.response?.data || err.message);
        }
    }
    return null;
};

type WlUserForRcSync = { email?: string | null; username?: string | null } | null | undefined;

/**
 * Create/update both WisdomLinked users in Rocket.Chat before dm.create / im.history / chat.sendMessage.
 * Prevents "messages visible in chat.example.com but empty in WL for one side" when that user never logged in via WL auth sync.
 */
export const ensureBothWlUsersSyncedToRocketChat = async (
    a: WlUserForRcSync,
    b: WlUserForRcSync
): Promise<void> => {
    const syncOne = async (u: NonNullable<WlUserForRcSync>) => {
        const email = typeof u.email === 'string' ? u.email.trim() : '';
        if (!email) return;
        const rid = await syncUserToRocketChat({
            email,
            username: (typeof u.username === 'string' && u.username.trim()) || email.split('@')[0] || 'user',
            name: (typeof u.username === 'string' && u.username.trim()) || email.split('@')[0] || 'User',
        });
        if (!rid) {
            console.warn('[RC] ensureBothWlUsersSyncedToRocketChat: no RC user id for', email);
        }
    };
    if (a) await syncOne(a);
    if (b) await syncOne(b);
};

export const getRocketAuthToken = async (userId: string) => {
    const secret = rcCreateTokensSecret();
    if (!secret) {
        console.error(
            'getRocketAuthToken: set ROCKETCHAT_CREATE_TOKENS_SECRET (same as Rocket.Chat CREATE_TOKENS_FOR_USERS_SECRET).'
        );
        return null;
    }
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(`${RC_URL}/api/v1/users.createToken`, { userId, secret }, { headers });

        if (res.data.success) {
            return res.data.data.authToken;
        }
    } catch (err: any) {
        console.error('Failed to get RC token:', err.response?.data || err.message);
    }
    return null;
};

/** Look up a RC user by their WL username. Returns RC userId or null. */
export const getRCUserIdByUsername = async (username: string): Promise<string | null> => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.get(`${RC_URL}/api/v1/users.info?username=${encodeURIComponent(username)}`, { headers });
        if (res.data.success && res.data.user) {
            return res.data.user._id;
        }
    } catch (e: any) { /* user doesn't exist */ }
    return null;
};

// ── DM Channel Management ───────────────────────────────────

/** Create or get a DM channel between two RC usernames. Returns the RC room id. */
export const getOrCreateDMChannel = async (usernameA: string, usernameB: string): Promise<string | null> => {
    try {
        const headers = await getAdminAuthHeaders();
        const [u1, u2] = [usernameA, usernameB].sort((a, b) => a.localeCompare(b));
        const res = await axios.post(`${RC_URL}/api/v1/dm.create`, {
            usernames: `${u1},${u2}`
        }, { headers });

        if (res.data.success && res.data.room) {
            return res.data.room._id;
        }
    } catch (err: any) {
        console.error('Failed to create/get DM channel:', err.response?.data || err.message);
    }
    return null;
};

// ── Group Channel Management ────────────────────────────────

/** Create or get a group channel by name. Returns the RC room id. */
export const getOrCreateGroupChannel = async (channelName: string, memberUsernames: string[]): Promise<string | null> => {
    try {
        const headers = await getAdminAuthHeaders();
        // Try to find existing
        try {
            const infoRes = await axios.get(`${RC_URL}/api/v1/channels.info?roomName=${channelName}`, { headers });
            if (infoRes.data.success && infoRes.data.channel) {
                return infoRes.data.channel._id;
            }
        } catch (e: any) { /* doesn't exist, create it */ }

        const createRes = await axios.post(`${RC_URL}/api/v1/channels.create`, {
            name: channelName,
            members: memberUsernames,
        }, { headers });

        if (createRes.data.success && createRes.data.channel) {
            return createRes.data.channel._id;
        }
    } catch (err: any) {
        // If channel name already exists, try to get it
        if (err.response?.data?.errorType === 'error-duplicate-channel-name') {
            try {
                const headers = await getAdminAuthHeaders();
                const infoRes = await axios.get(`${RC_URL}/api/v1/channels.info?roomName=${channelName}`, { headers });
                if (infoRes.data.success) return infoRes.data.channel._id;
            } catch (e) {}
        }
        console.error('Failed to create/get group channel:', err.response?.data || err.message);
    }
    return null;
};

// ── Messaging ───────────────────────────────────────────────

/**
 * WL Messenger sends Quill HTML (`<p>…</p>`). Rocket.Chat stores `msg` as plain text and does not
 * render HTML in the default client — users would see literal `<p>hello</p>`. Strip to plain text
 * for chat.wisdomlinked.com (and any RC). Meeting / file markers are left unchanged.
 */
export const wlHtmlToPlainTextForRocketChat = (raw: string): string => {
    const s = String(raw ?? '');
    if (!s.trim()) return '';
    if (s.startsWith('__MEETING_') || s.startsWith('__') && s.includes('::')) return s;
    if (s.startsWith('Chatfile:') || s.startsWith('Call Lasted for:') || s.startsWith('Seminar Lasted for:')) {
        return s;
    }
    return s
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

/**
 * Send a message to a RC room. Prefer the sender's own RC session (they are in DMs / groups);
 * admin often lacks permission to post into user DMs on newer Rocket.Chat.
 */
/** @returns Rocket.Chat message `_id` on success (needed for read receipts). */
export const sendMessageToRC = async (
    roomId: string,
    text: string,
    senderUsername: string,
    senderEmail?: string
): Promise<string | null> => {
    const msg = wlHtmlToPlainTextForRocketChat(text);
    if (!msg) return null;

    const email = senderEmail?.trim();
    if (email) {
        try {
            const tok = await generateUserToken({
                email,
                username: senderUsername,
                name: senderUsername,
            });
            if (tok) {
                const userHeaders = {
                    'X-Auth-Token': tok.authToken,
                    'X-User-Id': tok.userId,
                    'Content-Type': 'application/json'
                };
                const res = await axios.post(
                    `${RC_URL}/api/v1/chat.sendMessage`,
                    { message: { rid: roomId, msg } },
                    { headers: userHeaders }
                );
                const mid = res.data?.message?._id;
                if (res.data.success && mid) return String(mid);
            }
        } catch (err: any) {
            console.error('Failed to send message to RC (as user):', err.response?.data || err.message);
        }
    }

    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(`${RC_URL}/api/v1/chat.sendMessage`, {
            message: {
                rid: roomId,
                msg,
                alias: senderUsername,
            }
        }, { headers });
        const mid = res.data?.message?._id;
        if (res.data.success === true && mid) return String(mid);
    } catch (err: any) {
        console.error('Failed to send message to RC (as admin):', err.response?.data || err.message);
    }
    return null;
};

/** Logged-in WisdomLinked user used to open an RC REST session (same shape for DM + channels). */
export type RCParticipantSession = { email: string; username?: string; name?: string };

/** Set `ROCKETCHAT_SKIP_READ_RECEIPTS=true` to disable read-receipt HTTP calls (e.g. OSS RC without the endpoint). */
const skipReadReceiptsApi = (): boolean =>
    String(process.env.ROCKETCHAT_SKIP_READ_RECEIPTS || '').toLowerCase() === 'true';

/**
 * Clear all messages in a room (requires Rocket.Chat permission `clean-room-history` for that user/room).
 * Often only enabled for admins — use {@link purgeRoomMessagesBestEffort} as fallback.
 */
export const cleanRoomHistoryAsUser = async (
    reader: RCParticipantSession,
    roomId: string
): Promise<boolean> => {
    const tok = await generateUserToken(reader);
    if (!tok) return false;
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    const oldest = new Date(0).toISOString();
    const latest = new Date(Date.now() + 60_000).toISOString();
    try {
        const res = await axios.post(
            `${RC_URL}/api/v1/rooms.cleanHistory`,
            {
                roomId: String(roomId),
                oldest,
                latest,
                inclusive: true,
                excludePinned: false,
                filesOnly: false,
                limit: 5000,
            },
            { headers }
        );
        return Boolean(res.data?.success);
    } catch (e: any) {
        console.warn(
            '[cleanRoomHistoryAsUser]',
            roomId,
            e.response?.status,
            e.response?.data?.error || e.message
        );
        return false;
    }
};

/**
 * Read receipts for a message (Rocket.Chat `chat.getMessageReadReceipts`).
 * Many servers return **404** if the endpoint is missing (OSS) or read receipts are off — we never log that.
 */
/** Delete a single message in a room (must be allowed by RC permissions — usually own messages). */
export const deleteMessageAsUser = async (
    reader: RCParticipantSession,
    roomId: string,
    msgId: string
): Promise<boolean> => {
    const tok = await generateUserToken(reader);
    if (!tok) return false;
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    try {
        const res = await axios.post(
            `${RC_URL}/api/v1/chat.delete`,
            { roomId: String(roomId), msgId: String(msgId) },
            { headers }
        );
        return Boolean(res.data?.success);
    } catch (e: any) {
        console.error('[deleteMessageAsUser]', e.response?.data || e.message);
        return false;
    }
};

/**
 * Best-effort: delete messages returned by `im.history` in batches until none succeed.
 * Without `clean-room-history`, users can usually only delete their own messages.
 */
export const purgeRoomMessagesBestEffort = async (
    reader: RCParticipantSession,
    roomId: string,
    maxRounds = 40
): Promise<number> => {
    let deleted = 0;
    for (let round = 0; round < maxRounds; round++) {
        const batch = await getRCIMHistory(roomId, 50, 0, reader);
        if (!Array.isArray(batch) || batch.length === 0) break;
        let anyOk = false;
        for (const m of batch) {
            const id = m?._id;
            if (!id) continue;
            const ok = await deleteMessageAsUser(reader, roomId, String(id));
            if (ok) {
                deleted++;
                anyOk = true;
            }
        }
        if (!anyOk) break;
    }
    return deleted;
};

export const getRCMessageReadReceipts = async (
    messageId: string,
    reader: RCParticipantSession
): Promise<{ receipts: any[] } | null> => {
    if (skipReadReceiptsApi()) return { receipts: [] };
    const tok = await generateUserToken(reader);
    if (!tok) return null;
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    try {
        const res = await axios.get(`${RC_URL}/api/v1/chat.getMessageReadReceipts`, {
            params: { messageId: String(messageId) },
            headers,
        });
        if (res.data?.success && Array.isArray(res.data.receipts)) {
            return { receipts: res.data.receipts };
        }
        return { receipts: [] };
    } catch (e: any) {
        const st = e.response?.status;
        // Missing route / feature off / no permission — do not hit POST (same 404) or spam logs.
        if (st === 404 || st === 403) {
            return { receipts: [] };
        }
    }
    try {
        const res2 = await axios.post(
            `${RC_URL}/api/v1/chat.getMessageReadReceipts`,
            { messageId: String(messageId) },
            { headers }
        );
        if (res2.data?.success && Array.isArray(res2.data.receipts)) {
            return { receipts: res2.data.receipts };
        }
    } catch (e: any) {
        const st = e.response?.status;
        if (st !== 404 && st !== 403 && st !== 400) {
            console.warn('[getRCMessageReadReceipts]', messageId, st, e.response?.data || e.message);
        }
    }
    return { receipts: [] };
};

/**
 * Fetch DM history from Rocket.Chat.
 * Must use a participant's RC session: `im.history` does not return other users' DMs for the admin user.
 */
export const getRCIMHistory = async (
    roomId: string,
    count: number = 20,
    offset: number = 0,
    reader?: RCParticipantSession
) => {
    const email = reader?.email?.trim();
    if (email) {
        try {
            const tok = await generateUserToken({
                email,
                username: reader?.username,
                name: reader?.name || reader?.username || email,
            });
            if (tok) {
                const userHeaders = {
                    'X-Auth-Token': tok.authToken,
                    'X-User-Id': tok.userId,
                    'Content-Type': 'application/json',
                };
                const res = await axios.get(
                    `${RC_URL}/api/v1/im.history?roomId=${encodeURIComponent(roomId)}&count=${count}&offset=${offset}`,
                    { headers: userHeaders }
                );
                if (res.data.success && Array.isArray(res.data.messages)) {
                    return res.data.messages;
                }
            }
        } catch (err: any) {
            console.error('Failed to get IM history (as participant):', err.response?.data || err.message);
        }
    }

    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.get(
            `${RC_URL}/api/v1/im.history?roomId=${encodeURIComponent(roomId)}&count=${count}&offset=${offset}`,
            { headers }
        );
        if (res.data.success && Array.isArray(res.data.messages)) {
            return res.data.messages;
        }
    } catch (err: any) {
        console.error('Failed to get IM history (admin fallback):', err.response?.data || err.message);
    }
    return [];
};

/** Mark the current user's subscription as read (unread badge + read cursor in RC). */
export const markRoomReadAsUser = async (roomId: string, reader: RCParticipantSession): Promise<boolean> => {
    if (!roomId) return false;
    const tok = await generateUserToken(reader);
    if (!tok) return false;
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    const rid = String(roomId);
    try {
        const res = await axios.post(`${RC_URL}/api/v1/subscriptions.read`, { rid }, { headers });
        if (res.data?.success) return true;
    } catch (e: any) {
        console.warn('[markRoomReadAsUser] subscriptions.read:', e.response?.data || e.message);
    }
    try {
        const res2 = await axios.post(`${RC_URL}/api/v1/im.markRead`, { rid }, { headers });
        if (res2.data?.success) return true;
    } catch (e: any) {
        console.warn('[markRoomReadAsUser] im.markRead:', e.response?.data || e.message);
    }
    try {
        const res3 = await axios.post(`${RC_URL}/api/v1/channels.markRead`, { roomId: rid }, { headers });
        return res3.data?.success === true;
    } catch (e: any) {
        console.warn('[markRoomReadAsUser] channels.markRead:', e.response?.data || e.message);
    }
    return false;
};

/**
 * Ensure every WL group participant exists in Rocket.Chat and is in the `wl-group-*` channel.
 */
export const syncRocketGroupChannelMembers = async (
    groupChatId: string,
    participantEmails: string[]
): Promise<string | null> => {
    const uniqueEmails = [
        ...new Set(
            participantEmails
                .map((e) => String(e || '').trim().toLowerCase())
                .filter(Boolean)
        ),
    ];
    if (!uniqueEmails.length) return null;

    const channelName = `wl-group-${groupChatId}`;
    const rcUsernames = uniqueEmails.map((e) => toRocketChatUsername(e));
    const roomId = await getOrCreateGroupChannel(channelName, [rcUsernames[0]]);
    if (!roomId) return null;

    const headers = await getAdminAuthHeaders();
    for (const email of uniqueEmails) {
        const uname = toRocketChatUsername(email);
        let rcUid = await getRCUserIdByUsername(uname);
        if (!rcUid) {
            const wlUser = await User.findOne({ email }).select('email username').lean();
            if (wlUser) {
                await syncUserToRocketChat({
                    email: wlUser.email,
                    username: wlUser.username || wlUser.email,
                    name: wlUser.username || wlUser.email,
                });
                rcUid = await getRCUserIdByUsername(uname);
            }
        }
        if (!rcUid) continue;
        try {
            await axios.post(`${RC_URL}/api/v1/channels.invite`, { roomId, userId: rcUid }, { headers });
        } catch (e: any) {
            const raw = JSON.stringify(e.response?.data || '') + String(e.message || '');
            if (/already-in-room|user-already|already\s+in/i.test(raw)) continue;
        }
    }
    return roomId;
};

/**
 * Fetch channel history as a **member** of the room (preferred).
 * Admin is often not a member of `wl-group-*` channels; history would be empty.
 */
export const getRCGroupHistory = async (
    roomId: string,
    count: number = 20,
    offset: number = 0,
    reader?: RCParticipantSession
) => {
    const email = reader?.email?.trim();
    if (email) {
        try {
            const tok = await generateUserToken({
                email,
                username: reader?.username,
                name: reader?.name || reader?.username || email,
            });
            if (tok) {
                const userHeaders = {
                    'X-Auth-Token': tok.authToken,
                    'X-User-Id': tok.userId,
                    'Content-Type': 'application/json',
                };
                const res = await axios.get(
                    `${RC_URL}/api/v1/channels.history?roomId=${encodeURIComponent(roomId)}&count=${count}&offset=${offset}`,
                    { headers: userHeaders }
                );
                if (res.data.success && Array.isArray(res.data.messages)) {
                    return res.data.messages;
                }
            }
        } catch (err: any) {
            console.error('Failed to get Group history (as participant):', err.response?.data || err.message);
        }
    }

    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.get(
            `${RC_URL}/api/v1/channels.history?roomId=${encodeURIComponent(roomId)}&count=${count}&offset=${offset}`,
            { headers }
        );
        if (res.data.success && Array.isArray(res.data.messages)) {
            return res.data.messages;
        }
    } catch (err: any) {
        console.error('Failed to get Group history (admin fallback):', err.response?.data || err.message);
    }
    return [];
};

// ── Typing Indicator ────────────────────────────────────────

/** Notify RC that a user is typing in a room. */
export const notifyTypingRC = async (roomId: string, username: string, isTyping: boolean): Promise<void> => {
    // RC doesn't have a REST endpoint for typing; this is handled client-side through DDP.
    // This is a no-op placeholder — the frontend handles typing via the RC realtime client.
};

// ── Token for Frontend ──────────────────────────────────────

export type GenerateRcTokenUser = {
    email: string;
    username?: string;
    name?: string;
};

/**
 * Login token for the RC realtime client. Many RC versions require `userId` in
 * users.createToken (not `username`), so we resolve the Rocket.Chat user id first.
 */
export const generateUserToken = async (
    wlUser: string | GenerateRcTokenUser
): Promise<{ authToken: string; userId: string } | null> => {
    const params: GenerateRcTokenUser =
        typeof wlUser === 'string' ? { email: wlUser } : wlUser;
    const email = params.email?.trim();
    if (!email) return null;

    const rcUsername = toRocketChatUsername(email);
    let rcUserId = await getRCUserIdByUsername(rcUsername);

    if (!rcUserId) {
        rcUserId = await syncUserToRocketChat({
            email,
            username: params.username || email,
            name: params.name || params.username || email.split('@')[0] || 'User',
        });
    }

    if (!rcUserId) {
        rcUserId = await getRCUserIdByUsername(rcUsername);
    }

    if (!rcUserId) {
        console.error('Failed to generate RC token: no Rocket.Chat user for', email);
        return null;
    }

    const secret = rcCreateTokensSecret();
    if (!secret) {
        console.error(
            'Rocket.Chat users.createToken requires secret: set ROCKETCHAT_CREATE_TOKENS_SECRET on the backend ' +
                'to the exact same value as CREATE_TOKENS_FOR_USERS_SECRET on the Rocket.Chat server (see RC docs).'
        );
        return null;
    }

    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(
            `${RC_URL}/api/v1/users.createToken`,
            { userId: rcUserId, secret },
            { headers }
        );

        if (res.data.success) {
            return {
                authToken: res.data.data.authToken,
                userId: res.data.data.userId
            };
        }
    } catch (err: any) {
        console.error('Failed to generate user token:', err.response?.data || err.message);
    }
    return null;
};

export { RC_URL };
