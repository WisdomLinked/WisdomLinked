// import { Dispatch } from "redux";
import {
    actionTypes,
    SetChosenChatDetails,
    SetMessages,
    Message,
    SetTyping,
    AddNewMessage,
    SetInitialTypingStatus,
    Typing,
    GroupChatDetails,
    SetChosenGroupChatDetails,
    ResetChat,
    SetChatChannelInfo,
    ReplaceChatMessages,
    IncrementDmUnreadRid,
    ClearDmUnreadRid,
    RemoveChatMessage,
} from "./types";

export const setChosenChatDetails = (chatDetails: {
    userId: string;
    username: string;
    image: any;
}): SetChosenChatDetails => {
    return {
        type: actionTypes.setChosenChatDetails,
        payload: chatDetails,
    };
};

export const setChosenGroupChatDetails = (chatDetails: GroupChatDetails): SetChosenGroupChatDetails => {
    return {
        type: actionTypes.setChosenGroupChatDetails,
        payload: chatDetails,
    };
};


export const setMessages = (messages: Array<Message>): SetMessages => {
    return {
        type: actionTypes.setMessages,
        payload: messages,
    };
};

export const replaceChatMessages = (messages: Array<Message>): ReplaceChatMessages => ({
    type: actionTypes.replaceChatMessages,
    payload: messages,
});

export const incrementDmUnreadRid = (rid: string): IncrementDmUnreadRid => ({
    type: actionTypes.incrementDmUnreadRid,
    payload: rid,
});

/** Pass `null` to clear all DM room unread badges. */
export const clearDmUnreadRid = (rid: string | null): ClearDmUnreadRid => ({
    type: actionTypes.clearDmUnreadRid,
    payload: rid,
});

export const removeChatMessage = (messageId: string): RemoveChatMessage => ({
    type: actionTypes.removeChatMessage,
    payload: messageId,
});

export const addNewMessage = (message: Message): AddNewMessage => {
    return {
        type: actionTypes.addNewMessage,
        payload: message,
    };
};


export const setTyping = (typing: Typing): SetTyping => {
    return {
        type: actionTypes.setTyping,
        payload: typing
    };
};

export const setInitialTypingStatus = (typing: Array<Typing>): SetInitialTypingStatus => {
    return {
        type: actionTypes.setInitialTypingStatus,
        payload: typing,
    };
};

export const resetChatAction = (): ResetChat => {
    return {
        type: actionTypes.resetChat
    }
}

export const setChatChannelInfo = (info: { conversationId: string; rcChannelId: string | null }): SetChatChannelInfo => {
    return {
        type: actionTypes.setChatChannelInfo,
        payload: info,
    };
};