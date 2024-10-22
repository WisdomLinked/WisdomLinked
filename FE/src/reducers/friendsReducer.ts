import { Reducer } from "redux";
import { FriendsActions, actionTypes, PendingInvitation, Friend, OnlineUser, GroupChatDetails } from "../actions/types";
import { doUpdateMissedChats } from "../api/api";


const initialState = {
    friends: [],
    pendingInvitations: [],
    onlineUsers: [],
    groupChatList: []
};

interface FriendsState {
    friends: Array<any>;
    pendingInvitations: Array<PendingInvitation>;
    onlineUsers: Array<OnlineUser>;
    groupChatList: Array<GroupChatDetails>;
}


const friendsReducer: Reducer<FriendsState, FriendsActions> = (
    state = initialState,
    action
) => {
    switch (action.type) {
        case actionTypes.setPendingInvitations:
            return {
                ...state,
                pendingInvitations: action.payload,
            };

        case actionTypes.setFriends:
            return {
                ...state,
                friends: action.payload,
            };

        case actionTypes.setOnlineUsers:
            return {
                ...state,
                onlineUsers: action.payload,
            };

        case actionTypes.setGroupChatList:
            return {
                ...state,
                groupChatList: action.payload,
            };

        case actionTypes.resetFriends:
            return {
                ...initialState
            };

        case actionTypes.updateMissedChats:
            const { receiverId, groupId, count } = action.payload
            let updatedFriends: any = []
            if (receiverId) {
                state.friends.map((friend: any, index: number) => {
                    let missedChats = friend.missedChats
                    if (friend.id === receiverId) {
                        missedChats = count === null ? missedChats + 1 : count
                        doUpdateMissedChats(receiverId, missedChats)
                    }
                    updatedFriends.push({
                        ...friend,
                        missedChats: missedChats,
                        lastChatDate: count !== null ? friend.lastChatDate : new Date().getTime()
                    })
                })
            }
            let updatedGroupChats: any = []
            if (groupId) {
                state.groupChatList.map((groupChat: any, index: number) => {
                    let missedChats = groupChat.missedChats || 0
                    if (groupChat.groupId === groupId) {
                        missedChats = count === null ? missedChats + 1 : count
                        doUpdateMissedChats(groupId, missedChats)
                    }
                    updatedGroupChats.push({
                        ...groupChat,
                        missedChats: missedChats,
                        lastChatDate: count !== null ? groupChat.lastChatDate : new Date().getTime()
                    })
                })
            }

            let temp2: any = {
                ...state
            }

            if (receiverId) {
                temp2.friends = updatedFriends
            }

            if (groupId) {
                temp2.groupChatList = updatedGroupChats
            }

            return temp2

        case actionTypes.updateLastChatDate:
            const { participants, groupChatId, date } = action.payload
            let temp: any = []
            if (participants) {
                state.friends.map((friend: any, index: number) => {
                    let lastChatDate = friend.lastChatDate
                    if (participants.includes(friend.id)) {
                        lastChatDate = date
                    }
                    temp.push({
                        ...friend,
                        lastChatDate: lastChatDate,
                    })
                })
            }

            let temp1: any = []
            if (groupChatId) {
                state.groupChatList.map((groupChat: any) => {
                    let lastChatDate = groupChat.lastChatDate
                    if (groupChatId === groupChat.groupId) {
                        lastChatDate = date
                    }
                    temp1.push({
                        ...groupChat,
                        lastChatDate: lastChatDate,
                    })
                })
            }

            let result = {
                ...state
            }

            if (participants) {
                result.friends = temp
            }

            if (groupChatId) {
                result.groupChatList = temp1
            }

            return result

        default:
            return state;
    }
};

export { friendsReducer };
