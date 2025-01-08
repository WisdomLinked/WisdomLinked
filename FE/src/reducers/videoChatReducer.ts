import { Reducer } from "redux";
import SimplePeer from "simple-peer";
import { VideoChatActions, actionTypes } from "../actions/types";



export interface VideoChatState {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    otherUserId: string | null;
    audioOnly: boolean;
    screenSharingStream: MediaStream | null; 
    screenSharing: boolean;
    localVideoEnabled: boolean;
    localAudioEnabled: boolean;
    remoteVideoEnabled: boolean;
    remoteAudioEnabled: boolean;

    // what caller will see
    callStatus: "ringing" | "accepted" | "rejected" | "left" | null;

    // what receiver will see
    callRequest: {
        callerName: string;
        audioOnly: boolean;
        callerUserId: string;
        signal: SimplePeer.SignalData;
    } | null;

    loading: boolean;
}

const initialState: any = {
    localStream: null,
    remoteStream: null,
    otherUserId: null, // id of the other user in the call
    audioOnly: false,
    screenSharingStream: null,
    screenSharing: false,
    callRequest: null,
    callStatus: null,
    localVideoEnabled: true,
    localAudioEnabled: true,
    remoteVideoEnabled: true,
    remoteAudioEnabled: true,
    forceMuted: false,
    loading: false,
};

const videoChatReducer: Reducer = (
    state = initialState,
    action
) => {
    switch (action.type) {
        case actionTypes.setLocalStream:
            return {
                ...state,
                localStream: action.payload,
            };

        case actionTypes.setRemoteStream:
            return {
                ...state,
                remoteStream: action.payload,
            };

        case actionTypes.setCallRequest:
            return {
                ...state,
                callRequest: action.payload,
            };

        case actionTypes.setCallStatus:
            return {
                ...state,
                callStatus: action.payload.status,
            };

        case actionTypes.setOtherUserId:
            return {
                ...state,
                otherUserId: action.payload.otherUserId,
        };

        case actionTypes.resetVideoChatState:
            return initialState;

        case actionTypes.setScreenSharingStream:
            return {
                ...state,
                screenSharingStream: action.payload.stream,
                screenSharing: action.payload.isScreenSharing
            };

        case actionTypes.setAudioOnly:
            return {
                ...state,
                audioOnly: action.payload.audioOnly,
            };
        
        case actionTypes.setLocalVideoAudioStatus:
            return {
                ... state,
                localAudioEnabled: action.payload.audioEnabled,
                localVideoEnabled: action.payload.videoEnabled,
            }
        
        case actionTypes.setRemoteVideoAudioStatus:
            return {
                ... state,
                remoteAudioEnabled: action.payload.audioEnabled,
                remoteVideoEnabled: action.payload.videoEnabled,
            }

        case 'setForceMuted':
            return {
                ... state,
                forceMuted: action.payload
            }

        case "VIDEO_CHAT_LOADING":
            return {
                ...state,
                loading: action.payload,
            };
        
        default:
            return state;
    }
};

export default videoChatReducer;
