import { Dispatch, } from "redux";
import { getMe, callLogout } from "../api/api";
import { resetChatAction } from "./chatActions";
import { resetFriendsAction } from "./friendActions";
import { actionTypes, CurrentUser } from "./types";
import { clearCsrfToken } from "../api/csrf";
import { clearClientAccessTokenCookie } from "../utils/authCookie";

export const autoLogin = () => {
    return async (dispatch: Dispatch) => {
        dispatch({
            type: "SetLoadingStatus",
            payload: true,
        });

        try {
            const response: any = await getMe(undefined, { logoutOnAuth: false });
            if (response?.me) {
                localStorage.setItem("currentUser", JSON.stringify(response.me));
                dispatch({
                    type: actionTypes.authenticate,
                    payload: {
                        ...response.me,
                    },
                });
            }
        } finally {
            dispatch({
                type: "SetLoadingStatus",
                payload: false,
            });
        }
    }
}

export const updateMe = () => {
    return async (dispatch: Dispatch) => {
        const response: any = await getMe();
        if (response) {
            localStorage.setItem("currentUser", JSON.stringify(response.me));
            dispatch({
                type: actionTypes.authenticate,
                payload: {
                    ...response.me,
                },
            });
        }
    }
}

export const logoutUser = () => {
    return async (dispatch: Dispatch) => {
        clearCsrfToken();
        clearClientAccessTokenCookie();
        await callLogout();
        localStorage.clear();
        dispatch({
            type: actionTypes.logout,
        });
        dispatch(resetChatAction());
        dispatch(resetFriendsAction());
        dispatch({
            type: actionTypes.resetChat
        })
        window.location.href = "/login";
    }
}