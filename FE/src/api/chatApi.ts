import axios from 'axios';

let BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';
if (BASE_URL && !BASE_URL.endsWith('/')) {
    BASE_URL += '/';
}

const api = axios.create({
    withCredentials: true,
    baseURL: BASE_URL,
});

export const CHAT_HISTORY_PAGE_SIZE = 50;

// ── DM ──────────────────────────────────────────────────────

/** Get or create a DM conversation between the current user and another user. */
export const getOrCreateDM = async (otherUserId: string) => {
    try {
        const res = await api.post('chat/dm', { otherUserId });
        return res.data; // { conversationId, rcChannelId }
    } catch (err: any) {
        console.error('[chatApi.getOrCreateDM]', err.message);
        return null;
    }
};

/** Send a direct message. */
export const sendDirectMessage = async (conversationId: string, content: string) => {
    try {
        const res = await api.post('chat/send', { conversationId, content });
        return res.data; // { message }
    } catch (err: any) {
        console.error('[chatApi.sendDirectMessage]', err.message);
        return null;
    }
};

/** Fetch paginated DM history from our MongoDB. */
export const fetchDirectHistory = async (
    conversationId: string,
    page: number = 0,
    limit: number = CHAT_HISTORY_PAGE_SIZE,
) => {
    try {
        const res = await api.get(`chat/history/${conversationId}?page=${page}&limit=${limit}`);
        return res.data; // { messages: [...] }
    } catch (err: any) {
        console.error('[chatApi.fetchDirectHistory]', err.message);
        return { messages: [] };
    }
};

/** Fetch expert/student DM call history (latest first). */
export const fetchDirectCallHistory = async (conversationId: string, limit: number = 30) => {
    try {
        const res = await api.get(`chat/dm/call-history/${conversationId}?limit=${limit}`);
        return res.data as { history?: Array<any>; error?: string };
    } catch (err: any) {
        console.error('[chatApi.fetchDirectCallHistory]', err.message);
        return { history: [] };
    }
};

// ── Group ───────────────────────────────────────────────────

/** Send a group message. */
export const sendGroupMessage = async (groupChatId: string, content: string) => {
    try {
        const res = await api.post('chat/group/send', { groupChatId, content });
        return res.data; // { message }
    } catch (err: any) {
        console.error('[chatApi.sendGroupMessage]', err.message);
        return null;
    }
};

/** Fetch paginated group chat history from our MongoDB. */
export const fetchGroupHistory = async (
    groupChatId: string,
    page: number = 0,
    limit: number = CHAT_HISTORY_PAGE_SIZE,
) => {
    try {
        const res = await api.get(`chat/group/history/${groupChatId}?page=${page}&limit=${limit}`);
        return res.data; // { messages: [...], rcChannelId?: string }
    } catch (err: any) {
        console.error('[chatApi.fetchGroupHistory]', err.message);
        return { messages: [], rcChannelId: null };
    }
};

/** Resolve Rocket.Chat email-slug → WL user for this group (DB may be ahead of stale Redux). */
export const fetchGroupMemberByRcSlug = async (groupChatId: string, slug: string) => {
    try {
        const q = encodeURIComponent(String(slug).trim());
        const res = await api.get(`group-chat/${encodeURIComponent(groupChatId)}/resolve-participant?slug=${q}`);
        return res.data as { user?: any };
    } catch (err: any) {
        console.error('[chatApi.fetchGroupMemberByRcSlug]', err.message);
        return { user: null as any };
    }
};

// ── RC Token ────────────────────────────────────────────────

/** Get a Rocket.Chat auth token so the frontend can connect to RC's realtime. */
export const getRCToken = async () => {
    try {
        const res = await api.get('chat/rc-token');
        return res.data; // { rcUrl, rcAuthToken, rcUserId }
    } catch (err: any) {
        console.error('[chatApi.getRCToken]', err.message);
        return null;
    }
};

/** Mark Rocket.Chat room as read for the current user (clears unread; supports read cursor). */
export const markChatRead = async (roomId: string) => {
    try {
        const res = await api.post('chat/mark-read', { roomId });
        return res.data as { success?: boolean };
    } catch (err: any) {
        console.error('[chatApi.markChatRead]', err.message);
        return null;
    }
};

/** One-shot RC unread snapshot by room id — DMs + channels/groups (used when opening chat sidebar). */
export const fetchDmUnreadSnapshot = async () => {
    try {
        const res = await api.get('chat/dm-unread-snapshot');
        return res.data as {
            success?: boolean;
            unreadByRid?: Record<string, number>;
            nameByRid?: Record<string, string>;
            error?: string;
        };
    } catch (err: any) {
        console.error('[chatApi.fetchDmUnreadSnapshot]', err.message);
        return null;
    }
};

/** Current online WL users (derived from Rocket.Chat presence). */
export const fetchOnlineUsers = async () => {
    try {
        const res = await api.get('chat/online-users');
        return res.data as {
            success?: boolean;
            onlineUsers?: Array<{ userId: string }>;
            error?: string;
        };
    } catch (err: any) {
        console.error('[chatApi.fetchOnlineUsers]', err.message);
        return null;
    }
};

/** Delete a message: mode='me' hides for current user; mode='both' deletes in RC for all (permission-dependent). */
export const deleteChatMessage = async (
    data: {
        roomId?: string;
        conversationId?: string;
        groupChatId?: string;
        messageId: string;
        mode: 'me' | 'both';
    },
) => {
    try {
        const res = await api.post('chat/delete-message', data);
        return res.data as { success?: boolean; error?: string };
    } catch (err: any) {
        console.error('[chatApi.deleteChatMessage]', err.message);
        return { success: false, error: err?.response?.data?.error || err.message };
    }
};

/** Clear DM thread for current user only. */
export const clearDmThread = async (conversationId: string) => {
    try {
        const res = await api.post('chat/dm/clear-thread', { conversationId });
        return res.data as {
            success?: boolean;
            error?: string;
            mode?: 'me';
            clearedAt?: string;
        };
    } catch (err: any) {
        console.error('[chatApi.clearDmThread]', err.message);
        return {
            success: false,
            error: err?.response?.data?.error || err.message,
        };
    }
};

/** Remove a DM from the current user's sidebar (Mongo only). */
export const hideDmFromList = async (conversationId: string) => {
    try {
        const res = await api.post('chat/dm/hide', { conversationId });
        return res.data as { success?: boolean; error?: string };
    } catch (err: any) {
        console.error('[chatApi.hideDmFromList]', err.message);
        return { success: false, error: err?.response?.data?.error || err.message };
    }
};

/** Rocket.Chat `chat.getMessageReadReceipts` batched (server uses your RC session). */
export const fetchReadReceiptsBatch = async (messageIds: string[], conversationId?: string) => {
    try {
        const res = await api.post('chat/rc-read-receipts', { messageIds, conversationId });
        return res.data as {
            success?: boolean;
            myRcUserId?: string;
            byMessageId?: Record<string, { hasPeerRead: boolean; receipts?: any[] }>;
            peerLastSeenMs?: number | null;
        };
    } catch (err: any) {
        console.error('[chatApi.fetchReadReceiptsBatch]', err.message);
        return null;
    }
};

// ── Meeting ─────────────────────────────────────────────────

/** Start a Jitsi meeting. */
export const startMeeting = async (data: { conversationId?: string; groupChatId?: string }) => {
    try {
        const res = await api.post('meeting/start', data);
        return res.data; // { meetingThreadId, jitsiRoomName, jitsiUrl, message }
    } catch (err: any) {
        console.error('[chatApi.startMeeting]', err.message);
        return null;
    }
};

/** End a Jitsi meeting. */
export const endMeeting = async (meetingThreadId: string) => {
    try {
        const res = await api.post('meeting/end', { meetingThreadId });
        return res.data;
    } catch (err: any) {
        console.error('[chatApi.endMeeting]', err.message);
        return null;
    }
};

/** Send a chat transcript message from a Jitsi call. */
export const addMeetingTranscript = async (meetingThreadId: string, content: string, authorName: string) => {
    try {
        const res = await api.post('meeting/transcript', { meetingThreadId, content, authorName });
        return res.data;
    } catch (err: any) {
        console.error('[chatApi.addMeetingTranscript]', err.message);
        return null;
    }
};

/** Get a meeting thread with its transcript. */
export const getMeetingThread = async (meetingThreadId: string) => {
    try {
        const res = await api.get(`meeting/${meetingThreadId}`);
        return res.data; // { meeting }
    } catch (err: any) {
        console.error('[chatApi.getMeetingThread]', err.message);
        return null;
    }
};
