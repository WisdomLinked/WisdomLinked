import { io, Socket } from "socket.io-client";
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
import { ActiveRoom, Message } from "../actions/types";
import {store, useAppSelector} from "../store";
import {
    setCallRequest,
    setCallStatus,
    setOtherUserId,
    setRemoteStream,
    clearVideoChat,
    setAudioOnly,
    setVideoAudioStatus, setLocalStream, setVideoChatLoading,
} from "../actions/videoChatActions";
import {
    getLocalStreamPreview,
    handleParticipantLeftRoom,
    handleSignalingData,
    newPeerConnection,
    prepareNewPeerConnection,
} from "./webRTC";

import {
    SetTotalTimeSpent
} from "../actions/appActions";
import SimplePeer from "simple-peer";
import { initialRoomsUpdate, newRoomCreated, updateActiveRooms, leaveRoom } from "./roomHandler";
import { setLocalStreamRoom } from "../actions/roomActions";
import { updateMe } from "../actions/authActions";
import { showAlert } from "../actions/alertActions";

export interface UserDetails {
    email: string;
    username: string;
}

let currentPeerConnection: any = null;

const setCurrentPeerConnection = (peerConnection: any) => {
    currentPeerConnection = peerConnection;
};

let socket: Socket<any, any>;

const SERVER_URL: any = process.env.REACT_APP_SERVER_URL;

const connectWithSocketServer = (userDetails: UserDetails) => {
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

    socket.emit("helloFomClient");

    socket.on("friend-invitations", (data: any) => {
        store.dispatch(setPendingInvitations(data) as any);
    });

    socket.on("friends-list", (data: any) => {
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
        store.dispatch(setOnlineUsers(data) as any);
    });

    socket.on("groupChats-list", async (data: any) => {
        store.dispatch(updateMe())
        store.dispatch(setGroupChatList(data) as any);
    });

    socket.on("direct-chat-history", (data: any) => {
        const { messages, participants } = data;
        console.log('[SOCKET: direct-chat-history]', data);

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
        console.log('[SOCKET: group-chat-history]', data);
        const { messages, groupChatId } = data;

        const groupChatDetails = store.getState().chat.chosenGroupChatDetails;

        if (groupChatDetails) {
            // only update the store with messages if the group chat is the one we are currently in
            const isActive = groupChatDetails.groupId === groupChatId;

            if (isActive) {
                store.dispatch(setMessages(messages) as any);
            }
        }
    });

    socket.on("direct-message", (data: any) => {
        const { newMessage, participants } = data;
        const chatDetails = store.getState().chat.chosenChatDetails;
        const friends = store.getState().friends.friends

        if (chatDetails) {
            const receiverId = chatDetails.userId;
            const senderId = (store.getState().auth.userDetails as any)._id;
            const isActive = participants.includes(receiverId) && participants.includes(senderId);

            if (isActive) {
                store.dispatch(addNewMessage(newMessage) as any);
            }
        }
        console.log(friends.findIndex(x => x.id === newMessage.author._id) > -1)

        if (friends.findIndex(x => x.id === newMessage.author._id) > -1 && chatDetails?.userId !== newMessage.author._id) {
            store.dispatch(updateMissedChats(newMessage.author._id, null, null))
        }
        store.dispatch(updateLastChatDate(participants, null, new Date().getTime()))
    });

    socket.on("group-message", (data: any) => {
        const { newMessage, groupChatId } = data;
        const chatDetails = store.getState().chat.chosenGroupChatDetails;
        const userDetails = store.getState().auth.userDetails;

        if (chatDetails) {
            const isActive = chatDetails.groupId === groupChatId;
            if (isActive) {
                store.dispatch(addNewMessage(newMessage) as any);
            }
        }

        const groupChatList = store.getState().friends.groupChatList
        if (groupChatList.findIndex(x => x.groupId === groupChatId) > -1 && chatDetails?.groupId !== groupChatId) {
            store.dispatch(updateMissedChats(null, groupChatId, null))
        } else if (userDetails.generalChats.findIndex((x: any) => x._id === groupChatId) > -1 && chatDetails?.groupId !== groupChatId) {
            store.dispatch({
                type: 'updateMissedChatsOfGeneralChat',
                payload: { receiverId: groupChatId, count: null }
            })
        }
        store.dispatch(updateLastChatDate(null, groupChatId, new Date().getTime()))
        store.dispatch({
            type: 'updateLastChatDateOfGeneralChat',
            payload: { groupChatId: groupChatId, date: new Date().getTime() }
        })
    });

    socket.on("notify-typing", (data: any) => {
        store.dispatch(
            setTyping({ typing: data.typing, userId: data.senderUserId, chatId: data.chatId }) as any
        );
    });

    socket.on("call-request", (data: any) => {
        store.dispatch(setCallRequest(data) as any);
    });

    socket.on("notify-chat-left", (data: any) => {
        console.log(data.userId, 'left the chat')
        if (data.fromOngoing) {
            store.dispatch({
                type: "SetFeedbackModalShow",
                payload: data.userId
            })
        }
        store.dispatch(clearVideoChat("User left the chat...!") as any);
    });

    socket.on("setRemoteVideoAudioStatus", (data: any) => {
        store.dispatch(setVideoAudioStatus(data.videoEnabled, data.audioEnabled, false) as any);
    });

    // rooms
    socket.on("room-create", (data: { roomDetails: ActiveRoom }) => {
        newRoomCreated(data);
    });

    socket.on("active-rooms", (data: { activeRooms: ActiveRoom[] }) => {
        updateActiveRooms(data);
    });

    socket.on("active-rooms-initial", (data: { activeRooms: ActiveRoom[] }) => {
        initialRoomsUpdate(data);
    });

    socket.on("conn-prepare", (data: { connUserSocketId: string }) => {
        const { connUserSocketId } = data;
        // prepare new peer connection for the connUserSocketId joining the room
        prepareNewPeerConnection(connUserSocketId, false);

        socket.emit("conn-init", { connUserSocketId: connUserSocketId });
    });

    socket.on("conn-init", (data: { connUserSocketId: string }) => {
        const { connUserSocketId } = data;
        prepareNewPeerConnection(connUserSocketId, true);
    });

    socket.on(
        "conn-signal",
        (data: { connUserSocketId: string; signal: SimplePeer.SignalData }) => {
            handleSignalingData(data);
        }
    );

    socket.on("room-participant-left", (data: { connUserSocketId: string }) => {
        handleParticipantLeftRoom(data);
    });

    socket.on("kicked-off-by-expert", (data: { roomId: string }) => {
        store.dispatch(showAlert("You are blocked from this seminar by the expert."))
        leaveRoom()
        cancelCallRequest({ otherUserId: '' })
    });

    socket.on("muted-by-expert", (data: { roomId: string }) => {
        store.dispatch(showAlert("You are force muted by the expert."))
        store.dispatch({
            type: 'setForceMuted',
            payload: true,
        })
    });

    socket.on("enabled-audio-by-expert", (data: { roomId: string }) => {
        store.dispatch(showAlert("Your audio is enabled by the expert."))
        store.dispatch({
            type: 'setForceMuted',
            payload: false,
        })
    });

    // socket.on("setAudioStatusInRoom", (data: any) => {
    //
    // });

    socket.on("setAudioStatusInRoom", (data: any) => {
        // data contains { customerId, roomId, audioStatus }
        // We update the room's selfMutedParticipants array to reflect the user's new status
        const currentRoomDetails = store.getState().room.roomDetails;
        if (currentRoomDetails && currentRoomDetails.roomId === data.roomId) {
            if (!currentRoomDetails.selfMutedParticipants) {
                currentRoomDetails.selfMutedParticipants = [];
            }
            if (data.audioStatus === false) {
                // Add to selfMuted array if not present
                if (!currentRoomDetails.selfMutedParticipants.includes(data.customerId)) {
                    currentRoomDetails.selfMutedParticipants.push(data.customerId);
                }
            } else {
                // Remove from selfMuted array if present
                const index = currentRoomDetails.selfMutedParticipants.indexOf(data.customerId);
                if (index !== -1) {
                    currentRoomDetails.selfMutedParticipants.splice(index, 1);
                }
            }
            store.dispatch({
                type: "SET_ROOM_DETAILS",
                payload: { ...currentRoomDetails }
            });
        }
    });

    socket.on("cancelCallRequest", () => {
        store.dispatch(setCallRequest(null) as any);
        store.dispatch(clearVideoChat('User left the call') as any)
    });
};

const sendDirectMessage = (data: {
    message: any;
    receiverUserId: string;
}) => {
    socket.emit("direct-message", data);
};

const sendGroupMessage = (data: { message: any; groupChatId: string }) => {
    console.log("Emitting group message:", data);
    socket.emit("group-message", data);
};

const fetchDirectChatHistory = (data: { receiverUserId: string, currentPage: number }) => {
    socket.emit("direct-chat-history", data);
};

const fetchGroupChatHistory = (data: { groupChatId: string, currentPage: number }) => {
    socket.emit("group-chat-history", data);
};

const notifyTyping = (data: { chatId: any, receiverId: any; typing: boolean }) => {
    socket.emit("notify-typing", data);
};

const callRequest = (data: {
    receiverUserId: string;
    callerName: string;
    audioOnly: boolean;
    eventId: string;
    userRole: string;
}) => {
    console.log("Initiating call request with data:", data);

    // Cleanup before initiating a new call
    cleanupCall();

    const peerConnection = () => {
        store.dispatch(setOtherUserId(data.receiverUserId) as any);
        console.log("Dispatched receiver ID to Redux:", data.receiverUserId);

        const peer = newPeerConnection(true);
        currentPeerConnection = peer;

        peer.on("signal", (signal) => {
            console.log("Generated WebRTC signaling data:", signal);
            // TODO send data to server
            socket.emit("call-request", {...data, signal,});
        });

        peer.on("stream", (stream) => {
            console.log("Received remote media stream:", stream);
            // TODO set remote stream
            store.dispatch(setRemoteStream(stream) as any);
        });

        socket.on("call-response", (data: any) => {
            console.log("Received call response:", data);
            const status = data.accepted ? "accepted" : "rejected";
            store.dispatch(setCallStatus(status) as any);

            if (data.accepted && data.signal) {
                console.log("Call accepted with signaling data:", data.signal);
                store.dispatch(setOtherUserId(data.otherUserId) as any);
                peer.signal(data.signal);
            }
        });
    };

    getLocalStreamPreview(
        data.audioOnly,
        () => {
            console.log("Local stream obtained successfully.");
            peerConnection();
            store.dispatch(setCallStatus("ringing") as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);
        },
        false,
        () => {
            console.log("Failed to get local stream, retrying with audio only");
            peerConnection();
            store.dispatch(setCallStatus("ringing") as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);
        }
    );
};

const callResponse = (data: {
    callerId: string;
    callerName: string;
    accepted: boolean;
    audioOnly: boolean;
}) => {
    console.log("Sending call response:", data);
    socket.emit("call-response", data);

    if (!data.accepted) {
        console.log("Call rejected.");
        return store.dispatch(setCallRequest(null) as any);
    }

    store.dispatch(setCallStatus("accepted"));
    store.dispatch(setVideoChatLoading(true));

    const peerConnection = () => {
        console.log("Setting up WebRTC connection for response.");
        const peer = newPeerConnection(false);
        currentPeerConnection = peer;

        peer.on("signal", (signal) => {
            console.log("Generated signaling data for response:", signal);
            socket.emit("call-response", { ...data, signal });
        });

        peer.on("stream", (stream) => {
            console.log("Received remote media stream (response):", stream);
            store.dispatch(setRemoteStream(stream) as any);
            store.dispatch(setChosenChatDetails({ userId: data.callerId, username: data.callerName, image: '' }));
            store.dispatch(setVideoChatLoading(false));
        });

        peer.signal(store.getState().videoChat.callRequest?.signal!);
    };

    // Ensure the local stream initialization is consistent
    getLocalStreamPreview(
        data.audioOnly,
        () => {
            console.log("Local stream obtained for response.");
            peerConnection();
            store.dispatch(setCallRequest(null) as any);
            store.dispatch(setAudioOnly(data.audioOnly) as any);

            // Explicitly set playsInline attribute for iOS
            const localStream = store.getState().videoChat.localStream;
            if (localStream && localStream.getTracks().length > 0) {
                const videoElement = document.querySelector("video");
                if (videoElement) {
                    videoElement.setAttribute("playsInline", "true");
                    videoElement.muted = true;
                }
            }
        },
        false,
        (err) => {
            console.error("Error initializing local stream for response:", err);
        }
    );
};


const cancelCallRequest = (data: {
    otherUserId: string
}) => {
    store.dispatch(setOtherUserId('') as any);
    socket.emit("cancelCallRequest", data);
    cleanupCall();
}

const notifyChatLeft = (receiverUserId: string, fromOngoing: boolean) => {
    socket.emit("notify-chat-left", {
        receiverUserId,
        fromOngoing
    });
};

const createNewRoom = (groupId: string) => {
    socket.emit("room-create", { groupId: groupId });
};

const joinRoom = (data: { roomId: string }) => {
    socket.emit("room-join", data);
};

const leaveRoomEmit = (data: { roomId: string }) => {
    socket.emit("room-leave", data);
};

const kickCustomerFromRoom = (data: { customerId: string, roomId: any }) => {
    socket.emit("kickCustomerFromRoom", data)
}

const forceMuteCustomerFromRoom = (data: { customerId: string, roomId: any }) => {
    socket.emit("forceMuteCustomerFromRoom", data)
}

const enableAudioCustomerFromRoom = (data: { customerId: string, roomId: any }) => {
    socket.emit("enableAudioCustomerFromRoom", data)
}

// const setAudioStatusInRoom = (data: { customerId: string, roomId: any, audioStatus: boolean }) => {
//     socket.emit("setAudioStatusInRoom", data)
// }

const setAudioStatusInRoom = (data: {
    customerId: string;
    roomId: any;
    audioStatus: boolean;
}) => {
    socket.emit("setAudioStatusInRoom", data);
};


const signalPeerData = (data: {
    signal: SimplePeer.SignalData;
    connUserSocketId: string;
}) => {
    socket.emit("conn-signal", data);
};

// const setRemoteVideoAudioStatus = (data: {
//     audioEnabled: boolean,
//     videoEnabled: boolean,
//     otherUserId: string
// }) => {
//     socket.emit("setRemoteVideoAudioStatus", data);
// };

const setRemoteVideoAudioStatus = (data: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    otherUserId: string;
}) => {
    socket.emit("setRemoteVideoAudioStatus", data);
};

const emitLogOut = () => {
    socket.emit("log-out");
};

const closeSocketConnection = () => {
    console.log('CLOSING SOCKET CONNECTION');
    socket?.disconnect();
}

const cleanupCall = () => {
    console.log("Cleaning up after call...");

    // Destroy current peer connection
    if (currentPeerConnection) {
        if (currentPeerConnection.destroy) {
            currentPeerConnection.destroy();
            console.log("Peer connection destroyed.");
        }
        currentPeerConnection = null;
    }

    // Clear local stream
    const localStream = store.getState().videoChat.localStream;
    if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
        store.dispatch(setLocalStream(null));
        console.log("Local stream stopped and cleared.");
    }

    // Clear remote stream
    const remoteStream = store.getState().videoChat.remoteStream;
    if (remoteStream) {
        remoteStream.getTracks().forEach((track:any) => track.stop());
        store.dispatch(setRemoteStream(null));
        console.log("Remote stream stopped and cleared.");
    }

    // Remove specific WebSocket listeners
    socket.off("call-response");
    console.log("Removed WebSocket event listeners.");
};


export {
    connectWithSocketServer,
    sendDirectMessage,
    fetchDirectChatHistory,
    notifyTyping,
    callRequest,
    callResponse,
    notifyChatLeft,
    currentPeerConnection,
    setCurrentPeerConnection,
    sendGroupMessage,
    fetchGroupChatHistory,
    setRemoteVideoAudioStatus,
    cancelCallRequest,

    createNewRoom,
    joinRoom,
    leaveRoomEmit,
    signalPeerData,
    kickCustomerFromRoom,
    forceMuteCustomerFromRoom,
    enableAudioCustomerFromRoom,
    setAudioStatusInRoom,

    emitLogOut,
    closeSocketConnection
};
