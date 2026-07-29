import { Reducer } from "redux";
import { AuthActions, actionTypes } from "../actions/types";
import { doUpdateMissedChats } from "../api/api";
import { persistUserDetails } from "../utils/safeLocalStorage";

interface AuthState {
    userDetails: any;
    error: boolean;
    errorMessage: string;
    loading: boolean;
}

const initialState: AuthState = {
    userDetails: null,
    error: false,
    errorMessage: "",
    loading: false,
};

const authReducer = (
    state = initialState,
    action: any
) => {
    switch (action.type) {
        case actionTypes.authenticate:
            return {
                error: false,
                errorMessage: "",
                userDetails: action.payload,
                loading: false,
            };

        case actionTypes.authError:
            return {
                ...state,
                error: true,
                errorMessage: action.payload,
                loading: false,
            };

        case actionTypes.logout:
            return {
                error: false,
                errorMessage: "",
                userDetails: null,
                loading: false,
            };
        case 'updateUserDetails':
            let userDetails = {
                ...state.userDetails,
                ...action.payload
            }
            persistUserDetails(localStorage, "currentUser", userDetails);
            return {
                ...state,
                userDetails: userDetails
            }

        case actionTypes.resetFriends:
            return {
                ...initialState
            };

        case 'updateMissedChatsOfGeneralChat':
            const { receiverId, count } = action.payload
            console.log('OK', receiverId, count)
            let updatedGeneralChat: any = []
            let missedChats = state.userDetails.missedChats?.[receiverId] || 0
            missedChats = count === null ? missedChats + 1 : count
            doUpdateMissedChats(receiverId, missedChats)

            state.userDetails.generalChats.map((chat: any, index: number) => {
                let updatedAt = chat.updatedAt
                if (chat._id === receiverId) {
                    updatedAt = count !== null ? chat.updatedAt : new Date().getTime()
                }
                updatedGeneralChat.push({
                    ...chat,
                    updatedAt: updatedAt
                })
            })
            return {
                ...state,
                userDetails: {
                    ...state.userDetails,
                    generalChats: updatedGeneralChat,
                    missedChats: {
                        ...state.userDetails.missedChats,
                        [receiverId]: missedChats
                    }
                }
            }

        case 'updateLastChatDateOfGeneralChat':
            const { groupChatId, date } = action.payload
            let updatedGeneralChat1: any = []

            state.userDetails.generalChats.map((chat: any, index: number) => {
                let updatedAt = chat.updatedAt
                if (chat._id === groupChatId) {
                    updatedAt = date
                }
                updatedGeneralChat1.push({
                    ...chat,
                    updatedAt: updatedAt
                })
            })
            return {
                ...state,
                userDetails: {
                    ...state.userDetails,
                    generalChats: updatedGeneralChat1
                }
            }

        default:
            return state;
    }
};

export { authReducer };
