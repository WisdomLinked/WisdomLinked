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
import { rcUsernamesWithActiveChatConnection } from '../utils/rocketChatPresence';
import { isMachineRoomLabel, parseGroupChatIdFromRoomName } from '../utils/chatRoomLabels';
import { isRcAuthError } from '../utils/rcSessionErrors';

const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const Conversation = require('../models/Conversation');
const crypto = require('crypto');

const RC_URL = process.env.ROCKETCHAT_URL || 'https://chat.wisdomlinked.com';
const RC_USER = process.env.ROCKETCHAT_ADMIN_USER || '';
const RC_PASS = process.env.ROCKETCHAT_ADMIN_PASS || '';

/** Must match Rocket.Chat `CREATE_TOKENS_FOR_USERS_SECRET` (RC 8+). See users.createToken API. */
const rcCreateTokensSecret = (): string =>
    (process.env.ROCKETCHAT_CREATE_TOKENS_SECRET || process.env.CREATE_TOKENS_FOR_USERS_SECRET || '').trim();

let adminAuthToken = '';
let adminUserId = '';
let adminAuthFetchedAt = 0;

/** Proactively re-login before RC invalidates the cached admin session (default 6h). */
const adminSessionMaxAgeMs = (): number => {
    const hours = Number(process.env.ROCKETCHAT_ADMIN_SESSION_MAX_HOURS || 6);
    if (!Number.isFinite(hours) || hours <= 0) return 6 * 60 * 60 * 1000;
    return hours * 60 * 60 * 1000;
};

const rcDebugEnabled = (): boolean => String(process.env.RC_DEBUG_TRACE || '').toLowerCase() === 'true';
const rcDebug = (...args: any[]) => {
    if (rcDebugEnabled()) console.log('[RC_DEBUG_TRACE]', ...args);
};

const clearAdminAuthCache = (): void => {
    adminAuthToken = '';
    adminUserId = '';
    adminAuthFetchedAt = 0;
};

const isAdminSessionStale = (): boolean => {
    if (!adminAuthToken || !adminAuthFetchedAt) return true;
    return Date.now() - adminAuthFetchedAt >= adminSessionMaxAgeMs();
};

const getAdminAuthHeaders = async (opts?: { force?: boolean }) => {
    if (opts?.force) clearAdminAuthCache();
    else if (adminAuthToken && adminUserId && isAdminSessionStale()) {
        rcDebug('getAdminAuthHeaders:proactive-refresh', {
            ageMs: Date.now() - adminAuthFetchedAt,
            maxMs: adminSessionMaxAgeMs(),
        });
        clearAdminAuthCache();
    }

    if (adminAuthToken && adminUserId) {
        return {
            'X-Auth-Token': adminAuthToken,
            'X-User-Id': adminUserId,
            'Content-Type': 'application/json',
        };
    }

    try {
        const res = await axios.post(`${RC_URL}/api/v1/login`, {
            user: RC_USER,
            password: RC_PASS,
        });

        if (res.data.status === 'success') {
            adminAuthToken = res.data.data.authToken;
            adminUserId = res.data.data.userId;
            adminAuthFetchedAt = Date.now();
            return {
                'X-Auth-Token': adminAuthToken,
                'X-User-Id': adminUserId,
                'Content-Type': 'application/json',
            };
        }
        throw new Error('Failed to login to Rocket.Chat as admin');
    } catch (err) {
        console.error('Rocket.Chat Admin Login Error:', err.message);
        throw err;
    }
};

/** Run an RC admin REST call; refresh admin login once on expired session. */
const withAdminAuth = async <T>(fn: (headers: Record<string, string>) => Promise<T>): Promise<T> => {
    try {
        return await fn(await getAdminAuthHeaders());
    } catch (err) {
        if (isRcAuthError(err)) {
            rcDebug('withAdminAuth:retry-after-auth-error');
            return await fn(await getAdminAuthHeaders({ force: true }));
        }
        throw err;
    }
};

const generateRocketChatPassword = (): string =>
    `${crypto.randomBytes(24).toString('base64url')}A1!`;

/**
 * Rocket.Chat rejects display names as usernames (spaces, etc.).
 * Build a stable, valid username from the WisdomLinked email.
 */
export const toRocketChatUsername = (email: string | undefined | null): string => {
    if (!email || typeof email !== 'string') {
        return 'wl_user';
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
    rcDebug('syncUserToRocketChat:start', { email: userData.email, rcUsername });

    try {
        return await withAdminAuth(async (headers) => {
            // 1. Check if user already exists
            try {
                const checkRes = await axios.get(
                    `${RC_URL}/api/v1/users.info?username=${encodeURIComponent(rcUsername)}`,
                    { headers },
                );
                if (checkRes.data.success && checkRes.data.user) {
                    rcDebug('syncUserToRocketChat:exists', {
                        email: userData.email,
                        rcUsername,
                        rcUserId: checkRes.data.user?._id || null,
                        rcUserName: checkRes.data.user?.username || null,
                    });
                    await persistRocketChatUsername(userData.email, rcUsername);
                    return checkRes.data.user._id;
                }
            } catch (e: any) {
                if (isRcAuthError(e)) throw e;
                rcDebug('syncUserToRocketChat:users.info-miss', {
                    email: userData.email,
                    rcUsername,
                    status: e?.response?.status || null,
                    error: e?.response?.data?.error || e?.message || 'unknown',
                });
            }

            // 2. Create the user
            const createRes = await axios.post(
                `${RC_URL}/api/v1/users.create`,
                {
                    email: userData.email,
                    name: displayName,
                    password: userData.password || generateRocketChatPassword(),
                    username: rcUsername,
                    verified: true,
                    joinDefaultChannels: true,
                },
                { headers },
            );

            if (createRes.data.success) {
                console.log(`Successfully synced user ${rcUsername} (${userData.email}) to Rocket.Chat`);
                rcDebug('syncUserToRocketChat:created', {
                    email: userData.email,
                    rcUsername,
                    rcUserId: createRes.data.user?._id || null,
                    rcUserName: createRes.data.user?.username || null,
                });
                await persistRocketChatUsername(userData.email, rcUsername);
                return createRes.data.user._id;
            }
            return null;
        });
    } catch (err: any) {
        if (err.response?.data?.errorType === 'error-field-unavailable') {
            console.log(`User ${rcUsername} or email ${userData.email} already exists in Rocket.Chat — resolving existing account`);
            rcDebug('syncUserToRocketChat:create-field-unavailable', {
                email: userData.email,
                rcUsername,
                response: err.response?.data || null,
            });
            const existingId =
                (await getRCUserIdByEmail(userData.email)) || (await getRCUserIdByUsername(rcUsername));
            if (existingId) {
                await persistRocketChatUsername(userData.email, rcUsername);
                return existingId;
            }
        } else {
            console.error('Failed to sync user to Rocket.Chat:', err.response?.data || err.message);
            rcDebug('syncUserToRocketChat:create-failed', {
                email: userData.email,
                rcUsername,
                status: err?.response?.status || null,
                response: err?.response?.data || null,
                error: err?.message || 'unknown',
            });
        }
    }
    rcDebug('syncUserToRocketChat:return-null', { email: userData.email, rcUsername });
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
        return await withAdminAuth(async (headers) => {
            const res = await axios.post(`${RC_URL}/api/v1/users.createToken`, { userId, secret }, { headers });
            if (res.data.success) {
                return res.data.data.authToken;
            }
            return null;
        });
    } catch (err: any) {
        console.error('Failed to get RC token:', err.response?.data || err.message);
    }
    return null;
};

/** Look up a RC user by their WL username. Returns RC userId or null. */
export const getRCUserIdByUsername = async (username: string): Promise<string | null> => {
    try {
        return await withAdminAuth(async (headers) => {
            const res = await axios.get(
                `${RC_URL}/api/v1/users.info?username=${encodeURIComponent(username)}`,
                { headers },
            );
            if (res.data.success && res.data.user) {
                return res.data.user._id;
            }
            return null;
        });
    } catch (e: any) {
        if (!isRcAuthError(e)) rcDebug('getRCUserIdByUsername:miss', { username, error: e?.response?.data?.error });
    }
    return null;
};

/** Look up a RC user by email when supported; falls back to email-derived username slug. */
export const getRCUserIdByEmail = async (email: string): Promise<string | null> => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    const slug = toRocketChatUsername(normalized);
    const bySlug = await getRCUserIdByUsername(slug);
    if (bySlug) return bySlug;
    try {
        return await withAdminAuth(async (headers) => {
            const res = await axios.get(
                `${RC_URL}/api/v1/users.info?email=${encodeURIComponent(normalized)}`,
                { headers },
            );
            if (res.data.success && res.data.user) {
                return res.data.user._id;
            }
            return null;
        });
    } catch (e: any) {
        if (!isRcAuthError(e)) rcDebug('getRCUserIdByEmail:miss', { email: normalized });
    }
    return null;
};

/** Ensure the RC admin bot is in a group channel so admin history fallback works. */
const ensureAdminInGroupChannel = async (roomId: string, headers: Record<string, string>): Promise<void> => {
    if (!roomId) return;
    try {
        await getAdminAuthHeaders();
        if (!adminUserId) return;
        await axios.post(`${RC_URL}/api/v1/channels.invite`, { roomId, userId: adminUserId }, { headers });
    } catch (e: any) {
        const raw = JSON.stringify(e.response?.data || '') + String(e.message || '');
        if (/already-in-room|user-already|already\s+in/i.test(raw)) return;
        rcDebug('ensureAdminInGroupChannel:failed', { roomId, error: e?.response?.data || e?.message });
    }
};

// ── DM Channel Management ───────────────────────────────────

/** Create or get a DM channel between two RC usernames. Returns the RC room id. */
export const getOrCreateDMChannel = async (usernameA: string, usernameB: string): Promise<string | null> => {
    try {
        return await withAdminAuth(async (headers) => {
            const [u1, u2] = [usernameA, usernameB].sort((a, b) => a.localeCompare(b));
            rcDebug('getOrCreateDMChannel:start', { usernameA, usernameB, sorted: [u1, u2] });
            const res = await axios.post(
                `${RC_URL}/api/v1/dm.create`,
                { usernames: `${u1},${u2}` },
                { headers },
            );

            if (res.data.success && res.data.room) {
                rcDebug('getOrCreateDMChannel:success', {
                    sorted: [u1, u2],
                    rid: res.data.room?._id || null,
                    userIds: Array.isArray(res.data.room?.userIds) ? res.data.room.userIds : null,
                });
                return res.data.room._id;
            }
            return null;
        });
    } catch (err: any) {
        console.error('Failed to create/get DM channel:', err.response?.data || err.message);
        rcDebug('getOrCreateDMChannel:failed', {
            usernameA,
            usernameB,
            status: err?.response?.status || null,
            response: err?.response?.data || null,
            error: err?.message || 'unknown',
        });
    }
    return null;
};

// ── Group Channel Management ────────────────────────────────

/** Create or get a group channel by name. Returns the RC room id. */
export const getOrCreateGroupChannel = async (channelName: string, memberUsernames: string[]): Promise<string | null> => {
    try {
        return await withAdminAuth(async (headers) => {
            try {
                const infoRes = await axios.get(`${RC_URL}/api/v1/channels.info?roomName=${channelName}`, { headers });
                if (infoRes.data.success && infoRes.data.channel) {
                    return infoRes.data.channel._id;
                }
            } catch (e: any) {
                if (isRcAuthError(e)) throw e;
            }

            const createRes = await axios.post(
                `${RC_URL}/api/v1/channels.create`,
                { name: channelName, members: memberUsernames },
                { headers },
            );

            if (createRes.data.success && createRes.data.channel) {
                return createRes.data.channel._id;
            }
            return null;
        });
    } catch (err: any) {
        if (err.response?.data?.errorType === 'error-duplicate-channel-name') {
            try {
                return await withAdminAuth(async (headers) => {
                    const infoRes = await axios.get(`${RC_URL}/api/v1/channels.info?roomName=${channelName}`, { headers });
                    if (infoRes.data.success) return infoRes.data.channel._id;
                    return null;
                });
            } catch (e) {
                /* fall through */
            }
        }
        console.error('Failed to create/get group channel:', err.response?.data || err.message);
    }
    return null;
};

import { prepareMessageForRocketChat } from '../utils/chatReplyPlainText';
export { wlHtmlToPlainTextForRocketChat } from '../utils/wlHtmlPlainText';

// ── Messaging ───────────────────────────────────────────────

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
    const msg = prepareMessageForRocketChat(text);
    if (!msg) return null;
    rcDebug('sendMessageToRC:start', {
        roomId,
        senderUsername,
        senderEmail: senderEmail || null,
        msgLength: msg.length,
    });

    const email = senderEmail?.trim();
    if (email) {
        try {
            const tok = await generateUserToken({
                email,
                username: senderUsername,
                name: senderUsername,
            });
            if (tok) {
                rcDebug('sendMessageToRC:user-token', {
                    email,
                    tokenUserId: tok.userId,
                    roomId,
                });
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
                if (res.data.success && mid) {
                    rcDebug('sendMessageToRC:user-success', { roomId, mid, tokenUserId: tok.userId });
                    return String(mid);
                }
                rcDebug('sendMessageToRC:user-no-mid', {
                    roomId,
                    tokenUserId: tok.userId,
                    response: res.data || null,
                });
            }
        } catch (err: any) {
            console.error('Failed to send message to RC (as user):', err.response?.data || err.message);
            rcDebug('sendMessageToRC:user-failed', {
                roomId,
                email,
                status: err?.response?.status || null,
                response: err?.response?.data || null,
                error: err?.message || 'unknown',
            });
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
        if (res.data.success === true && mid) {
            rcDebug('sendMessageToRC:admin-success', { roomId, mid });
            return String(mid);
        }
        rcDebug('sendMessageToRC:admin-no-mid', { roomId, response: res.data || null });
    } catch (err: any) {
        console.error('Failed to send message to RC (as admin):', err.response?.data || err.message);
        rcDebug('sendMessageToRC:admin-failed', {
            roomId,
            status: err?.response?.status || null,
            response: err?.response?.data || null,
            error: err?.message || 'unknown',
        });
    }
    rcDebug('sendMessageToRC:return-null', { roomId, senderEmail: senderEmail || null });
    return null;
};

/** Logged-in WisdomLinked user used to open an RC REST session (same shape for DM + channels). */
export type RCParticipantSession = { email: string; username?: string; name?: string };

/** Set `ROCKETCHAT_SKIP_READ_RECEIPTS=true` to disable read-receipt HTTP calls (e.g. OSS RC without the endpoint). */
const skipReadReceiptsApi = (): boolean =>
    String(process.env.ROCKETCHAT_SKIP_READ_RECEIPTS || '').toLowerCase() === 'true';

const roomLastSeenCache = new Map<string, { value: number; fetchedAt: number }>();

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

/** Fetch a single RC message by id as the given user session. */
export const getRCMessageByIdAsUser = async (
    messageId: string,
    reader: RCParticipantSession
): Promise<any | null> => {
    const tok = await generateUserToken(reader);
    if (!tok) return null;
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    try {
        const res = await axios.get(`${RC_URL}/api/v1/chat.getMessage`, {
            params: { msgId: String(messageId) },
            headers,
        });
        if (res.data?.success && res.data?.message) return res.data.message;
    } catch (e: any) {
        const st = e.response?.status;
        if (st !== 404 && st !== 403) {
            console.warn('[getRCMessageByIdAsUser]', messageId, st, e.response?.data || e.message);
        }
    }
    return null;
};

export const getRoomLastSeenAsUser = async (
    roomId: string,
    reader: RCParticipantSession
): Promise<number | null> => {
    const cacheKey = `${String(reader?.email || '').toLowerCase()}::${String(roomId)}`;
    const now = Date.now();
    const cached = roomLastSeenCache.get(cacheKey);
    if (cached && now - cached.fetchedAt < 45_000) {
        return cached.value;
    }

    const cacheAndReturn = (ms: number | null) => {
        if (ms != null && !Number.isNaN(ms)) {
            roomLastSeenCache.set(cacheKey, { value: ms, fetchedAt: Date.now() });
        }
        return ms;
    };

    const tok = await generateUserToken(reader);
    if (!tok) return null;
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    try {
        const one = await axios.get(`${RC_URL}/api/v1/subscriptions.getOne`, {
            params: { roomId: String(roomId) },
            headers,
        });
        const ls = one.data?.subscription?.ls;
        if (ls) return cacheAndReturn(new Date(ls?.$date ?? ls).getTime());
    } catch {
        /* fallback below */
    }
    try {
        const many = await axios.get(`${RC_URL}/api/v1/subscriptions.get`, { headers });
        const list = extractSubscriptionRowsFromRocketGet(many.data);
        const row = list.find((s: any) => String(s?.rid) === String(roomId));
        const ls = row?.ls;
        if (ls) return cacheAndReturn(new Date(ls?.$date ?? ls).getTime());
    } catch (e: any) {
        const st = e.response?.status;
        if (st !== 404 && st !== 403 && st !== 429) {
            console.warn('[getRoomLastSeenAsUser]', roomId, st, e.response?.data || e.message);
        }
    }
    if (cached) return cached.value;
    return null;
};

const ROOM_TYPES_WITH_UNREAD = new Set(['d', 'c', 'p']);

/** RC `subscriptions.get` body shape varies by version (flat array vs `{ update: [...] }`). */
function extractSubscriptionRowsFromRocketGet(body: any): any[] {
    if (!body) return [];
    if (Array.isArray(body)) return body;
    if (Array.isArray(body.update)) return body.update;
    if (Array.isArray(body.subscriptions)) return body.subscriptions;
    if (Array.isArray(body.result)) return body.result;
    if (body.result && Array.isArray(body.result.update)) return body.result.update;
    return [];
}

const resolveRoomDisplayNames = async (
    rooms: { rid: string; rawName: string; type: string }[],
    selfEmail: string,
): Promise<{ displayNameByRid: Record<string, string>; failed: boolean }> => {
    const displayNameByRid: Record<string, string> = {};
    let failed = false;
    if (!rooms.length) return { displayNameByRid, failed };

    const groupRooms = rooms.filter((r) => r.type !== 'd');
    const dmRooms = rooms.filter((r) => r.type === 'd');

    if (groupRooms.length) {
        const rids = groupRooms.map((r) => r.rid);
        const slugIds = groupRooms
            .map((r) => parseGroupChatIdFromRoomName(r.rawName))
            .filter((id): id is string => Boolean(id));
        try {
            const chats = await GroupChat.find({
                $or: [{ rcChannelId: { $in: rids } }, { _id: { $in: slugIds } }],
            })
                .select('_id name rcChannelId')
                .lean();
            const nameByChannelId: Record<string, string> = {};
            const nameByChatId: Record<string, string> = {};
            chats.forEach((chat: any) => {
                const name = String(chat?.name || '').trim();
                if (!name) return;
                if (chat?.rcChannelId) nameByChannelId[String(chat.rcChannelId)] = name;
                nameByChatId[String(chat._id).toLowerCase()] = name;
            });
            groupRooms.forEach((room) => {
                const slugId = parseGroupChatIdFromRoomName(room.rawName);
                const name = nameByChannelId[room.rid] || (slugId ? nameByChatId[slugId] : '');
                if (name) displayNameByRid[room.rid] = name;
            });
        } catch (e: any) {
            failed = true;
            console.warn('[resolveRoomDisplayNames] group lookup', e?.message || e);
        }
    }

    if (dmRooms.length) {
        const usernames = dmRooms.map((r) => r.rawName).filter(Boolean);
        try {
            const users = await User.find({ rocketChatUsername: { $in: usernames } })
                .select('username email rocketChatUsername')
                .lean();
            const nameByRcUsername: Record<string, string> = {};
            users.forEach((u: any) => {
                const key = String(u?.rocketChatUsername || '');
                const name = String(u?.username || u?.email || '').trim();
                if (key && name) nameByRcUsername[key] = name;
            });
            dmRooms.forEach((room) => {
                const name = nameByRcUsername[room.rawName];
                if (name) displayNameByRid[room.rid] = name;
            });
        } catch (e: any) {
            failed = true;
            console.warn('[resolveRoomDisplayNames] dm lookup', e?.message || e);
        }

        const stillUnnamed = dmRooms.filter((r) => !displayNameByRid[r.rid]).map((r) => r.rid);
        if (stillUnnamed.length) {
            try {
                const convos = await Conversation.find({ rcChannelId: { $in: stillUnnamed } })
                    .select('rcChannelId participants')
                    .populate('participants', '_id username email')
                    .lean();
                const me = String(selfEmail || '').toLowerCase();
                convos.forEach((c: any) => {
                    const other = (c?.participants || []).find(
                        (p: any) => String(p?.email || '').toLowerCase() !== me,
                    );
                    const name = String(other?.username || other?.email || '').trim();
                    if (c?.rcChannelId && name) displayNameByRid[String(c.rcChannelId)] = name;
                });
            } catch (e: any) {
                failed = true;
                console.warn('[resolveRoomDisplayNames] conversation lookup', e?.message || e);
            }
        }
    }

    return { displayNameByRid, failed };
};

const ALERT_ONLY_UNREAD_PROBE_LIMIT = 5;

const applyAlertOnlyUnreadCounts = async (
    alerted: { rid: string; type: string }[],
    headers: Record<string, string>,
    unreadByRid: Record<string, number>,
): Promise<void> => {
    if (!alerted.length) return;
    const probed = await Promise.all(
        alerted.slice(0, ALERT_ONLY_UNREAD_PROBE_LIMIT).map(async ({ rid, type }) => {
            const endpoint = type === 'p' ? 'groups.counters' : 'channels.counters';
            try {
                const res = await axios.get(`${RC_URL}/api/v1/${endpoint}`, {
                    headers,
                    params: { roomId: rid },
                });
                return { rid, unreads: Number(res.data?.unreads || 0) };
            } catch (e: any) {
                console.warn('[applyAlertOnlyUnreadCounts]', endpoint, e.response?.status || e.message);
                return { rid, unreads: 1 };
            }
        }),
    );
    probed.forEach(({ rid, unreads }) => {
        if (unreads > 0) unreadByRid[rid] = unreads;
    });
    alerted.slice(ALERT_ONLY_UNREAD_PROBE_LIMIT).forEach(({ rid }) => {
        unreadByRid[rid] = 1;
    });
};

export const getChatUnreadSnapshotAsUser = async (
    reader: RCParticipantSession
): Promise<{
    unreadByRid: Record<string, number>;
    nameByRid: Record<string, string>;
    displayNameByRid: Record<string, string>;
    knownRids: string[];
    nameResolutionFailed: boolean;
}> => {
    const unreadByRid: Record<string, number> = {};
    const nameByRid: Record<string, string> = {};
    const tok = await generateUserToken(reader);
    if (!tok) return { unreadByRid, nameByRid, displayNameByRid: {}, knownRids: [], nameResolutionFailed: false };
    const headers = {
        'X-Auth-Token': tok.authToken,
        'X-User-Id': tok.userId,
        'Content-Type': 'application/json',
    };
    const rooms: { rid: string; rawName: string; type: string }[] = [];
    const alertedWithoutCount: { rid: string; type: string }[] = [];
    try {
        const res = await axios.get(`${RC_URL}/api/v1/subscriptions.get`, { headers });
        const list = extractSubscriptionRowsFromRocketGet(res.data);
        list.forEach((s: any) => {
            const type = String(s?.t || '');
            if (!ROOM_TYPES_WITH_UNREAD.has(type)) return;
            const rid = String(s?.rid || '');
            if (!rid) return;
            const unread = Number(s?.unread || 0);
            if (unread > 0) unreadByRid[rid] = unread;
            else if (type !== 'd' && s?.alert === true) alertedWithoutCount.push({ rid, type });
            const label = String(s?.name || s?.fname || '').trim();
            if (label) nameByRid[rid] = label;
            rooms.push({ rid, rawName: label, type });
        });
    } catch (e: any) {
        const st = e.response?.status;
        if (st !== 404 && st !== 403 && st !== 429) {
            console.warn('[getChatUnreadSnapshotAsUser]', st, e.response?.data || e.message);
        }
    }

    await applyAlertOnlyUnreadCounts(alertedWithoutCount, headers, unreadByRid);

    const resolved = await resolveRoomDisplayNames(rooms, String(reader?.email || ''));
    const displayNameByRid: Record<string, string> = {};
    rooms.forEach((room) => {
        const human = resolved.displayNameByRid[room.rid];
        if (human) displayNameByRid[room.rid] = human;
        else if (room.rawName && !isMachineRoomLabel(room.rawName)) displayNameByRid[room.rid] = room.rawName;
    });

    return {
        unreadByRid,
        nameByRid,
        displayNameByRid,
        knownRids: Object.keys(resolved.displayNameByRid),
        nameResolutionFailed: resolved.failed,
    };
};

/** @deprecated Prefer getChatUnreadSnapshotAsUser — kept for callers that only need counts. */
export const getDmUnreadByRoomAsUser = async (
    reader: RCParticipantSession
): Promise<Record<string, number>> => {
    const { unreadByRid } = await getChatUnreadSnapshotAsUser(reader);
    return unreadByRid;
};

/** Snapshot of Rocket.Chat usernames with an active chat connection (admin-scoped). */
export const getRocketOnlineUsernames = async (): Promise<string[]> => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.get(`${RC_URL}/api/v1/users.list`, {
            params: {
                status: 'online',
                count: 500,
                offset: 0,
                fields: JSON.stringify({
                    username: 1,
                    status: 1,
                    statusConnection: 1,
                    lastLogin: 1,
                    _updatedAt: 1,
                }),
            },
            headers,
        });
        const users = Array.isArray(res.data?.users) ? res.data.users : [];
        return rcUsernamesWithActiveChatConnection(users);
    } catch (e: any) {
        const st = e?.response?.status;
        if (st !== 404 && st !== 403) {
            console.warn('[getRocketOnlineUsernames]', st, e?.response?.data || e?.message);
        }
    }
    return [];
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
    await ensureAdminInGroupChannel(roomId, headers);
    return roomId;
};

/**
 * Remove a user from a `wl-group-*` channel (admin API). Used when someone leaves WL community or is removed by admin.
 */
export const kickUserFromGroupChannel = async (roomId: string, memberEmail: string): Promise<boolean> => {
    const email = String(memberEmail || '')
        .trim()
        .toLowerCase();
    if (!email || !roomId) return false;
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
    if (!rcUid) return false;
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(
            `${RC_URL}/api/v1/channels.kick`,
            { roomId: String(roomId), userId: rcUid },
            { headers },
        );
        return res.data?.success === true;
    } catch (e: any) {
        const raw = JSON.stringify(e.response?.data || '') + String(e.message || '');
        if (/not-in-room|user-not-in-room|not a member/i.test(raw)) return true;
        console.warn('[kickUserFromGroupChannel]', e.response?.data || e.message);
        return false;
    }
};


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

};

export type GenerateRcTokenUser = {
    email: string;
    username?: string;
    name?: string;
};


export const generateUserToken = async (
    wlUser: string | GenerateRcTokenUser
): Promise<{ authToken: string; userId: string } | null> => {
    const params: GenerateRcTokenUser =
        typeof wlUser === 'string' ? { email: wlUser } : wlUser;
    const email = params.email?.trim();
    if (!email) return null;

    const rcUsername = toRocketChatUsername(email);
    rcDebug('generateUserToken:start', {
        email,
        rcUsername,
        usernameHint: params.username || null,
        nameHint: params.name || null,
    });
    let rcUserId = await getRCUserIdByUsername(rcUsername);
    rcDebug('generateUserToken:lookup', { email, rcUsername, rcUserId: rcUserId || null });

    if (!rcUserId) {
        rcUserId = await syncUserToRocketChat({
            email,
            username: params.username || email,
            name: params.name || params.username || email.split('@')[0] || 'User',
        });
        rcDebug('generateUserToken:after-sync', { email, rcUsername, rcUserId: rcUserId || null });
    }

    if (!rcUserId) {
        rcUserId = (await getRCUserIdByUsername(rcUsername)) || (await getRCUserIdByEmail(email));
    }

    if (!rcUserId) {
        console.error('Failed to generate RC token: no Rocket.Chat user for', email);
        rcDebug('generateUserToken:no-rc-user', { email, rcUsername });
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
        return await withAdminAuth(async (headers) => {
            const res = await axios.post(
                `${RC_URL}/api/v1/users.createToken`,
                { userId: rcUserId, secret },
                { headers },
            );

            if (res.data.success) {
                rcDebug('generateUserToken:success', {
                    email,
                    rcUsername,
                    rcUserId,
                    tokenUserId: res.data.data.userId || null,
                });
                return {
                    authToken: res.data.data.authToken,
                    userId: res.data.data.userId,
                };
            }
            return null;
        });
    } catch (err: any) {
        console.error('Failed to generate user token:', err.response?.data || err.message);
        rcDebug('generateUserToken:failed', {
            email,
            rcUsername,
            rcUserId,
            status: err?.response?.status || null,
            response: err?.response?.data || null,
            error: err?.message || 'unknown',
        });
    }
    rcDebug('generateUserToken:return-null', { email, rcUsername, rcUserId });
    return null;
};

export { RC_URL };
