import { actionTypes } from "../actions/types";

const initialState = {
    location: '',
    loading: false,
    videoStreamAvailable: false,
    audioStreamAvailable: false,
    feedbackModalShow: false,
    connectedWithSocketServer: false,
};

const appReducer = (
    state = initialState,
    action:any
) => {
    switch (action.type) {
        case actionTypes.setLocation:
            return {
                ... state,
                location: action.payload,
            };
        
        case actionTypes.setLocalStreamAvailability:
            return {
                ... state,
                videoStreamAvailable: action.payload.videoStream ? true : false,
                audioStreamAvailable: action.payload.audioStream ? true : false,
            }
        
        case "SetFeedbackModalShow":
            return {
                ... state,
                feedbackModalShow: action.payload,
            }
        
        case "SetConnectedWithSocketServer":
            return {
                ... state,
                 connectedWithSocketServer: action.payload,
            }
        
        case "SetLoadingStatus":
            return {
                ... state,
                loading: action.payload,
            }

        default:
            return state;
    }
};

export { appReducer };
