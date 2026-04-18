

export enum actionTypes {
    authenticate,
    logout,
    authError,
    authLoading,

    showAlert,
    hideAlert,

    setFriends,
    setPendingInvitations,
    setOnlineUsers,
    setGroupChatList,
    resetFriends,

    setChatType,
    setChosenChatDetails,
    setMessages,
    addNewMessage,
    updateMissedChats,
    updateLastChatDate,
    resetChat,
    setChosenGroupChatDetails,

    setTyping,
    setCurrentEvent,
    setInitialTypingStatus,

    setLocation,
    setLocalStreamAvailability,

    setChatChannelInfo,
    /** Replace thread messages (initial load / switch chat). Pagination still uses setMessages prepend. */
    replaceChatMessages,
    incrementDmUnreadRid,
    clearDmUnreadRid,
    removeChatMessage,
}

export interface CurrentUser {
    _id: string;
    email: string;
    username: string;
}
interface AuthSuccessAction {
    type: actionTypes.authenticate;
    payload: {
        _id: string;
        email: string;
        username: string;
    };
}

interface AuthErrorAction {
    type: actionTypes.authError;
    payload: string;
}

interface LogoutAction {
    type: actionTypes.logout;
}

interface ShowAlertAction {
    type: actionTypes.showAlert;
    payload: string;
}

interface HideAlertAction {
    type: actionTypes.hideAlert;
}

export interface PendingInvitation {
    _id: string;
    senderId: {
        username: string;
        email: string;
        _id: string;
    };
}

export interface Friend {
    id: string;
    username: string;
    email: string;
    missedChats: any;
    lastChatDate: any;
}

export interface OnlineUser {
    userId: string;
}

export interface GroupChatDetails {
    groupId: string;
    groupName: string;
    participants: Array<{
        _id: string;
        username: string;
        email: string;
        role: string;
        status: string;
    }>;
    admin: {
        _id: string;
        username: string;
        email: string;
        role: string;
        status: string;
    };
    missedChats: any;
    lastChatDate: any;
    type: string;
}

interface SetPendingInvitationAction {
    type: actionTypes.setPendingInvitations;
    payload: Array<PendingInvitation>;
}

interface SetFriends {
    type: actionTypes.setFriends;
    payload: Array<Friend>;
}

interface SetOnlineUsers {
    type: actionTypes.setOnlineUsers;
    payload: Array<OnlineUser>;
}

export interface SetGroupChatList {
    type: actionTypes.setGroupChatList;
    payload: Array<GroupChatDetails>;
}

export interface SetChosenChatDetails {
    type: actionTypes.setChosenChatDetails;
    payload: {
        userId: string;
        username: string;
    };
}

export interface SetChosenGroupChatDetails {
    type: actionTypes.setChosenGroupChatDetails;
    payload: GroupChatDetails;
}

export interface ResetChat {
    type: actionTypes.resetChat;
}

export interface ResetFriends {
    type: actionTypes.resetFriends;
}

export interface Message {
    _id: string;
    content: string;
    author: {
        username: string;
        _id: string;
        email: string;
        role: string;
        status: string;
    };
    createdAt: string;
}

export interface Typing {
    typing: boolean;
    userId: string;
    chatId: any
}

export interface SetMessages {
    type: actionTypes.setMessages;
    payload: Array<Message>;
}

export interface ReplaceChatMessages {
    type: actionTypes.replaceChatMessages;
    payload: Array<Message>;
}

export interface IncrementDmUnreadRid {
    type: actionTypes.incrementDmUnreadRid;
    payload: string;
}

export interface ClearDmUnreadRid {
    type: actionTypes.clearDmUnreadRid;
    payload: string | null;
}

export interface RemoveChatMessage {
    type: actionTypes.removeChatMessage;
    payload: string;
}

export interface AddNewMessage {
    type: actionTypes.addNewMessage;
    payload: Message;
}

export interface UpdateMissedChats {
    type: actionTypes.updateMissedChats;
    payload: any;
}
export interface UpdateLastChatDate {
    type: actionTypes.updateLastChatDate;
    payload: any;
}

export interface SetTyping {
    type: actionTypes.setTyping;
    payload: {
        typing: boolean;
        userId: string;
    };
}

export interface SetCurrentEvent {
    type: actionTypes.setCurrentEvent;
    payload: any;
}

export interface SetInitialTypingStatus {
    type: actionTypes.setInitialTypingStatus;
    payload: Array<Typing>;
}

// APP ACTION TYPES
interface SetLocation {
    type: actionTypes.setLocation;
    payload: string;
}

interface SetLocalStreamAvailability {
    type: actionTypes.setLocalStreamAvailability,
    payload: any
}

export type AppActions =
    | SetLocation
    | SetLocalStreamAvailability;
export type AuthActions =
    | AuthSuccessAction
    | AuthErrorAction
    | LogoutAction;
export type AlertActions = ShowAlertAction | HideAlertAction;
export type FriendsActions =
    | SetPendingInvitationAction
    | SetFriends
    | SetOnlineUsers
    | SetGroupChatList
    | UpdateMissedChats
    | UpdateLastChatDate
    | ResetFriends;
export interface SetChatChannelInfo {
    type: actionTypes.setChatChannelInfo;
    payload: {
        conversationId: string;
        rcChannelId: string | null;
    };
}

export type ChatActions =
    | SetChosenChatDetails
    | SetChosenGroupChatDetails
    | SetMessages
    | ReplaceChatMessages
    | AddNewMessage
    | SetTyping
    | SetCurrentEvent
    | SetInitialTypingStatus
    | SetChatChannelInfo
    | ResetChat
    | IncrementDmUnreadRid
    | ClearDmUnreadRid
    | RemoveChatMessage;
