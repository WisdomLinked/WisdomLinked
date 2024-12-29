// socketConnection.ts

import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import { store } from "../store";

// -- Actions
import {
    setFriends,
    setGroupChatList,
    setOnlineUsers,
    setPendingInvitations,
    updateLastChatDate,
    updateMissedChats,
} from "../actions/friendActions";
import {
    addNewMessage,
    setChosenChatDetails,
    setInitialTypingStatus,
    setMessages,
    setTyping,
} from "../actions/chatActions";
import {
    setCallRequest,
    setCallStatus,
    setOtherUserId,
    setRemoteStream,
    clearVideoChat,
    setAudioOnly,
    setVideoAudioStatus,
} from "../actions/videoChatActions";
import { setLocalStreamRoom } from "../actions/roomActions";
import { updateMe } from "../actions/authActions";
import { showAlert } from "../actions/alertActions";
import {
    initialRoomsUpdate,
    newRoomCreated,
    updateActiveRooms,
    leaveRoom,
} from "./roomHandler";
import {
    getLocalStreamPreview,
    handleParticipantLeftRoom,
    handleSignalingData,
    newPeerConnection,
    prepareNewPeerConnection,
} from "./webRTC";

// Types
import { ActiveRoom } from "../actions/types";

export interface UserDetails {
    email: string;
    username: string;
}

let currentPeerConnection: SimplePeer.Instance | null = null;

const setCurrentPeerConnection = (peerConnection: SimplePeer.Instance | null) => {
    currentPeerConnection = peerConnection;
};

let socket: Socket<any, any> | null = null;

// Make sure to set this properly in your .env
const SERVER_URL = process.env.REACT_APP_SERVER_URL;

/**
 * Connect with Socket.io and define all socket listeners exactly once.
 */
export const connectWithSocketServer = (userDetails: UserDetails) => {
    console.log("[connectWithSocketServer] Attempting to connect to:", SERVER_URL);
    console.log("[connectWithSocketServer] userDetails:", userDetails);

    socket = io(SERVER_URL as string, {
        auth: {
            email: userDetails.email,
        },
    });

    if (!socket) {
        // Possibly throw an error or return early
        console.warn("Socket is null, skipping .on(connect)");
        return;
    }

    socket.on("connect", () => {
        // @ts-ignore
        console.log(`Socket connected. ID: ${socket.id}`);
    });

    socket.emit("helloFomClient");

    // ---- FRIENDS & INVITATIONS
    socket.on("friend-invitations", (data: any) => {
        console.log("[socket.on friend-invitations]", data);
        store.dispatch(setPendingInvitations(data) as any);
    });

    socket.on("friends-list", (data: any) => {
        console.log("[socket.on friends-list]", data);
        const typingStatusOfFriends = data.map((friend: any) => ({
            userId: friend.id,
            typing: false,
        }));
        store.dispatch(setInitialTypingStatus(typingStatusOfFriends));
        store.dispatch(setFriends(data) as any);
    });

    socket.on("online-users", (data: any) => {
        console.log("[socket.on online-users]", data);
        store.dispatch(setOnlineUsers(data) as any);
    });

    socket.on("groupChats-list", async (data: any) => {
        console.log("[socket.on groupChats-list]", data);
        store.dispatch(updateMe());
        store.dispatch(setGroupChatList(data) as any);
    });

    // ---- MESSAGES
    socket.on("direct-chat-history", (data: any) => {
        console.log("[socket.on direct-chat-history]", data);
        const { messages, participants } = data;
        const chatDetails = store.getState().chat.chosenChatDetails;
        if (chatDetails) {
            const receiverId = chatDetails.userId;
            const senderId = store.getState().auth.userDetails?._id;
            if (participants.includes(receiverId) && participants.includes(senderId)) {
                store.dispatch(setMessages(messages) as any);
            }
        }
    });

    socket.on("group-chat-history", (data: any) => {
        console.log("[socket.on group-chat-history]", data);
        const { messages, groupChatId } = data;
        const groupChatDetails = store.getState().chat.chosenGroupChatDetails;
        if (groupChatDetails) {
            if (groupChatDetails.groupId === groupChatId) {
                store.dispatch(setMessages(messages) as any);
            }
        }
    });

    socket.on("direct-message", (data: any) => {
        console.log("[socket.on direct-message]", data);
        const { newMessage, participants } = data;
        const chatDetails = store.getState().chat.chosenChatDetails;
        const friends = store.getState().friends.friends;

        if (chatDetails) {
            const receiverId = chatDetails.userId;
            const senderId = store.getState().auth.userDetails?._id;
            if (participants.includes(receiverId) && participants.includes(senderId)) {
                store.dispatch(addNewMessage(newMessage) as any);
            }
        }

        console.log("[direct-message] Checking friends index");
        if (
            friends.findIndex((x: any) => x.id === newMessage.author._id) > -1 &&
            chatDetails?.userId !== newMessage.author._id
        ) {
            store.dispatch(updateMissedChats(newMessage.author._id, null, null));
        }
        store.dispatch(updateLastChatDate(participants, null, new Date().getTime()));
    });

    socket.on("group-message", (data: any) => {
        console.log("[socket.on group-message]", data);
        const { newMessage, groupChatId } = data;
        const chatDetails = store.getState().chat.chosenGroupChatDetails;
        const userDetails = store.getState().auth.userDetails;

        if (chatDetails && chatDetails.groupId === groupChatId) {
            store.dispatch(addNewMessage(newMessage) as any);
        }

        const groupChatList = store.getState().friends.groupChatList;
        if (
            groupChatList.findIndex((x: any) => x.groupId === groupChatId) > -1 &&
            chatDetails?.groupId !== groupChatId
        ) {
            store.dispatch(updateMissedChats(null, groupChatId, null));
        } else if (
            userDetails?.generalChats?.findIndex((x: any) => x._id === groupChatId) > -1 &&
            chatDetails?.groupId !== groupChatId
        ) {
            store.dispatch({
                type: "updateMissedChatsOfGeneralChat",
                payload: { receiverId: groupChatId, count: null },
            });
        }
        store.dispatch(updateLastChatDate(null, groupChatId, new Date().getTime()));
        store.dispatch({
            type: "updateLastChatDateOfGeneralChat",
            payload: { groupChatId: groupChatId, date: new Date().getTime() },
        });
    });

    socket.on("notify-typing", (data: any) => {
        console.log("[socket.on notify-typing]", data);
        store.dispatch(
            setTyping({ typing: data.typing, userId: data.senderUserId, chatId: data.chatId }) as any
        );
    });

    // ---- CALLS
    socket.on("call-request", (data: any) => {
        console.log("[socket.on call-request]", data);

        // If already in a call (status = accepted/ringing), consider ignoring or prompt user?
        const callStatus = store.getState().videoChat.callStatus;
        if (callStatus === "accepted" || callStatus === "ringing") {
            console.warn("[socket.on call-request] Already in a call - ignoring new call request.");
            return;
        }

        store.dispatch(setCallRequest(data) as any);
    });

    /**
     * We define one global "call-response" handler here
     * so it doesn't re-bind every time we do callRequest().
     */
    socket.on("call-response", (respData: any) => {
        console.log("[socket.on call-response]", respData);

        // If we have no peer, or the call is already ended, skip
        if (!currentPeerConnection) {
            console.warn("[socket.on call-response] No currentPeerConnection, ignoring.");
            return;
        }

        const status = respData.accepted ? "accepted" : "rejected";
        store.dispatch(setCallStatus(status) as any);

        if (respData.accepted && respData.signal) {
            console.log("[socket.on call-response] ACCEPTED. Signalling local peer...");
            store.dispatch(setOtherUserId(respData.otherUserId) as any);

            try {
                currentPeerConnection.signal(respData.signal);
            } catch (err) {
                console.error("[socket.on call-response] peer.signal threw error:", err);
            }
        } else if (!respData.accepted) {
            console.log("[socket.on call-response] Rejected call.");
            store.dispatch(setCallRequest(null) as any);
        }
    });

    socket.on("notify-chat-left", (data: any) => {
        console.log("[socket.on notify-chat-left]", data.userId, "left the chat");
        if (data.fromOngoing) {
            store.dispatch({
                type: "SetFeedbackModalShow",
                payload: data.userId,
            });
        }
        store.dispatch(clearVideoChat("User left the chat...!") as any);
    });

    socket.on("setRemoteVideoAudioStatus", (data: any) => {
        console.log("[socket.on setRemoteVideoAudioStatus]", data);
        store.dispatch(setVideoAudioStatus(data.videoEnabled, data.audioEnabled, false) as any);
    });

    // ---- ROOM EVENTS
    socket.on("room-create", (data: { roomDetails: ActiveRoom }) => {
        console.log("[socket.on room-create]", data);
        newRoomCreated(data);
    });

    socket.on("active-rooms", (data: { activeRooms: ActiveRoom[] }) => {
        console.log("[socket.on active-rooms]", data);
        updateActiveRooms(data);
    });

    socket.on("active-rooms-initial", (data: { activeRooms: ActiveRoom[] }) => {
        console.log("[socket.on active-rooms-initial]", data);
        initialRoomsUpdate(data);
    });

    socket.on("conn-prepare", (data: { connUserSocketId: string }) => {
        console.log("[socket.on conn-prepare]", data);
        const { connUserSocketId } = data;
        prepareNewPeerConnection(connUserSocketId, false);
        socket?.emit("conn-init", { connUserSocketId });
    });

    socket.on("conn-init", (data: { connUserSocketId: string }) => {
        console.log("[socket.on conn-init]", data);
        const { connUserSocketId } = data;
        prepareNewPeerConnection(connUserSocketId, true);
    });

    socket.on("conn-signal", (data: { connUserSocketId: string; signal: SimplePeer.SignalData }) => {
        console.log("[socket.on conn-signal]", data);
        handleSignalingData(data);
    });

    socket.on("room-participant-left", (data: { connUserSocketId: string }) => {
        console.log("[socket.on room-participant-left]", data);
        handleParticipantLeftRoom(data);
    });

    // ---- EXPERT ACTIONS
    socket.on("kicked-off-by-expert", (data: { roomId: string }) => {
        console.log("[socket.on kicked-off-by-expert]", data);
        store.dispatch(showAlert("You are blocked from this seminar by the expert."));
        leaveRoom();
        cancelCallRequest({ otherUserId: "" });
    });

    socket.on("muted-by-expert", (data: { roomId: string }) => {
        console.log("[socket.on muted-by-expert]", data);
        store.dispatch(showAlert("You are force muted by the expert."));
        store.dispatch({ type: "setForceMuted", payload: true });
    });

    socket.on("enabled-audio-by-expert", (data: { roomId: string }) => {
        console.log("[socket.on enabled-audio-by-expert]", data);
        store.dispatch(showAlert("Your audio is enabled by the expert."));
        store.dispatch({ type: "setForceMuted", payload: false });
    });

    socket.on("setAudioStatusInRoom", (data: any) => {
        console.log("[socket.on setAudioStatusInRoom]", data);
    });

    socket.on("cancelCallRequest", () => {
        console.log("[socket.on cancelCallRequest]");
        store.dispatch(setCallRequest(null) as any);
        store.dispatch(clearVideoChat("User left the call") as any);
    });
};

// ================== DIRECT / GROUP MESSAGES ==================
export const sendDirectMessage = (data: { message: any; receiverUserId: string }) => {
    console.log("[sendDirectMessage]", data);
    socket?.emit("direct-message", data);
};

export const sendGroupMessage = (data: { message: any; groupChatId: string }) => {
    console.log("[sendGroupMessage]", data);
    socket?.emit("group-message", data);
};

export const fetchDirectChatHistory = (data: { receiverUserId: string; currentPage: number }) => {
    console.log("[fetchDirectChatHistory]", data);
    socket?.emit("direct-chat-history", data);
};

export const fetchGroupChatHistory = (data: { groupChatId: string; currentPage: number }) => {
    console.log("[fetchGroupChatHistory]", data);
    socket?.emit("group-chat-history", data);
};

export const notifyTyping = (data: { chatId: any; receiverId: any; typing: boolean }) => {
    console.log("[notifyTyping]", data);
    socket?.emit("notify-typing", data);
};

// ================== CALLS ==================

/**
 * Caller side: Initiate a call request.
 * The "call-response" is now globally handled in `socket.on("call-response")`.
 */
export const callRequest = (data: {
    receiverUserId: string;
    callerName: string;
    audioOnly: boolean;
    eventId?: string;
}) => {
    console.log("[callRequest] function invoked with data:", data);

    // If already in "accepted" or "ringing" state, skip re-calling
    const callStatus = store.getState().videoChat.callStatus;
    if (callStatus === "accepted" || callStatus === "ringing") {
        console.warn("[callRequest] Already in a call - ignoring new request.");
        return;
    }

    // Create the peer w/ initiator = true
    const peerConnection = () => {
        console.log("[callRequest -> peerConnection] Creating new peer (initiator=true)");
        store.dispatch(setOtherUserId(data.receiverUserId) as any);

        const peer = newPeerConnection(true);
        currentPeerConnection = peer;

        peer.on("signal", (signal) => {
            console.log("[callRequest -> peer.on signal] Emitting call-request...");
            socket?.emit("call-request", { ...data, signal });
        });

        peer.on("stream", (remoteStream) => {
            console.log("[callRequest -> peer.on stream] Got remote stream:", remoteStream);
            store.dispatch(setRemoteStream(remoteStream) as any);
        });
    };

    console.log("[callRequest] -> getLocalStreamPreview");
    getLocalStreamPreview(
        data.audioOnly,
        () => {
            console.log("[callRequest -> getLocalStreamPreview (success)]");
            peerConnection();
            store.dispatch(setCallStatus("ringing") as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);
        },
        false,
        (error) => {
            console.error("[callRequest -> getLocalStreamPreview (error)]", error);
        }
    );
};

/**
 * Callee side: Accept or reject an incoming call.
 * The "call-request" was handled in socket.on("call-request").
 */
export const callResponse = (data: {
    callerId: string;
    callerName: string;
    accepted: boolean;
    audioOnly: boolean;
}) => {
    console.log("[callResponse] function invoked with data:", data);
    // Immediately tell server we accepted or not
    socket?.emit("call-response", data);

    if (!data.accepted) {
        console.log("[callResponse] call NOT accepted. Clearing callRequest");
        return store.dispatch(setCallRequest(null) as any);
    }

    // Create the peer w/ initiator = false
    const peerConnection = () => {
        console.log("[callResponse -> peerConnection] Creating new peer (initiator=false)");
        const peer = newPeerConnection(false);
        currentPeerConnection = peer;

        peer.on("signal", (signal) => {
            console.log("[callResponse -> peer.on signal] Emitting call-response w/ signal");
            socket?.emit("call-response", { ...data, signal });
        });

        peer.on("stream", (remoteStream) => {
            console.log("[callResponse -> peer.on stream] Got remote stream:", remoteStream);
            store.dispatch(setRemoteStream(remoteStream) as any);
            store.dispatch(
                setChosenChatDetails({
                    userId: data.callerId,
                    username: data.callerName,
                    image: "",
                })
            );
        });

        // The initial offer signal from the caller is in callRequest.signal
        const incomingSignal = store.getState().videoChat.callRequest?.signal;
        console.log("[callResponse -> peerConnection] about to peer.signal(incomingSignal):", incomingSignal);

        if (incomingSignal) {
            try {
                peer.signal(incomingSignal);
            } catch (err) {
                console.error("[callResponse] peer.signal threw error:", err);
            }
        }
    };

    console.log("[callResponse] -> getLocalStreamPreview");
    getLocalStreamPreview(
        data.audioOnly,
        () => {
            console.log("[callResponse -> getLocalStreamPreview (success)]");
            peerConnection();
            store.dispatch(setCallRequest(null) as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);
        },
        false,
        (error) => {
            console.error("[callResponse -> getLocalStreamPreview (error)]", error);
        }
    );
};

// Cancel an outgoing call
export const cancelCallRequest = (data: { otherUserId: string }) => {
    console.log("[cancelCallRequest] data:", data);
    store.dispatch(setOtherUserId("") as any);
    socket?.emit("cancelCallRequest", data);
};

// Tells server user left the chat
export const notifyChatLeft = (receiverUserId: string, fromOngoing: boolean) => {
    console.log("[notifyChatLeft] with:", { receiverUserId, fromOngoing });
    socket?.emit("notify-chat-left", { receiverUserId, fromOngoing });
};

// ============ ROOM UTILS ============

export const createNewRoom = (groupId: string) => {
    console.log("[createNewRoom] groupId:", groupId);
    socket?.emit("room-create", { groupId });
};

export const joinRoom = (data: { roomId: string }) => {
    console.log("[joinRoom] data:", data);
    socket?.emit("room-join", data);
};

export const leaveRoomEmit = (data: { roomId: string }) => {
    console.log("[leaveRoomEmit] data:", data);
    socket?.emit("room-leave", data);
};

export const kickCustomerFromRoom = (data: { customerId: string; roomId: any }) => {
    console.log("[kickCustomerFromRoom] data:", data);
    socket?.emit("kickCustomerFromRoom", data);
};

export const forceMuteCustomerFromRoom = (data: { customerId: string; roomId: any }) => {
    console.log("[forceMuteCustomerFromRoom] data:", data);
    socket?.emit("forceMuteCustomerFromRoom", data);
};

export const enableAudioCustomerFromRoom = (data: { customerId: string; roomId: any }) => {
    console.log("[enableAudioCustomerFromRoom] data:", data);
    socket?.emit("enableAudioCustomerFromRoom", data);
};

export const setAudioStatusInRoom = (data: {
    customerId: string;
    roomId: any;
    audioStatus: boolean;
}) => {
    console.log("[setAudioStatusInRoom] data:", data);
    socket?.emit("setAudioStatusInRoom", data);
};

// "conn-signal" for WebRTC
export const signalPeerData = (data: { signal: SimplePeer.SignalData; connUserSocketId: string }) => {
    console.log("[signalPeerData]", data);
    socket?.emit("conn-signal", data);
};

// Tells the other side that we toggled our audio/video
export const setRemoteVideoAudioStatus = (data: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    otherUserId: string;
}) => {
    console.log("[setRemoteVideoAudioStatus]", data);
    socket?.emit("setRemoteVideoAudioStatus", data);
};

export const emitLogOut = () => {
    console.log("[emitLogOut]");
    socket?.emit("log-out");
};

export const closeSocketConnection = () => {
    console.log("[closeSocketConnection] Disconnecting socket...");
    socket?.disconnect();
    console.log("[closeSocketConnection] Done.");
};

// Exports for convenience
export { socket, currentPeerConnection, setCurrentPeerConnection };
