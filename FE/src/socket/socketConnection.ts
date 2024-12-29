import { io, Socket } from "socket.io-client";
import { store } from "../store";
import SimplePeer from "simple-peer";

// Actions
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
import {
    setLocalStreamRoom,
} from "../actions/roomActions";
import {
    updateMe
} from "../actions/authActions";
import {
    showAlert
} from "../actions/alertActions";
import {
    initialRoomsUpdate,
    newRoomCreated,
    updateActiveRooms,
    leaveRoom
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

// We'll store the current PeerConnection for direct calls here:
let currentPeerConnection: any = null;
const setCurrentPeerConnection = (peerConnection: any) => {
    currentPeerConnection = peerConnection;
};

let socket: Socket<any, any>;

// Make sure to set this properly in your .env or environment variables
const SERVER_URL: any = process.env.REACT_APP_SERVER_URL;

export const connectWithSocketServer = (userDetails: UserDetails) => {
    console.log("[connectWithSocketServer] Attempting to connect to:", SERVER_URL);
    console.log("[connectWithSocketServer] userDetails:", userDetails);

    socket = io(SERVER_URL, {
        auth: {
            email: userDetails.email,
        },
    });

    socket.on("connect", () => {
        console.log(
            `Successfully connected to socket.io server. Connected socket.id: ${socket.id}`
        );
    });

    // Example emit to the server
    socket.emit("helloFomClient");

    // ============ FRIENDS & INVITATIONS ============
    socket.on("friend-invitations", (data: any) => {
        console.log("[socket.on friend-invitations]", data);
        store.dispatch(setPendingInvitations(data) as any);
    });

    socket.on("friends-list", (data: any) => {
        console.log("[socket.on friends-list]", data);
        const typingStatusOfFriends = data.map((friend: any) => {
            return {
                userId: friend.id,
                typing: false,
            };
        });
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

    // ============ CHAT MESSAGES ============
    socket.on("direct-chat-history", (data: any) => {
        console.log("[socket.on direct-chat-history]", data);
        const { messages, participants } = data;

        const chatDetails = store.getState().chat.chosenChatDetails;

        if (chatDetails) {
            const receiverId = chatDetails.userId;
            const senderId = (store.getState().auth.userDetails as any)._id;

            // only update the store with messages if the participant is the one we are currently chatting with
            const isActive =
                participants.includes(receiverId) &&
                participants.includes(senderId);

            if (isActive) {
                store.dispatch(setMessages(messages) as any);
            }
        }
    });

    socket.on("group-chat-history", (data: any) => {
        console.log("[socket.on group-chat-history]", data);
        const { messages, groupChatId } = data;

        const groupChatDetails = store.getState().chat.chosenGroupChatDetails;

        if (groupChatDetails) {
            // only update if the group chat is the one we are currently in
            const isActive = groupChatDetails.groupId === groupChatId;
            if (isActive) {
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
            const senderId = (store.getState().auth.userDetails as any)._id;

            const isActive =
                participants.includes(receiverId) &&
                participants.includes(senderId);

            if (isActive) {
                store.dispatch(addNewMessage(newMessage) as any);
            }
        }

        // Missed Chats
        console.log("[direct-message] Checking friends index for newMessage.author._id");
        console.log("friends?", friends);
        console.log("newMessage.author._id?", newMessage.author._id);
        if (friends.findIndex((x: any) => x.id === newMessage.author._id) > -1
            && chatDetails?.userId !== newMessage.author._id
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

        if (chatDetails) {
            const isActive = chatDetails.groupId === groupChatId;
            if (isActive) {
                store.dispatch(addNewMessage(newMessage) as any);
            }
        }

        const groupChatList = store.getState().friends.groupChatList;
        if (
            groupChatList.findIndex((x: any) => x.groupId === groupChatId) > -1 &&
            chatDetails?.groupId !== groupChatId
        ) {
            store.dispatch(updateMissedChats(null, groupChatId, null));
        } else if (
            userDetails.generalChats.findIndex((x: any) => x._id === groupChatId) > -1 &&
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

    // ============ CALLS ============
    socket.on("call-request", (data: any) => {
        console.log("[socket.on call-request]", data);
        store.dispatch(setCallRequest(data) as any);
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

    // ============ ROOM EVENTS ============
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
        // prepare new peer connection for the connUserSocketId
        prepareNewPeerConnection(connUserSocketId, false);
        socket.emit("conn-init", { connUserSocketId: connUserSocketId });
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

    // ============ EXPERT ACTIONS ============
    socket.on("kicked-off-by-expert", (data: { roomId: string }) => {
        console.log("[socket.on kicked-off-by-expert]", data);
        store.dispatch(showAlert("You are blocked from this seminar by the expert."));
        leaveRoom();
        cancelCallRequest({ otherUserId: "" });
    });

    socket.on("muted-by-expert", (data: { roomId: string }) => {
        console.log("[socket.on muted-by-expert]", data);
        store.dispatch(showAlert("You are force muted by the expert."));
        store.dispatch({
            type: "setForceMuted",
            payload: true,
        });
    });

    socket.on("enabled-audio-by-expert", (data: { roomId: string }) => {
        console.log("[socket.on enabled-audio-by-expert]", data);
        store.dispatch(showAlert("Your audio is enabled by the expert."));
        store.dispatch({
            type: "setForceMuted",
            payload: false,
        });
    });

    socket.on("setAudioStatusInRoom", (data: any) => {
        console.log("[socket.on setAudioStatusInRoom]", data);
        // handle as needed
    });

    socket.on("cancelCallRequest", () => {
        console.log("[socket.on cancelCallRequest]");
        store.dispatch(setCallRequest(null) as any);
        store.dispatch(clearVideoChat("User left the call") as any);
    });
};

// ============ DIRECT MESSAGE ============
export const sendDirectMessage = (data: {
    message: any;
    receiverUserId: string;
}) => {
    console.log("[sendDirectMessage]", data);
    socket.emit("direct-message", data);
};

export const sendGroupMessage = (data: { message: any; groupChatId: string }) => {
    console.log("[sendGroupMessage]", data);
    socket.emit("group-message", data);
};

export const fetchDirectChatHistory = (data: { receiverUserId: string; currentPage: number }) => {
    console.log("[fetchDirectChatHistory]", data);
    socket.emit("direct-chat-history", data);
};

export const fetchGroupChatHistory = (data: { groupChatId: string; currentPage: number }) => {
    console.log("[fetchGroupChatHistory]", data);
    socket.emit("group-chat-history", data);
};

export const notifyTyping = (data: { chatId: any; receiverId: any; typing: boolean }) => {
    console.log("[notifyTyping]", data);
    socket.emit("notify-typing", data);
};

// ============ CALLS ============
export const callRequest = (data: {
    receiverUserId: string;
    callerName: string;
    audioOnly: boolean;
    eventId: string;
}) => {
    console.log("[callRequest] function invoked with data:", data);
    const peerConnection = () => {
        console.log("[callRequest -> peerConnection] Creating a new peer with initiator=true");
        store.dispatch(setOtherUserId(data.receiverUserId) as any);
        const peer = newPeerConnection(true);
        currentPeerConnection = peer;

        console.log("[callRequest -> peerConnection] peer object:", peer);

        // This will only show if `peer` is null/undefined
        if (!peer) {
            console.log("[callRequest -> peerConnection] WARNING: peer is empty 0");
        }

        peer.on("signal", (signal) => {
            console.log("[peer.on signal] Emitting call-request with signal:");
            if (!peer) {
                console.log("[callRequest -> peerConnection -> peer.on signal] WARNING: peer is empty 1");
            }
            socket.emit("call-request", {
                ...data,
                signal,
            });
        });

        peer.on("stream", (stream) => {
            console.log("[peer.on stream] Got remote stream:", stream);
            if (!peer) {
                console.log("[callRequest -> peerConnection -> peer.on stream] WARNING: peer is empty 2");
            }
            store.dispatch(setRemoteStream(stream) as any);
        });

        // Listen for call-response from server
        socket.on("call-response", (respData: any) => {
            console.log("[socket.on call-response]", respData);
            if (!peer) {
                console.log("[callRequest -> peerConnection -> socket.on call-response] WARNING: peer is empty 3");
            }
            const status = respData.accepted ? "accepted" : "rejected";
            store.dispatch(setCallStatus(status) as any);

            if (respData.accepted && respData.signal) {
                console.log("[callRequest -> peerConnection -> call-response] ACCEPTED. Signalling peer...");
                if (!peer) {
                    console.log("[callRequest -> peerConnection -> call-response] WARNING: peer is empty 4");
                }
                store.dispatch(setOtherUserId(respData.otherUserId) as any);
                peer.signal(respData.signal);
            }
        });
    };

    // Attempt to get local stream
    console.log("[callRequest] -> getLocalStreamPreview called next");
    getLocalStreamPreview(
        data.audioOnly,
        () => {
            console.log("[callRequest -> getLocalStreamPreview (successCB)]");
            peerConnection();
            store.dispatch(setCallStatus("ringing") as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);
        },
        false,
        (error) => {
            console.error("[callRequest -> getLocalStreamPreview (errorCB)]", error);
            // store.dispatch(setCallStatus("ringing") as any);
            // store.dispatch(setAudioOnly(data.audioOnly) as any);
        }
    );
};

export const callResponse = (data: {
    callerId: string;
    callerName: string;
    accepted: boolean;
    audioOnly: boolean;
}) => {
    console.log("[callResponse] function invoked with data:", data);
    socket.emit("call-response", data);

    if (!data.accepted) {
        console.log("[callResponse] call NOT accepted. Clearing callRequest");
        return store.dispatch(setCallRequest(null) as any);
    }

    const peerConnection = () => {
        console.log("[callResponse -> peerConnection] Creating new peer with initiator=false");
        const peer = newPeerConnection(false);
        currentPeerConnection = peer;

        console.log("[callResponse -> peerConnection] peer object:", peer);

        peer.on("signal", (signal) => {
            console.log("[peer.on signal in callResponse] Emitting call-response with signal");
            socket.emit("call-response", {
                ...data,
                signal,
            });
        });

        peer.on("stream", (stream) => {
            console.log("[peer.on stream in callResponse] Got remote stream:", stream);
            store.dispatch(setRemoteStream(stream) as any);
            store.dispatch(
                setChosenChatDetails({ userId: data.callerId, username: data.callerName, image: "" })
            );
        });

        // The signal from the caller is stored in videoChat.callRequest?.signal
        const callReqSignal = store.getState().videoChat.callRequest?.signal!;
        console.log("[callResponse -> peerConnection] About to peer.signal(callReqSignal)", callReqSignal);
        peer.signal(callReqSignal);
    };

    console.log("[callResponse] -> getLocalStreamPreview called next");
    getLocalStreamPreview(
        data.audioOnly,
        () => {
            console.log("[callResponse -> getLocalStreamPreview (successCB)]");
            peerConnection();
            store.dispatch(setCallRequest(null) as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);
        },
        false,
        (error) => {
            console.error("[callResponse -> getLocalStreamPreview (errorCB)]", error);
        }
    );
};

// ============ CANCEL CALLS, NOTIFY, ROOMS, ETC. ============
export const cancelCallRequest = (data: { otherUserId: string }) => {
    console.log("[cancelCallRequest] data:", data);
    store.dispatch(setOtherUserId("") as any);
    socket.emit("cancelCallRequest", data);
};

export const notifyChatLeft = (receiverUserId: string, fromOngoing: boolean) => {
    console.log("[notifyChatLeft] with:", { receiverUserId, fromOngoing });
    socket.emit("notify-chat-left", {
        receiverUserId,
        fromOngoing,
    });
};

export const createNewRoom = (groupId: string) => {
    console.log("[createNewRoom] groupId:", groupId);
    socket.emit("room-create", { groupId: groupId });
};

export const joinRoom = (data: { roomId: string }) => {
    console.log("[joinRoom] data:", data);
    socket.emit("room-join", data);
};

export const leaveRoomEmit = (data: { roomId: string }) => {
    console.log("[leaveRoomEmit] data:", data);
    socket.emit("room-leave", data);
};

export const kickCustomerFromRoom = (data: { customerId: string; roomId: any }) => {
    console.log("[kickCustomerFromRoom] data:", data);
    socket.emit("kickCustomerFromRoom", data);
};

export const forceMuteCustomerFromRoom = (data: { customerId: string; roomId: any }) => {
    console.log("[forceMuteCustomerFromRoom] data:", data);
    socket.emit("forceMuteCustomerFromRoom", data);
};

export const enableAudioCustomerFromRoom = (data: { customerId: string; roomId: any }) => {
    console.log("[enableAudioCustomerFromRoom] data:", data);
    socket.emit("enableAudioCustomerFromRoom", data);
};

export const setAudioStatusInRoom = (data: {
    customerId: string;
    roomId: any;
    audioStatus: boolean;
}) => {
    console.log("[setAudioStatusInRoom] data:", data);
    socket.emit("setAudioStatusInRoom", data);
};

export const signalPeerData = (data: {
    signal: SimplePeer.SignalData;
    connUserSocketId: string;
}) => {
    console.log("[signalPeerData]", data);
    socket.emit("conn-signal", data);
};

export const setRemoteVideoAudioStatus = (data: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    otherUserId: string;
}) => {
    console.log("[setRemoteVideoAudioStatus]", data);
    socket.emit("setRemoteVideoAudioStatus", data);
};

export const emitLogOut = () => {
    console.log("[emitLogOut]");
    socket.emit("log-out");
};

export const closeSocketConnection = () => {
    console.log("[closeSocketConnection] Disconnecting socket...");
    socket?.disconnect();
    console.log("[closeSocketConnection] Done.");
};

// Exports for convenience
export {
    socket,
    currentPeerConnection,
    setCurrentPeerConnection
};

// import { io, Socket } from "socket.io-client";
// import {
//     setFriends,
//     setGroupChatList,
//     setOnlineUsers,
//     setPendingInvitations,
//     updateLastChatDate,
//     updateMissedChats,
// } from "../actions/friendActions";
// import {
//     addNewMessage,
//     setChosenChatDetails,
//     setInitialTypingStatus,
//     setMessages,
//     setTyping,
// } from "../actions/chatActions";
// import { ActiveRoom, Message } from "../actions/types";
// import { store } from "../store";
// import {
//     setCallRequest,
//     setCallStatus,
//     setOtherUserId,
//     setRemoteStream,
//     clearVideoChat,
//     setAudioOnly,
//     setVideoAudioStatus,
// } from "../actions/videoChatActions";
// import {
//     getLocalStreamPreview,
//     handleParticipantLeftRoom,
//     handleSignalingData,
//     newPeerConnection,
//     prepareNewPeerConnection,
// } from "./webRTC";
// import SimplePeer from "simple-peer";
// import { initialRoomsUpdate, newRoomCreated, updateActiveRooms, leaveRoom } from "./roomHandler";
// import { setLocalStreamRoom } from "../actions/roomActions";
// import { updateMe } from "../actions/authActions";
// import { showAlert } from "../actions/alertActions";
//
// export interface UserDetails {
//     email: string;
//     // token: string;
//     username: string;
// }
//
// let currentPeerConnection: any = null;
//
// const setCurrentPeerConnection = (peerConnection: any) => {
//     currentPeerConnection = peerConnection;
// };
//
// let socket: Socket<any, any>;
//
// const SERVER_URL: any = process.env.REACT_APP_SERVER_URL;
//
// const connectWithSocketServer = (userDetails: UserDetails) => {
//     socket = io(SERVER_URL, {
//         auth: {
//             email: userDetails.email,
//         },
//     });
//
//     socket.on("connect", () => {
//         console.log(
//             `Successfully connected to socket.io server. Connected socket.id: ${socket.id}`
//         );
//     });
//
//     socket.emit("helloFomClient");
//
//     socket.on("friend-invitations", (data: any) => {
//         store.dispatch(setPendingInvitations(data) as any);
//     });
//
//     socket.on("friends-list", (data: any) => {
//         const typingStatusOfFriends = data.map((friend: any) => {
//             return {
//                 userId: friend.id,
//                 typing: false,
//             };
//         });
//
//         store.dispatch(setInitialTypingStatus(typingStatusOfFriends));
//         store.dispatch(setFriends(data) as any);
//
//     });
//
//     socket.on("online-users", (data: any) => {
//         store.dispatch(setOnlineUsers(data) as any);
//     });
//
//     socket.on("groupChats-list", async (data: any) => {
//         store.dispatch(updateMe())
//         store.dispatch(setGroupChatList(data) as any);
//     });
//
//     socket.on("direct-chat-history", (data: any) => {
//         const { messages, participants } = data;
//         console.log('[SOCKET: direct-chat-history]', data);
//
//         const chatDetails = store.getState().chat.chosenChatDetails;
//
//         if (chatDetails) {
//             const receiverId = chatDetails.userId;
//             const senderId = (store.getState().auth.userDetails as any)._id;
//
//             // only update the store with messages if the participant is the one we are currently chatting with
//             const isActive =
//                 participants.includes(receiverId) &&
//                 participants.includes(senderId);
//
//             if (isActive) {
//                 store.dispatch(setMessages(messages) as any);
//             }
//         }
//     });
//
//     socket.on("group-chat-history", (data: any) => {
//         console.log('[SOCKET: group-chat-history]', data);
//         const { messages, groupChatId } = data;
//
//         const groupChatDetails = store.getState().chat.chosenGroupChatDetails;
//
//         if (groupChatDetails) {
//             // only update the store with messages if the group chat is the one we are currently in
//             const isActive = groupChatDetails.groupId === groupChatId;
//
//             if (isActive) {
//                 store.dispatch(setMessages(messages) as any);
//             }
//         }
//     });
//
//     socket.on("direct-message", (data: any) => {
//         const { newMessage, participants } = data;
//
//         const chatDetails = store.getState().chat.chosenChatDetails;
//         const friends = store.getState().friends.friends
//
//         if (chatDetails) {
//             const receiverId = chatDetails.userId;
//             const senderId = (store.getState().auth.userDetails as any)._id;
//
//             const isActive =
//                 participants.includes(receiverId) &&
//                 participants.includes(senderId);
//
//             if (isActive) {
//                 store.dispatch(addNewMessage(newMessage) as any);
//             }
//         }
//         console.log(friends.findIndex(x => x.id === newMessage.author._id) > -1)
//
//         if (friends.findIndex(x => x.id === newMessage.author._id) > -1 && chatDetails?.userId !== newMessage.author._id) {
//             store.dispatch(updateMissedChats(newMessage.author._id, null, null))
//         }
//         store.dispatch(updateLastChatDate(participants, null, new Date().getTime()))
//     });
//
//     socket.on("group-message", (data: any) => {
//         const { newMessage, groupChatId } = data;
//
//         const chatDetails = store.getState().chat.chosenGroupChatDetails;
//         const userDetails = store.getState().auth.userDetails;
//
//         if (chatDetails) {
//             const isActive = chatDetails.groupId === groupChatId;
//
//             if (isActive) {
//                 store.dispatch(addNewMessage(newMessage) as any);
//             }
//         }
//
//         const groupChatList = store.getState().friends.groupChatList
//         if (groupChatList.findIndex(x => x.groupId === groupChatId) > -1 && chatDetails?.groupId !== groupChatId) {
//             store.dispatch(updateMissedChats(null, groupChatId, null))
//         } else if (userDetails.generalChats.findIndex((x: any) => x._id === groupChatId) > -1 && chatDetails?.groupId !== groupChatId) {
//             store.dispatch({
//                 type: 'updateMissedChatsOfGeneralChat',
//                 payload: { receiverId: groupChatId, count: null }
//             })
//         }
//         store.dispatch(updateLastChatDate(null, groupChatId, new Date().getTime()))
//         store.dispatch({
//             type: 'updateLastChatDateOfGeneralChat',
//             payload: { groupChatId: groupChatId, date: new Date().getTime() }
//         })
//     });
//
//     socket.on("notify-typing", (data: any) => {
//         store.dispatch(
//             setTyping({ typing: data.typing, userId: data.senderUserId, chatId: data.chatId }) as any
//         );
//     });
//
//     socket.on("call-request", (data: any) => {
//         store.dispatch(setCallRequest(data) as any);
//     });
//
//     socket.on("notify-chat-left", (data: any) => {
//         console.log(data.userId, 'left the chat')
//         if (data.fromOngoing) {
//             store.dispatch({
//                 type: "SetFeedbackModalShow",
//                 payload: data.userId
//             })
//         }
//         store.dispatch(clearVideoChat("User left the chat...!") as any);
//     });
//
//     socket.on("setRemoteVideoAudioStatus", (data: any) => {
//         store.dispatch(setVideoAudioStatus(data.videoEnabled, data.audioEnabled, false) as any);
//     });
//
//     // rooms
//     socket.on("room-create", (data: { roomDetails: ActiveRoom }) => {
//         newRoomCreated(data);
//     });
//
//     socket.on("active-rooms", (data: { activeRooms: ActiveRoom[] }) => {
//         updateActiveRooms(data);
//     });
//
//     socket.on("active-rooms-initial", (data: { activeRooms: ActiveRoom[] }) => {
//         initialRoomsUpdate(data);
//     });
//
//     socket.on("conn-prepare", (data: { connUserSocketId: string }) => {
//         const { connUserSocketId } = data;
//         // prepare new peer connection for the connUserSocketId joining the room
//         prepareNewPeerConnection(connUserSocketId, false);
//
//         socket.emit("conn-init", { connUserSocketId: connUserSocketId });
//     });
//
//     socket.on("conn-init", (data: { connUserSocketId: string }) => {
//         const { connUserSocketId } = data;
//         prepareNewPeerConnection(connUserSocketId, true);
//     });
//
//     socket.on(
//         "conn-signal",
//         (data: { connUserSocketId: string; signal: SimplePeer.SignalData }) => {
//             handleSignalingData(data);
//         }
//     );
//
//     socket.on("room-participant-left", (data: { connUserSocketId: string }) => {
//         handleParticipantLeftRoom(data);
//     });
//
//     socket.on("kicked-off-by-expert", (data: { roomId: string }) => {
//         store.dispatch(showAlert("You are blocked from this seminar by the expert."))
//         leaveRoom()
//         cancelCallRequest({ otherUserId: '' })
//     });
//
//     socket.on("muted-by-expert", (data: { roomId: string }) => {
//         store.dispatch(showAlert("You are force muted by the expert."))
//         store.dispatch({
//             type: 'setForceMuted',
//             payload: true,
//         })
//     });
//
//     socket.on("enabled-audio-by-expert", (data: { roomId: string }) => {
//         store.dispatch(showAlert("Your audio is enabled by the expert."))
//         store.dispatch({
//             type: 'setForceMuted',
//             payload: false,
//         })
//     });
//
//     socket.on("setAudioStatusInRoom", (data: any) => {
//
//     });
//
//     socket.on("cancelCallRequest", () => {
//         store.dispatch(setCallRequest(null) as any);
//         store.dispatch(clearVideoChat('User left the call') as any)
//     });
// };
//
// const sendDirectMessage = (data: {
//     message: any;
//     receiverUserId: string;
// }) => {
//     socket.emit("direct-message", data);
// };
//
// const sendGroupMessage = (data: { message: any; groupChatId: string }) => {
//     socket.emit("group-message", data);
// };
//
// const fetchDirectChatHistory = (data: { receiverUserId: string, currentPage: number }) => {
//     socket.emit("direct-chat-history", data);
// };
//
// const fetchGroupChatHistory = (data: { groupChatId: string, currentPage: number }) => {
//     socket.emit("group-chat-history", data);
// };
//
// const notifyTyping = (data: { chatId: any, receiverId: any; typing: boolean }) => {
//     socket.emit("notify-typing", data);
// };
//
// const callRequest = (data: {
//     receiverUserId: string;
//     callerName: string;
//     audioOnly: boolean;
//     eventId: string;
// }) => {
//     console.log("call request made");
//     const peerConnection = () => {
//         store.dispatch(setOtherUserId(data.receiverUserId) as any);
//         const peer = newPeerConnection(true);
//         currentPeerConnection = peer;
//         console.log("peer", peer);
//         if(!peer){
//             console.log("peer empty 0");
//         }
//         peer.on("signal", (signal) => {
//             console.log("SIGNAL", signal);
//             // TODO send data to server
//             if(!peer){
//                 console.log("peer empty 1");
//             }
//             socket.emit("call-request", {
//                 ...data,
//                 signal,
//             });
//         });
//
//         peer.on("stream", (stream) => {
//             console.log("REMOTE STREAM", stream);
//             if(!peer){
//                 console.log("peer empty 2");
//             }
//             // TODO set remote stream
//             store.dispatch(setRemoteStream(stream) as any);
//         });
//
//         socket.on("call-response", (data: any) => {
//             console.log('Call-response', data)
//             if(!peer){
//                 console.log("peer empty 3");
//             }
//             const status = data.accepted ? "accepted" : "rejected";
//             store.dispatch(setCallStatus(status) as any);
//
//             if (data.accepted && data.signal) {
//                 console.log("ACCEPTED", data.signal);
//                 if(!peer){
//                     console.log("peer empty 4");
//                 }
//                 store.dispatch(setOtherUserId(data.otherUserId) as any);
//                 peer.signal(data.signal);
//             }
//         });
//     };
//
//     getLocalStreamPreview(
//         data.audioOnly,
//         () => {
//             peerConnection();
//             store.dispatch(setCallStatus("ringing") as any);
//             store.dispatch(setAudioOnly(data.audioOnly) as any);
//         },
//         false,
//         (error) => {
//             console.error("Failed to get local stream preview:", error);
//             // store.dispatch(setCallStatus("ringing") as any);
//             // store.dispatch(setAudioOnly(data.audioOnly) as any);
//         }
//     );
// };
//
// const callResponse = (data: {
//     callerId: string;
//     callerName: string;
//     accepted: boolean;
//     audioOnly: boolean;
// }) => {
//     socket.emit("call-response", data);
//     if (!data.accepted) {
//         return store.dispatch(setCallRequest(null) as any);
//     }
//
//     const peerConnection = () => {
//         const peer = newPeerConnection(false);
//
//         currentPeerConnection = peer;
//
//         peer.on("signal", (signal) => {
//             console.log("SIGNAL", signal);
//
//             socket.emit("call-response", {
//                 ...data,
//                 signal,
//             });
//         });
//         peer.on("stream", (stream) => {
//             console.log("REMOTE STREAM 1", stream);
//             // TODO set remote stream
//             store.dispatch(setRemoteStream(stream) as any);
//             store.dispatch(setChosenChatDetails({ userId: data.callerId, username: data.callerName, image: '' }))
//         });
//
//         peer.signal(store.getState().videoChat.callRequest?.signal!);
//     };
//
//     getLocalStreamPreview(data.audioOnly, () => {
//         peerConnection();
//         store.dispatch(setCallRequest(null) as any);
//         store.dispatch(setAudioOnly(data.audioOnly) as any);
//     });
// };
//
// const cancelCallRequest = (data: {
//     otherUserId: string
// }) => {
//     store.dispatch(setOtherUserId('') as any);
//     socket.emit("cancelCallRequest", data);
// }
//
// const notifyChatLeft = (receiverUserId: string, fromOngoing: boolean) => {
//     socket.emit("notify-chat-left", {
//         receiverUserId,
//         fromOngoing
//     });
// };
//
// const createNewRoom = (groupId: string) => {
//     socket.emit("room-create", { groupId: groupId });
// };
//
// const joinRoom = (data: { roomId: string }) => {
//     socket.emit("room-join", data);
// };
//
// const leaveRoomEmit = (data: { roomId: string }) => {
//     socket.emit("room-leave", data);
// };
//
// const kickCustomerFromRoom = (data: { customerId: string, roomId: any }) => {
//     socket.emit("kickCustomerFromRoom", data)
// }
//
// const forceMuteCustomerFromRoom = (data: { customerId: string, roomId: any }) => {
//     socket.emit("forceMuteCustomerFromRoom", data)
// }
//
// const enableAudioCustomerFromRoom = (data: { customerId: string, roomId: any }) => {
//     socket.emit("enableAudioCustomerFromRoom", data)
// }
//
// const setAudioStatusInRoom = (data: { customerId: string, roomId: any, audioStatus: boolean }) => {
//     socket.emit("setAudioStatusInRoom", data)
// }
//
//
// const signalPeerData = (data: {
//     signal: SimplePeer.SignalData;
//     connUserSocketId: string;
// }) => {
//     socket.emit("conn-signal", data);
// };
//
// const setRemoteVideoAudioStatus = (data: {
//     audioEnabled: boolean,
//     videoEnabled: boolean,
//     otherUserId: string
// }) => {
//     socket.emit("setRemoteVideoAudioStatus", data);
// };
//
// const emitLogOut = () => {
//     socket.emit("log-out");
// };
//
// const closeSocketConnection = () => {
//     console.log('CLOSING SOCKET CONNECTION');
//     socket?.disconnect();
// }
//
// export {
//     connectWithSocketServer,
//     sendDirectMessage,
//     fetchDirectChatHistory,
//     notifyTyping,
//     callRequest,
//     callResponse,
//     notifyChatLeft,
//     currentPeerConnection,
//     setCurrentPeerConnection,
//     sendGroupMessage,
//     fetchGroupChatHistory,
//     setRemoteVideoAudioStatus,
//     cancelCallRequest,
//
//     createNewRoom,
//     joinRoom,
//     leaveRoomEmit,
//     signalPeerData,
//     kickCustomerFromRoom,
//     forceMuteCustomerFromRoom,
//     enableAudioCustomerFromRoom,
//     setAudioStatusInRoom,
//
//     emitLogOut,
//     closeSocketConnection
// };
