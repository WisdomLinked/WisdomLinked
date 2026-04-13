import axios from 'axios';

const RC_URL = process.env.ROCKETCHAT_URL || 'https://chat.wisdomlinked.com';
const RC_USER = process.env.ROCKETCHAT_ADMIN_USER || '';
const RC_PASS = process.env.ROCKETCHAT_ADMIN_PASS || '';

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

// ── User Management ─────────────────────────────────────────

export const syncUserToRocketChat = async (userData: { email: string; username: string; name: string; password?: string }) => {
    try {
        const headers = await getAdminAuthHeaders();
        
        // 1. Check if user already exists
        try {
            const checkRes = await axios.get(`${RC_URL}/api/v1/users.info?username=${userData.username}`, { headers });
            if (checkRes.data.success && checkRes.data.user) {
                return checkRes.data.user._id;
            }
        } catch (e: any) {
            // 400 error usually means user doesn't exist, which is fine
        }

        // 2. Create the user
        const createRes = await axios.post(`${RC_URL}/api/v1/users.create`, {
            email: userData.email,
            name: userData.name || userData.username,
            password: userData.password || Math.random().toString(36).slice(-10) + 'A1!',
            username: userData.username,
            verified: true,
            joinDefaultChannels: true
        }, { headers });

        if (createRes.data.success) {
            console.log(`Successfully synced user ${userData.username} to Rocket.Chat`);
            return createRes.data.user._id;
        }
    } catch (err: any) {
        if (err.response?.data?.errorType === 'error-field-unavailable') {
            console.log(`User ${userData.username} or email ${userData.email} already exists in Rocket.Chat`);
        } else {
            console.error('Failed to sync user to Rocket.Chat:', err.response?.data || err.message);
        }
    }
    return null;
};

export const getRocketAuthToken = async (userId: string) => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(`${RC_URL}/api/v1/users.createToken`, {
            userId
        }, { headers });

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
        const res = await axios.get(`${RC_URL}/api/v1/users.info?username=${username}`, { headers });
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
        const res = await axios.post(`${RC_URL}/api/v1/dm.create`, {
            usernames: `${usernameA},${usernameB}`
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

/** Send a message to a RC channel (DM or group) on behalf of a user.
 *  Uses admin credentials with `alias` to display the sender's name. */
export const sendMessageToRC = async (roomId: string, text: string, senderUsername: string): Promise<boolean> => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(`${RC_URL}/api/v1/chat.sendMessage`, {
            message: {
                rid: roomId,
                msg: text,
                alias: senderUsername,
            }
        }, { headers });
        return res.data.success === true;
    } catch (err: any) {
        console.error('Failed to send message to RC:', err.response?.data || err.message);
        return false;
    }
};

/** Fetch DM history from RC */
export const getRCIMHistory = async (roomId: string, count: number = 20, offset: number = 0) => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.get(`${RC_URL}/api/v1/im.history?roomId=${roomId}&count=${count}&offset=${offset}`, { headers });
        if (res.data.success) {
            return res.data.messages;
        }
    } catch (err: any) {
        console.error('Failed to get IM history:', err.response?.data || err.message);
    }
    return [];
};

/** Fetch Group/Channel history from RC */
export const getRCGroupHistory = async (roomId: string, count: number = 20, offset: number = 0) => {
    try {
        const headers = await getAdminAuthHeaders();
        // Since we created it with channels.create, we use channels.history
        const res = await axios.get(`${RC_URL}/api/v1/channels.history?roomId=${roomId}&count=${count}&offset=${offset}`, { headers });
        if (res.data.success) {
            return res.data.messages;
        }
    } catch (err: any) {
        console.error('Failed to get Group history:', err.response?.data || err.message);
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

/** Generate a login token for a WL user to connect to RC's realtime API from the frontend. */
export const generateUserToken = async (username: string): Promise<{ authToken: string; userId: string } | null> => {
    try {
        const headers = await getAdminAuthHeaders();
        const res = await axios.post(`${RC_URL}/api/v1/users.createToken`, {
            username
        }, { headers });

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
