import { actionTypes, ActiveRoom } from "./types";

export const setOpenRoom = (
    isUserRoomCreator = false,
    isUserInRoom = false
) => {
    return {
        type: actionTypes.openRoom,
        payload: {
            isUserRoomCreator,
            isUserInRoom,
        },
    };
};

// export const getActions = (dispatch) => {
//     return {
//         setAudioOnly: (audioOnly) => dispatch(setAudioOnly(audioOnly)),
//         setScreenSharingStream: (stream) => {
//             dispatch(setScreenSharingStream(stream));
//         },
//     };
// };

export const setRoomDetails = (roomDetails: ActiveRoom | null) => {
    return {
        type: actionTypes.setRoomDetails,
        payload: {
            roomDetails,
        }
    };
};

export const setActiveRooms = (activeRooms: ActiveRoom[]) => {
    return {
        type: actionTypes.setActiveRooms,
        payload: {
            activeRooms,
        },
    };
};

// FOR VIRTUAL STREAM ---------- added ( | Boolean )
export const setLocalStreamRoom = (localStreamRoom: MediaStream | null | Boolean) => {
    return {
        type: actionTypes.setLocalStreamRoom,
        payload: {
            localStreamRoom,
        },
    };
};

export const setAudioOnlyRoom = (audioOnly: boolean) => {
    return {
        type: actionTypes.setAudioOnlyRoom,
        payload: {
            audioOnly,
        },
    };
};

export const setRemoteStreams = (remoteStreams: Array<MediaStream | Boolean>) => {
    return {
        type: actionTypes.setRemoteStreams,
        payload: {
            remoteStreams,
        },
    };
};

export const setScreenSharingStreamRoom = (stream: MediaStream | null) => {
    return {
        type: actionTypes.setScreenSharingStreamRoom,
        payload: {
            isScreenSharingActive: stream ? true : false,
            screenSharingStream: stream || null,
        },
    };
};

export const setIsUserJoinedOnlyWithAudio = (onlyWithAudio: boolean) => {
    return {
        type: actionTypes.setIsUserJoinedWithAudioOnly,
        payload: {
            isUserJoinedWithOnlyAudio: onlyWithAudio,
        },
    };
};
