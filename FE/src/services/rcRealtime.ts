/**
 * Rocket.Chat Realtime (DDP) Client
 *
 * Subscriptions run after DDP `login` succeeds. Typing uses both legacy `/typing` and `/user-activity`
 * (Rocket.Chat 4+) so indicators work across versions.
 */

import { getRCToken } from '../api/chatApi';

let ws: WebSocket | null = null;
let rcUrl = '';
let msgIdCounter = 0;
let isConnected = false;
let rcLoginComplete = false;
let reconnectTimer: any = null;
let messageCallbacks: Array<(msg: any) => void> = [];
let typingCallbacks: Array<(data: { roomId: string; username: string; isTyping: boolean }) => void> = [];
let subscriptionCallbacks: Array<(data: { roomId: string; unread?: number; type?: string }) => void> = [];
const subscribedRooms = new Set<string>();
const pendingRoomSubs = new Set<string>();
const roomSubIds = new Map<string, { msgSubId: string; typingSubId: string; activitySubId: string }>();
let activeLoginMethodId: string | null = null;
let currentRcUserId: string | null = null;

const nextId = () => String(++msgIdCounter);

const sendDDP = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
};

const doSubscribeRoom = (roomId: string) => {
    if (!roomId || subscribedRooms.has(roomId)) return;
    const msgSubId = nextId();
    const typingSubId = nextId();
    const activitySubId = nextId();
    sendDDP({
        msg: 'sub',
        id: msgSubId,
        name: 'stream-room-messages',
        params: [roomId, false],
    });
    sendDDP({
        msg: 'sub',
        id: typingSubId,
        name: 'stream-notify-room',
        params: [`${roomId}/typing`, false],
    });
    sendDDP({
        msg: 'sub',
        id: activitySubId,
        name: 'stream-notify-room',
        params: [`${roomId}/user-activity`, false],
    });
    roomSubIds.set(roomId, { msgSubId, typingSubId, activitySubId });
    subscribedRooms.add(roomId);
};

const doUnsubscribeRoom = (roomId: string) => {
    const ids = roomSubIds.get(roomId);
    if (!ids) return;
    sendDDP({ msg: 'unsub', id: ids.msgSubId });
    sendDDP({ msg: 'unsub', id: ids.typingSubId });
    sendDDP({ msg: 'unsub', id: ids.activitySubId });
    roomSubIds.delete(roomId);
};

const flushPendingRoomSubscriptions = () => {
    if (!rcLoginComplete) return;
    pendingRoomSubs.forEach((rid) => {
        if (!subscribedRooms.has(rid)) {
            doSubscribeRoom(rid);
        }
    });
    pendingRoomSubs.clear();
};

const emitTyping = (roomId: string, username: string, isTyping: boolean) => {
    typingCallbacks.forEach((cb) => cb({ roomId, username, isTyping }));
};

const subscribeToUserStream = () => {
    if (!currentRcUserId) return;
    sendDDP({
        msg: 'sub',
        id: nextId(),
        name: 'stream-notify-user',
        params: [`${currentRcUserId}/subscriptions-changed`, false],
    });
};

/**
 * Rocket.Chat streamer sends `fields.args` as `[message]` or `[message, allowedFlag]` (boolean).
 * Older / bridged installs may omit `rid` on the message — recover from `eventName` when it is a room id.
 */
function extractRoomMessagesFromStreamerFields(fields: any): any[] {
    if (!fields) return [];
    const eventName = String(fields.eventName || '').replace(/\/.*$/, '').trim();
    const ridHint =
        /^[a-zA-Z0-9]{12,}$/.test(eventName) && !eventName.includes(' ') ? eventName : '';
    const rawArgs = fields.args;
    const arr = Array.isArray(rawArgs) ? rawArgs : rawArgs != null ? [rawArgs] : [];
    const out: any[] = [];
    for (const item of arr) {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) continue;
        const o = item as Record<string, unknown>;
        const looksLikeMessage =
            o._id != null ||
            typeof o.msg === 'string' ||
            o.t != null ||
            (o.u != null && typeof o.u === 'object');
        if (!looksLikeMessage) continue;
        const merged = { ...o } as any;
        if (!merged.rid && ridHint) merged.rid = ridHint;
        out.push(merged);
    }
    return out;
}

/** Normalize common Rocket.Chat / streamer field aliases before UI mapping. */
export function normalizeRcStreamRoomMessage(msg: any): any {
    if (!msg || typeof msg !== 'object') return msg;
    const m = msg as Record<string, unknown>;
    const t =
        m.t ??
        m.type ??
        m.msgtype ??
        (m.d as any)?.t ??
        (m.message as any)?.t ??
        (m.payload as any)?.t;
    const body = m.msg ?? m.text ?? (m.message as any)?.msg;
    return {
        ...msg,
        ...(t != null && String(t) !== '' ? { t } : {}),
        ...(typeof body === 'string' ? { msg: body } : {}),
    };
}

/** Handle incoming DDP messages */
const handleDDPMessage = (data: any) => {
    if (data.msg === 'ping') {
        sendDDP({ msg: 'pong' });
        return;
    }

    if (data.msg === 'changed' && data.collection === 'stream-room-messages') {
        const list = extractRoomMessagesFromStreamerFields(data.fields);
        list.forEach((msg: any) => {
            const normalized = normalizeRcStreamRoomMessage(msg);
            messageCallbacks.forEach((cb) => cb(normalized));
        });
        return;
    }

    if (data.msg === 'changed' && data.collection === 'stream-notify-room') {
        const eventName = String(data.fields?.eventName || '');
        const args = data.fields?.args;

        if (eventName.endsWith('/typing')) {
            const roomId = eventName.slice(0, -'/typing'.length) || eventName.split('/')[0];
            if (Array.isArray(args) && args.length >= 2) {
                emitTyping(roomId, String(args[0] ?? ''), Boolean(args[1]));
            }
            return;
        }

        if (eventName.endsWith('/user-activity')) {
            const roomId = eventName.slice(0, -'/user-activity'.length);
            if (Array.isArray(args) && args.length >= 2) {
                const username = String(args[0] ?? '');
                const events = args[1];
                const isTyping = Array.isArray(events) && events.includes('user-typing');
                emitTyping(roomId, username, isTyping);
            }
            return;
        }
    }

    if (data.msg === 'changed' && data.collection === 'stream-notify-user') {
        const eventName = String(data.fields?.eventName || '');
        if (eventName.endsWith('/subscriptions-changed')) {
            const args = data.fields?.args;
            let payload: any = null;
            if (Array.isArray(args)) {
                if (args.length >= 2 && args[1] != null && typeof args[1] === 'object') {
                    payload = args[1];
                } else if (
                    args.length >= 1 &&
                    args[0] != null &&
                    typeof args[0] === 'object' &&
                    (args[0] as any).rid
                ) {
                    payload = args[0];
                }
            } else if (args && typeof args === 'object' && !Array.isArray(args) && (args as any).rid) {
                payload = args;
            }
            const rid = String(payload?.rid || '');
            if (rid) {
                const unread = Number(payload?.unread || 0);
                const type = String(payload?.t || '');
                subscriptionCallbacks.forEach((cb) => cb({ roomId: rid, unread, type }));
            }
        }
    }
};

/** Connect to Rocket.Chat's DDP WebSocket. Call once on app startup. */
export const connectToRC = async (): Promise<boolean> => {
    if (rcLoginComplete && ws && ws.readyState === WebSocket.OPEN) return true;

    const tokenData = await getRCToken();
    if (!tokenData?.rcAuthToken) {
        console.error('[rcRealtime] Failed to get RC token', tokenData?.code || tokenData?.error || '');
        return false;
    }

    rcUrl = (tokenData.rcUrl || '').replace('https://', 'wss://').replace('http://', 'ws://');
    const wsUrl = `${rcUrl}/websocket`;

    if (ws) {
        try {
            ws.close();
        } catch {
            /* noop */
        }
        ws = null;
    }
    rcLoginComplete = false;
    subscribedRooms.forEach((r) => pendingRoomSubs.add(r));
    subscribedRooms.clear();

    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            activeLoginMethodId = null;
            resolve(ok);
        };

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                sendDDP({ msg: 'connect', version: '1', support: ['1', 'pre2', 'pre1'] });
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.msg === 'connected') {
                        isConnected = true;
                        currentRcUserId = tokenData.rcUserId ? String(tokenData.rcUserId) : null;
                        activeLoginMethodId = nextId();
                        sendDDP({
                            msg: 'method',
                            method: 'login',
                            id: activeLoginMethodId,
                            params: [{ resume: tokenData.rcAuthToken }],
                        });
                        return;
                    }

                    if (data.msg === 'result' && activeLoginMethodId && data.id === activeLoginMethodId) {
                        if (data.error) {
                            console.error('[rcRealtime] login error', data.error);
                            rcLoginComplete = false;
                            finish(false);
                            return;
                        }
                        rcLoginComplete = true;
                        subscribeToUserStream();
                        flushPendingRoomSubscriptions();
                        finish(true);
                        return;
                    }

                    handleDDPMessage(data);
                } catch {
                    /* ignore */
                }
            };

            ws.onclose = () => {
                isConnected = false;
                rcLoginComplete = false;
                subscribedRooms.forEach((r) => pendingRoomSubs.add(r));
                subscribedRooms.clear();
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        connectToRC();
                    }, 5000);
                }
            };

            ws.onerror = () => {
                if (!rcLoginComplete) finish(false);
            };
        } catch (err) {
            console.error('[rcRealtime] Connection error:', err);
            finish(false);
        }
    });
};

export const subscribeToRoom = (roomId: string) => {
    if (!roomId) return;
    if (subscribedRooms.has(roomId)) return;
    if (!rcLoginComplete || !ws || ws.readyState !== WebSocket.OPEN) {
        pendingRoomSubs.add(String(roomId));
        return;
    }
    doSubscribeRoom(String(roomId));
};

export const unsubscribeFromRoom = (roomId: string) => {
    const rid = String(roomId);
    pendingRoomSubs.delete(rid);
    if (subscribedRooms.has(rid) && ws && ws.readyState === WebSocket.OPEN && rcLoginComplete) {
        doUnsubscribeRoom(rid);
    } else {
        roomSubIds.delete(rid);
    }
    subscribedRooms.delete(rid);
};

/** Notify RC that the user is typing (legacy + modern streams). */
export const sendRoomTyping = (roomId: string, rcUsername: string, isTyping: boolean) => {
    if (!roomId || !rcUsername) return;
    sendDDP({
        msg: 'method',
        method: 'stream-notify-room',
        id: nextId(),
        params: [`${roomId}/typing`, rcUsername, isTyping],
    });
    if (isTyping) {
        sendDDP({
            msg: 'method',
            method: 'stream-notify-room',
            id: nextId(),
            params: [`${roomId}/user-activity`, rcUsername, ['user-typing'], {}],
        });
    } else {
        sendDDP({
            msg: 'method',
            method: 'stream-notify-room',
            id: nextId(),
            params: [`${roomId}/user-activity`, rcUsername, [], {}],
        });
    }
};

/** @deprecated use sendRoomTyping */
export const sendTyping = sendRoomTyping;

export const onNewMessage = (callback: (msg: any) => void) => {
    messageCallbacks.push(callback);
    return () => {
        messageCallbacks = messageCallbacks.filter((cb) => cb !== callback);
    };
};

export const onTyping = (callback: (data: { roomId: string; username: string; isTyping: boolean }) => void) => {
    typingCallbacks.push(callback);
    return () => {
        typingCallbacks = typingCallbacks.filter((cb) => cb !== callback);
    };
};

export const onSubscriptionChanged = (
    callback: (data: { roomId: string; unread?: number; type?: string }) => void,
) => {
    subscriptionCallbacks.push(callback);
    return () => {
        subscriptionCallbacks = subscriptionCallbacks.filter((cb) => cb !== callback);
    };
};

export const disconnectRC = () => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    isConnected = false;
    rcLoginComplete = false;
    subscribedRooms.clear();
    pendingRoomSubs.clear();
    roomSubIds.clear();
    messageCallbacks = [];
    typingCallbacks = [];
    subscriptionCallbacks = [];
    currentRcUserId = null;
};

export const isRCConnected = () => rcLoginComplete && ws !== null && ws.readyState === WebSocket.OPEN;
