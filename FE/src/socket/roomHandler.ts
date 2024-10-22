import {
    setOpenRoom,
    setRoomDetails,
    setActiveRooms,
    setLocalStreamRoom,
    setRemoteStreams,
    setScreenSharingStreamRoom,
    setIsUserJoinedOnlyWithAudio,
} from "../actions/roomActions";
import { ActiveRoom } from "../actions/types";
import { store } from "../store";
import * as socketConnection from "./socketConnection";
import { closeAllConnections, getLocalStreamPreview } from "./webRTC";

export const createNewRoom = (groupId: string) => {
    const successCallbackFunc = () => {
        store.dispatch(setOpenRoom(true, true) as any);

        const audioOnly = store.getState().room.audioOnly;
        store.dispatch(setIsUserJoinedOnlyWithAudio(audioOnly) as any);
        socketConnection.createNewRoom(groupId);
    };

    const audioOnly = store.getState().room.audioOnly;
    getLocalStreamPreview(audioOnly, successCallbackFunc, true);
};

export const newRoomCreated = (data: { roomDetails: ActiveRoom }) => {
    const { roomDetails } = data;
    store.dispatch(setRoomDetails(roomDetails) as any);
};

export const updateActiveRooms = (data: { activeRooms: ActiveRoom[] }) => {
    const { activeRooms } = data;

    const {
        friends: { friends, groupChatList },
        auth: { userDetails },
        room: { roomDetails },
    } = store.getState();
    const rooms: ActiveRoom[] = [];

    const userId = userDetails?._id;

    activeRooms.forEach((room: ActiveRoom) => {
        const isRoomCreatedByMe = room.roomCreator.userId === userId;

        if (isRoomCreatedByMe) {
            rooms.push(room);
        } else {
            let isFriend = false
            for (let i = 0; i < friends.length; i++) {
                if (friends[i].id === room.roomCreator.userId) {
                    isFriend = true
                    break;
                }
            }
            if (isFriend) {
                rooms.push(room)
            } else {
                for (let i = 0; i < groupChatList.length; i++) {
                    if (groupChatList[i].participants.findIndex((x:any) => x._id === room.roomCreator.userId) > -1) {
                        rooms.push(room)
                        break;
                    }
                }
            }
        }

        if(room.roomId === roomDetails?.roomId) {
            store.dispatch(setRoomDetails(room) as any);
        }
        
    });

    store.dispatch(setActiveRooms(rooms) as any);
};

export const initialRoomsUpdate = (data: { activeRooms: ActiveRoom[] }) => {
    const { activeRooms } = data;

    store.dispatch(setActiveRooms(activeRooms) as any);
};

export const joinRoom = (room: ActiveRoom) => {
    const successCallbackFunc = () => {
        store.dispatch(setRoomDetails(room) as any);
        store.dispatch(setOpenRoom(false, true) as any);
        const audioOnly = store.getState().room.audioOnly;
        store.dispatch(setIsUserJoinedOnlyWithAudio(audioOnly) as any);
        socketConnection.joinRoom({ roomId: room.roomId });
    };

    const audioOnly = store.getState().room.audioOnly;
    getLocalStreamPreview(audioOnly, successCallbackFunc, true);
};

export const leaveRoom = () => {
    const roomId = store.getState().room.roomDetails?.roomId;

    if (roomId) {
        socketConnection.leaveRoomEmit({ roomId });
    }

    store.dispatch(setRemoteStreams([]) as any);
    closeAllConnections();
    store.dispatch(setRoomDetails(null) as any);
    store.dispatch(setOpenRoom(false, false) as any);

    const localStream = store.getState().room.localStreamRoom;
    store.dispatch(setLocalStreamRoom(null) as any);
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        store.dispatch(setLocalStreamRoom(null) as any);
    }

    const screenSharingStream = store.getState().room.screenSharingStream;
    if (screenSharingStream) {
        screenSharingStream.getTracks().forEach((track) => track.stop());
        store.dispatch(setScreenSharingStreamRoom(null) as any);
    }
};
