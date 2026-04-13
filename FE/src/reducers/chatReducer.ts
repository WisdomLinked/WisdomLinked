import { Reducer } from "redux";
import { ChatActions, actionTypes } from "../actions/types";


enum ChatTypes {
    direct = "DIRECT",
    group = "GROUP",
}

interface Message {
    _id: string;
    content: string;
    author: {
        username: string;
        _id: string;
        image: any;
        role: string;
        status: any;
    }
    createdAt: string,
}


interface ChatState {
    chatType: ChatTypes;
    chosenChatDetails: any;
    chosenGroupChatDetails: any;
    conversationId: string | null;
    rcChannelId: string | null;
    typing: Array<{
        userId: string;
        typing: boolean;
        chatId: any;
    }>;
    groupTyping: Array<any>;
    messages: Array<Message>;
    gotAllChats: Boolean;
    currentPage: number;
    isNewMessage: Boolean;
    currentEvent: any;
}


const initialState = {
    chosenChatDetails: null,
    chosenGroupChatDetails: null,
    conversationId: null,
    rcChannelId: null,
    typing: [],
    groupTyping: [],
    chatType: ChatTypes.direct,
    messages: [],
    gotAllChats: false,
    currentPage: 0,
    isNewMessage: false,
    currentEvent: null
};



const chatReducer: Reducer<ChatState, ChatActions> = (
    state = initialState,
    action: any
) => {
    switch (action.type) {
        case actionTypes.setChosenChatDetails:
            return {
                ...state,
                chosenGroupChatDetails: null,
                messages: [],
                chosenChatDetails: {
                    ...action.payload,
                    typing: {
                        typing: false,
                        userId: "",
                        chatId: ""
                    },
                },
                gotAllChats: false,
                currentPage: 0
            };

        case actionTypes.setChosenGroupChatDetails:
            return {
                ...state,
                chosenChatDetails: null,
                messages: [],
                chosenGroupChatDetails: action.payload,
                gotAllChats: false,
                currentPage: 0
            };

        case actionTypes.setMessages:
            return {
                ...state,
                messages: [...action.payload.reverse(), ...state.messages],
                currentPage: state.currentPage + 1,
                gotAllChats: action.payload.length < 20,
                isNewMessage: false
            };

        case actionTypes.addNewMessage:
            return {
                ...state,
                messages: [...state.messages, action.payload],
                isNewMessage: true,
            };

        case actionTypes.setInitialTypingStatus:
            return {
                ...state,
                typing: action.payload,
            };

        case actionTypes.setTyping:

            if (action.payload.chatId) {
                const { chatId, userId, typing } = action.payload
                let groupTyping = state.groupTyping
                let groupChatTypingIndex = groupTyping.findIndex((item) => item.chatId === chatId)
                if (groupChatTypingIndex > -1) {
                    groupTyping[groupChatTypingIndex] = {
                        chatId: chatId,
                        [userId]: typing
                    }
                } else {
                    groupTyping.push({
                        chatId: chatId,
                        [userId]: typing
                    })
                }
                return {
                    ...state,
                    groupTyping: [...groupTyping],
                }
            } else {
                return {
                    ...state,
                    typing: state.typing.map((item) => {
                        if (item.userId === action.payload.userId) {
                            return action.payload;
                        } else {
                            return item;
                        }
                    }),
                };
            }
        case actionTypes.setCurrentEvent:
            return {
                ...state,
                currentEvent: action.payload,
            };

        case actionTypes.setChatChannelInfo:
            return {
                ...state,
                conversationId: action.payload.conversationId,
                rcChannelId: action.payload.rcChannelId,
            };

        case actionTypes.resetChat:
            return {
                ...state,
                chosenChatDetails: null,
                chosenGroupChatDetails: null,
                conversationId: null,
                rcChannelId: null,
                messages: [],
                currentPage: 0,
                gotAllChats: false,
                isNewMessage: false
            };

        default:
            return state;
    }
};

export { chatReducer };
