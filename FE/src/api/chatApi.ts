import axios from 'axios';

let BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
if (BASE_URL && !BASE_URL.endsWith('/')) {
    BASE_URL += '/';
}

const api = axios.create({
    withCredentials: true,
    baseURL: BASE_URL,
});

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
export const fetchDirectHistory = async (conversationId: string, page: number = 0, limit: number = 20) => {
    try {
        const res = await api.get(`chat/history/${conversationId}?page=${page}&limit=${limit}`);
        return res.data; // { messages: [...] }
    } catch (err: any) {
        console.error('[chatApi.fetchDirectHistory]', err.message);
        return { messages: [] };
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
export const fetchGroupHistory = async (groupChatId: string, page: number = 0, limit: number = 20) => {
    try {
        const res = await api.get(`chat/group/history/${groupChatId}?page=${page}&limit=${limit}`);
        return res.data; // { messages: [...] }
    } catch (err: any) {
        console.error('[chatApi.fetchGroupHistory]', err.message);
        return { messages: [] };
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
