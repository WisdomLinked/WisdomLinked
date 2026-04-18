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
const subscribedRooms = new Set<string>();
const pendingRoomSubs = new Set<string>();
let activeLoginMethodId: string | null = null;

const nextId = () => String(++msgIdCounter);

const sendDDP = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
};

const doSubscribeRoom = (roomId: string) => {
    if (!roomId || subscribedRooms.has(roomId)) return;
    sendDDP({
        msg: 'sub',
        id: nextId(),
        name: 'stream-room-messages',
        params: [roomId, false],
    });
    sendDDP({
        msg: 'sub',
        id: nextId(),
        name: 'stream-notify-room',
        params: [`${roomId}/typing`, false],
    });
    sendDDP({
        msg: 'sub',
        id: nextId(),
        name: 'stream-notify-room',
        params: [`${roomId}/user-activity`, false],
    });
    subscribedRooms.add(roomId);
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

/** Handle incoming DDP messages */
const handleDDPMessage = (data: any) => {
    if (data.msg === 'ping') {
        sendDDP({ msg: 'pong' });
        return;
    }

    if (data.msg === 'changed' && data.collection === 'stream-room-messages') {
        const raw = data.fields?.args;
        const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
        list.forEach((msg: any) => {
            if (msg) messageCallbacks.forEach((cb) => cb(msg));
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
};

/** Connect to Rocket.Chat's DDP WebSocket. Call once on app startup. */
export const connectToRC = async (): Promise<boolean> => {
    if (rcLoginComplete && ws && ws.readyState === WebSocket.OPEN) return true;

    const tokenData = await getRCToken();
    if (!tokenData?.rcAuthToken) {
        console.error('[rcRealtime] Failed to get RC token');
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
    subscribedRooms.delete(String(roomId));
    pendingRoomSubs.delete(String(roomId));
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
    messageCallbacks = [];
    typingCallbacks = [];
};

export const isRCConnected = () => rcLoginComplete && ws !== null && ws.readyState === WebSocket.OPEN;
