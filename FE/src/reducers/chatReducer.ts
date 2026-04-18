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
    /** Rocket.Chat room id → unread count when that room is not the active thread. */
    dmUnreadByRid: Record<string, number>;
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
    dmUnreadByRid: {} as Record<string, number>,
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
            {
            const next = action.payload;
            const prev = state.chosenChatDetails;
            const nextUid = String(next?.userId ?? '');
            const prevUid = prev ? String(prev.userId ?? '') : '';
            const sameDm = Boolean(nextUid && prevUid && nextUid === prevUid);
            return {
                ...state,
                chosenGroupChatDetails: null,
                chosenChatDetails: sameDm
                    ? {
                          ...state.chosenChatDetails,
                          ...next,
                          typing: state.chosenChatDetails?.typing || {
                              typing: false,
                              userId: "",
                              chatId: ""
                          },
                      }
                    : {
                          ...next,
                          typing: {
                              typing: false,
                              userId: "",
                              chatId: ""
                          },
                      },
                messages: sameDm ? state.messages : [],
                gotAllChats: sameDm ? state.gotAllChats : false,
                currentPage: sameDm ? state.currentPage : 0
            };
            }

        case actionTypes.setChosenGroupChatDetails: {
            const next = action.payload;
            const prev = state.chosenGroupChatDetails;
            const nextGid = String(next?.groupId ?? next?._id ?? '');
            const prevGid = prev ? String(prev.groupId ?? prev._id ?? '') : '';
            const sameGroup = Boolean(nextGid && prevGid && nextGid === prevGid);

            return {
                ...state,
                chosenChatDetails: null,
                chosenGroupChatDetails: next,
                messages: sameGroup ? state.messages : [],
                gotAllChats: sameGroup ? state.gotAllChats : false,
                currentPage: sameGroup ? state.currentPage : 0,
            };
        }

        case actionTypes.setMessages:
            // Pagination: prepend older page (API returns chronological oldest-first for that page).
            return {
                ...state,
                messages: [...action.payload, ...state.messages],
                currentPage: state.currentPage + 1,
                gotAllChats: action.payload.length < 20,
                isNewMessage: false
            };

        case actionTypes.replaceChatMessages:
            return {
                ...state,
                messages: Array.isArray(action.payload) ? [...action.payload] : [],
                currentPage: 1,
                gotAllChats: !action.payload || action.payload.length < 20,
                isNewMessage: false
            };

        case actionTypes.removeChatMessage: {
            const id = String(action.payload ?? '');
            return {
                ...state,
                messages: state.messages.filter((m: any) => String(m?._id) !== id),
            };
        }

        case actionTypes.incrementDmUnreadRid: {
            const rid = String(action.payload ?? '');
            if (!rid) return state;
            const prev = state.dmUnreadByRid[rid] || 0;
            return {
                ...state,
                dmUnreadByRid: { ...state.dmUnreadByRid, [rid]: prev + 1 },
            };
        }

        case actionTypes.clearDmUnreadRid: {
            const rid = action.payload;
            if (rid == null) {
                return { ...state, dmUnreadByRid: {} };
            }
            const key = String(rid);
            const next = { ...state.dmUnreadByRid };
            delete next[key];
            return { ...state, dmUnreadByRid: next };
        }

        case actionTypes.addNewMessage:
            if (state.messages.some((m: any) => String(m?._id) === String(action.payload?._id))) {
                return state;
            }
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
                dmUnreadByRid: {},
                currentPage: 0,
                gotAllChats: false,
                isNewMessage: false
            };

        default:
            return state;
    }
};

export { chatReducer };
