import { Dispatch, } from "redux";
import { getMe } from "../api/api";
import { resetChatAction } from "./chatActions";
import { resetFriendsAction } from "./friendActions";
import { actionTypes, CurrentUser } from "./types";
import { closeSocketConnection, emitLogOut } from "../socket/socketConnection";

export const autoLogin = () => {
    return async (dispatch: Dispatch) => {
        dispatch({
            type: "SetLoadingStatus",
            payload: true,
        });

        try {
            const response: any = await getMe();
            if (response) {
                localStorage.setItem("currentUser", JSON.stringify(response.me));
                dispatch({
                    type: actionTypes.authenticate,
                    payload: {
                        ...response.me,
                    },
                });
            }
        } finally {
            dispatch({
                type: "SetLoadingStatus",
                payload: false,
            });
        }
    }
}

export const updateMe = () => {
    return async (dispatch: Dispatch) => {
        const response: any = await getMe();
        if (response) {
            localStorage.setItem("currentUser", JSON.stringify(response.me));
            dispatch({
                type: actionTypes.authenticate,
                payload: {
                    ...response.me,
                },
            });
        }
    }
}

export const logoutUser = () => {
    return async (dispatch: Dispatch, getState: any) => {
        localStorage.clear();
        dispatch({
            type: actionTypes.logout,
        });
        dispatch(resetChatAction());
        dispatch(resetFriendsAction());
        dispatch({
            type: actionTypes.resetChat
        })
        const {
            videoChat: { localStream, screenSharingStream },
            room: { localStreamRoom, screenSharingStream: screenSharingStreamRoom },
        } = getState();

        // Clear local stream and screen sharing stream from the video chat
        if (localStream) {
            localStream?.getTracks().forEach((track: any) => track.stop());
        }
        if (screenSharingStream) {
            screenSharingStream?.getTracks().forEach((track: any) => track.stop());
        }
        dispatch({
            type: actionTypes.resetVideoChatState,
        });

        // Clear local stream and screen sharing stream from the room
        if (localStreamRoom) {
            localStreamRoom.getTracks().forEach((track: any) => track.stop());
        }
        if (screenSharingStreamRoom) {
            screenSharingStreamRoom.getTracks().forEach((track: any) => track.stop());
        }
        dispatch({
            type: actionTypes.resetRoomState,
        });
        emitLogOut()
        closeSocketConnection()
        window.location.href = "/login";
    }
}