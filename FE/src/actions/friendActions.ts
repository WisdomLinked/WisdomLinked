import { Dispatch } from "redux";
import { acceptFriendRequest, inviteFriendRequest, rejectFriendRequest, removeFriend } from "../api/api";
import { showSuccessAlert } from "./alertActions";
import { resetChatAction } from "./chatActions";
import { actionTypes, PendingInvitation, Friend, OnlineUser, GroupChatDetails, ResetFriends } from "./types";


export const inviteFriend = (email: string, closeDialogHandler: () => void) => {
    return async (dispatch: Dispatch) => {
        const response = await inviteFriendRequest({ email });

        if (response === "Invitation has been sent successfully") {
            closeDialogHandler();
            dispatch(showSuccessAlert(response));
        }
    };
};


export const setPendingInvitations = (pendingInvitations: PendingInvitation[]) => {
    return {
        type: actionTypes.setPendingInvitations,
        payload: pendingInvitations,
    };
}



export const setFriends = (
    friends: any
) => {
    return {
        type: actionTypes.setFriends,
        payload: friends,
    };
};


export const setOnlineUsers = (
    onlineUsers: OnlineUser[]
) => {
    return {
        type: actionTypes.setOnlineUsers,
        payload: onlineUsers,
    };
};


export const setGroupChatList = (chatList: GroupChatDetails[]) => {
    return {
        type: actionTypes.setGroupChatList,
        payload: chatList,
    };
};


export const rejectInvitation = (invitationId: string) => {
    return async (dispatch: Dispatch) => {
        const response = await rejectFriendRequest(invitationId);

        if (response === "Invitation rejected successfully!") {
            ;
            dispatch(showSuccessAlert(response));
        }
    };
};


export const acceptInvitation = (invitationId: string) => {
    return async (dispatch: Dispatch) => {
        const response = await acceptFriendRequest(invitationId);

        if (response === "Invitation accepted successfully!") {
            dispatch(showSuccessAlert(response));
        }
    };
};

export const removeFriendAction = ({ friendId, friendName }: { friendId: string; friendName: string }) => {
    return async (dispatch: Dispatch) => {
        const response = await removeFriend({
            friendId,
        });

        if (response === "Friend removed successfully!") {
            dispatch(showSuccessAlert(`You removed ${friendName} from your list of friends!`));
            dispatch(resetChatAction())
        }
    };
};


export const resetFriendsAction = (): ResetFriends => {
    return {
        type: actionTypes.resetFriends,
    };
};

export const updateMissedChats = (receiverId: any, groupId: any, count: any): any => {
    return {
        type: actionTypes.updateMissedChats,
        payload: { receiverId: receiverId, groupId: groupId, count: count }
    }
}

export const updateLastChatDate = (participants: any, groupChatId: any, date: any): any => {
    return {
        type: actionTypes.updateLastChatDate,
        payload: { participants: participants, groupChatId: groupChatId, date: date }
    }
}