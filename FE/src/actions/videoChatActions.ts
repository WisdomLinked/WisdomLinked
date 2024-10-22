import { Dispatch } from "redux";
import { ThunkAction } from "redux-thunk";
import SimplePeer from "simple-peer";
import { actionTypes, CallStatus, ClearVideChatState } from "./types";
import { showAlert } from "./alertActions";
import { RootState } from "../store";
import { currentPeerConnection, setCurrentPeerConnection, setRemoteVideoAudioStatus } from "../socket/socketConnection";

// FOR VIRTUAL STREAM ---------- added ( | Boolean )
export const setLocalStream = (stream: MediaStream | null | Boolean) => {
    return {
        type: actionTypes.setLocalStream,
        payload: stream,
    };
};

export const setRemoteStream = (stream: MediaStream | null) => {
    return {
        type: actionTypes.setRemoteStream,
        payload: stream,
    };
};

export const setCallStatus = (status: CallStatus) => {
    return {
        type: actionTypes.setCallStatus,
        payload: {
            status,
        },
    };
};

export const setCallRequest = (
    callRequest: {
        callerName: string;
        audioOnly: boolean;
        callerUserId: string;
        signal: SimplePeer.SignalData;
    } | null
) => {
    return (dispatch: Dispatch) => {
        dispatch({
            type: actionTypes.setCallRequest,
            payload: callRequest,
        });

        if (callRequest?.callerUserId) {
            dispatch({
                type: actionTypes.setOtherUserId,
                payload: {
                    otherUserId: callRequest.callerUserId,
                },
            });
        }
    };
};

export const clearVideoChat = (
    message: string
): ThunkAction<void, RootState, unknown, ClearVideChatState> => {
    return (dispatch, getState) => {

        const {
            videoChat: { localStream, screenSharingStream },
        } = getState();

        localStream?.getTracks().forEach((track:any) => track.stop());
        screenSharingStream?.getTracks().forEach((track:any) => track.stop());

        // destroy the active peer connection with the other user that was established
        // if (currentPeerConnection) {
        //     currentPeerConnection.destroy();
        //     console.log("DESTROYED PEER CONNECTION");
        // }

        // setCurrentPeerConnection(null);

        dispatch({
            type: actionTypes.resetVideoChatState,
        });
        if (message)
            dispatch(showAlert(message) as any);
    };
};

export const setOtherUserId = (otherUserId: string) => {
    return {
        type: actionTypes.setOtherUserId,
        payload: {
            otherUserId,
        },
    };
};

export const setScreenSharingStream = (stream: MediaStream | null) => {
    return {
        type: actionTypes.setScreenSharingStream,
        payload: {
            stream,
            isScreenSharing: !!stream,
        },
    };
};

export const setAudioOnly = (audioOnly: boolean) => {
    return {
        type: actionTypes.setAudioOnly,
        payload: {
            audioOnly,
        },
    };
};

export const setVideoAudioStatus = (videoEnabled: boolean, audioEnabled: boolean, isLocalStream: boolean) => {
    if (isLocalStream) {
        return (dispatch:any, getState:any) => {
            const {
                chat: { chosenChatDetails },
                videoChat: { otherUserId }
            } = getState();
            setRemoteVideoAudioStatus({videoEnabled, audioEnabled, otherUserId: otherUserId})
            dispatch({
                type: actionTypes.setLocalVideoAudioStatus,
                payload: {
                    videoEnabled: videoEnabled,
                    audioEnabled: audioEnabled
                }
            });
        }
    } else {
        return {
            type: actionTypes.setRemoteVideoAudioStatus,
            payload: {
                videoEnabled: videoEnabled,
                audioEnabled: audioEnabled
            }
        }
    }
} 
