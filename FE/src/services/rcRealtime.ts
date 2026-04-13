/**
 * Rocket.Chat Realtime (DDP) Client
 * 
 * Lightweight wrapper around RC's WebSocket-based DDP protocol.
 * Used for: real-time message events + typing indicators.
 * We do NOT write any WebSocket server code — this is a client connecting to RC's server.
 */

import { getRCToken } from '../api/chatApi';

let ws: WebSocket | null = null;
let rcUrl = '';
let msgIdCounter = 0;
let isConnected = false;
let reconnectTimer: any = null;
let messageCallbacks: Array<(msg: any) => void> = [];
let typingCallbacks: Array<(data: { roomId: string; username: string; isTyping: boolean }) => void> = [];
let subscribedRooms = new Set<string>();

const nextId = () => String(++msgIdCounter);

const sendDDP = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
};

/** Connect to Rocket.Chat's DDP WebSocket. Call once on app startup. */
export const connectToRC = async (): Promise<boolean> => {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) return true;

    const tokenData = await getRCToken();
    if (!tokenData) {
        console.error('[rcRealtime] Failed to get RC token');
        return false;
    }

    rcUrl = (tokenData.rcUrl || '').replace('https://', 'wss://').replace('http://', 'ws://');
    const wsUrl = `${rcUrl}/websocket`;

    return new Promise((resolve) => {
        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                // 1. DDP connect
                sendDDP({ msg: 'connect', version: '1', support: ['1'] });
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleDDPMessage(data, tokenData);
                    if (data.msg === 'connected') {
                        isConnected = true;
                        // 2. Login with token
                        sendDDP({
                            msg: 'method',
                            method: 'login',
                            id: nextId(),
                            params: [{ resume: tokenData.rcAuthToken }]
                        });
                        resolve(true);
                    }
                } catch (e) { /* ignore parse errors */ }
            };

            ws.onclose = () => {
                isConnected = false;
                // Auto-reconnect after 5s
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        connectToRC();
                    }, 5000);
                }
            };

            ws.onerror = () => {
                resolve(false);
            };
        } catch (err) {
            console.error('[rcRealtime] Connection error:', err);
            resolve(false);
        }
    });
};

/** Handle incoming DDP messages */
const handleDDPMessage = (data: any, tokenData: any) => {
    // Respond to pings to keep connection alive
    if (data.msg === 'ping') {
        sendDDP({ msg: 'pong' });
        return;
    }

    // Handle subscription events (new messages, typing)
    if (data.msg === 'changed' && data.collection === 'stream-room-messages') {
        const messages = data.fields?.args || [];
        messages.forEach((msg: any) => {
            messageCallbacks.forEach(cb => cb(msg));
        });
    }

    if (data.msg === 'changed' && data.collection === 'stream-notify-room') {
        const args = data.fields?.args || [];
        const eventName = data.fields?.eventName || '';
        if (eventName.endsWith('/typing')) {
            const roomId = eventName.split('/')[0];
            const [username, isTyping] = args;
            typingCallbacks.forEach(cb => cb({ roomId, username, isTyping }));
        }
    }
};

/** Subscribe to new messages in a room */
export const subscribeToRoom = (roomId: string) => {
    if (subscribedRooms.has(roomId)) return;

    sendDDP({
        msg: 'sub',
        id: nextId(),
        name: 'stream-room-messages',
        params: [roomId, false]
    });

    // Also subscribe to typing events
    sendDDP({
        msg: 'sub',
        id: nextId(),
        name: 'stream-notify-room',
        params: [`${roomId}/typing`, false]
    });

    subscribedRooms.add(roomId);
};

/** Unsubscribe from a room (cleanup) */
export const unsubscribeFromRoom = (roomId: string) => {
    subscribedRooms.delete(roomId);
    // DDP unsub would go here if needed; for now we just stop listening
};

/** Send typing indicator to a room */
export const sendTyping = (roomId: string, username: string, isTyping: boolean) => {
    sendDDP({
        msg: 'method',
        method: 'stream-notify-room',
        id: nextId(),
        params: [`${roomId}/typing`, username, isTyping]
    });
};

/** Register a callback for new incoming messages */
export const onNewMessage = (callback: (msg: any) => void) => {
    messageCallbacks.push(callback);
    return () => {
        messageCallbacks = messageCallbacks.filter(cb => cb !== callback);
    };
};

/** Register a callback for typing events */
export const onTyping = (callback: (data: { roomId: string; username: string; isTyping: boolean }) => void) => {
    typingCallbacks = typingCallbacks.filter(cb => cb !== callback);
    typingCallbacks.push(callback);
    return () => {
        typingCallbacks = typingCallbacks.filter(cb => cb !== callback);
    };
};

/** Disconnect from RC */
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
    subscribedRooms.clear();
    messageCallbacks = [];
    typingCallbacks = [];
};

export const isRCConnected = () => isConnected;
