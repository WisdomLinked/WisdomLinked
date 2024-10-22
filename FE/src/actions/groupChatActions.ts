import { Dispatch } from "redux";
import { createGroupChat, leaveGroup, deleteGroup } from "../api/api";
import { AddMembersToGroupArgs, DeleteGroupArgs, LeaveGroupArgs } from "../api/types";
import { showAlert } from "./alertActions";
import { resetChatAction } from "./chatActions";
// import { actionTypes, CurrentUser } from "./types";

export const createGroupChatAction = (
    name: string,
    closeDialogHandler: () => void
) => {
    return async (dispatch: Dispatch) => {
        const response = await createGroupChat(name);

        if (response === "Group created successfully") {
            closeDialogHandler();
            dispatch(showAlert(response));
        }
    };
};

export const leaveGroupAction = (
    args: LeaveGroupArgs,
) => {
    return async (dispatch: Dispatch) => {
        const response = await leaveGroup(args);

        if (response === "You have left the group!") {
            dispatch(showAlert(response));
            dispatch(resetChatAction())
        }
    };
};

export const deleteGroupAction = ({ groupChatId, groupChatName } : {groupChatId: string; groupChatName: string}) => {
    return async (dispatch: Dispatch) => {
        const response = await deleteGroup({groupChatId});

        if (response === "Group deleted successfully!") {
            dispatch(showAlert(`You deleted the "${groupChatName}" group!`));
            dispatch(resetChatAction());
        }
    };
};