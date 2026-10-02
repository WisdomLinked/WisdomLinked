import { Dispatch } from "redux";
import { createGroupChat, leaveGroup, deleteGroup } from "../api/api";
import { AddMembersToGroupArgs, DeleteGroupArgs, LeaveGroupArgs } from "../api/types";
import { notify } from '../utils/notify';
import { resetChatAction } from "./chatActions";
import { updateMe } from "./authActions";
// import { actionTypes, CurrentUser } from "./types";

export const createGroupChatAction = (
    name: string,
    closeDialogHandler: () => void
) => {
    return async (dispatch: Dispatch) => {
        const response = await createGroupChat(name);

        if (response === false) return;
        if (response === "Group created successfully") {
            closeDialogHandler();
            notify.success(response);
        } else if (typeof response === 'string' && response.length > 0) {
            notify.error(response);
        } else {
            notify.error('Could not create the community. Please try again.');
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
            notify.success(response);
            dispatch(resetChatAction());
            dispatch(updateMe() as any);
        } else if (typeof response === 'string' && response.length > 0) {
            notify.error(response);
        } else {
            notify.error('Could not leave the community. Try again.');
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
            notify.success(`You deleted the "${groupChatName}" community.`);
            dispatch(resetChatAction());
            dispatch(updateMe() as any);
        } else if (typeof response === 'string' && response.length > 0) {
            notify.error(response);
        } else if (response !== false) {
            notify.error('Could not delete the community.');
        }
    };
};