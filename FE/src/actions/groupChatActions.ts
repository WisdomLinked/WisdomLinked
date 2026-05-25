import { Dispatch } from "redux";
import { createGroupChat, leaveGroup, deleteGroup } from "../api/api";
import { AddMembersToGroupArgs, DeleteGroupArgs, LeaveGroupArgs } from "../api/types";
import { showErrorAlert, showSuccessAlert } from "./alertActions";
import { resetChatAction } from "./chatActions";
import { updateMe } from "./authActions";
// import { actionTypes, CurrentUser } from "./types";

export const createGroupChatAction = (
    name: string,
    closeDialogHandler: () => void
) => {
    return async (dispatch: Dispatch) => {
        const response = await createGroupChat(name);

        if (response === "Group created successfully") {
            closeDialogHandler();
            dispatch(showSuccessAlert(response));
        }
    };
};

export const leaveGroupAction = (
    args: LeaveGroupArgs,
) => {
    return async (dispatch: Dispatch) => {
        const response = await leaveGroup(args);

        if (
            response === "You have left the group!" ||
            (typeof response === 'string' && response.startsWith('The community was removed'))
        ) {
            dispatch(showSuccessAlert(response));
            dispatch(resetChatAction());
            dispatch(updateMe() as any);
        } else if (typeof response === 'string' && response.length > 0) {
            dispatch(showErrorAlert(response));
        } else {
            dispatch(showErrorAlert('Could not leave the community. Try again.'));
        }
    };
};

export const deleteGroupAction = ({ groupChatId, groupChatName } : {groupChatId: string; groupChatName: string}) => {
    return async (dispatch: Dispatch) => {
        const response = await deleteGroup({groupChatId});

        const ok =
            response === "Group deleted successfully!" ||
            (typeof response === "string" && response.includes("Group deleted successfully"));

        if (ok) {
            dispatch(showSuccessAlert(`You deleted the "${groupChatName}" community.`));
            dispatch(resetChatAction());
            dispatch(updateMe() as any);
        } else if (typeof response === 'string' && response.length > 0) {
            dispatch(showErrorAlert(response));
        } else if (response !== false) {
            dispatch(showErrorAlert('Could not delete the community.'));
        }
    };
};