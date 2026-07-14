import { Method } from "axios";

import {
    LoginArgs,
    AuthResponse,
    InviteFriendArgs,
    GetMeResponse,
    LeaveGroupArgs,
    RemoveFriendArgs,
    DeleteGroupArgs,
} from "./types";

import { store } from "../store";
import {
    checkForAuthorization,
    handleApiFailure,
    handleAuthApiFailure,
} from "./apiErrorHandling";
import { resolveUserFacingError } from "../utils/resolveUserFacingError";
import { ensureCsrfToken, needsCsrf, isCsrfError } from "./csrf";
import { logoutUser } from "../actions/authActions";
import { SetLoadingStatus } from "../actions/appActions";
import { apiClient, BASE_URL } from "./apiClient";

const api = apiClient;

export { apiClient };

api.interceptors.request.use(async (config) => {
    if (needsCsrf(config.method)) {
        const t = await ensureCsrfToken();
        if (t) {
            config.headers = config.headers || {};
            (config.headers as any)['X-CSRF-Token'] = t;
        }
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const cfg = error?.config;
        const resp = error?.response;
        if (cfg && !cfg.__csrfRetried && isCsrfError(resp?.data, resp?.status)) {
            cfg.__csrfRetried = true;
            const t = await ensureCsrfToken({ force: true });
            if (t) {
                cfg.headers = cfg.headers || {};
                cfg.headers['X-CSRF-Token'] = t;
                return api.request(cfg);
            }
        }
        return Promise.reject(error);
    }
);

// api.interceptors.request.use(
//     (config) => {
//         // const userDetails = localStorage.getItem("currentUser");

//         // if (userDetails) {
//         //     const token = JSON.parse(userDetails).token;
//         //     console.log(token);
//         //     config.headers!["Authorization"] = `Bearer ${token}`;
//         // }

//         return config;
//     },
//     (err) => {
//         return Promise.reject(err);
//     }
// );

const logOut = () => {
    // emitLogOut()
    // localStorage.clear();
    // window.location.pathname = `${process.env.REACT_APP_BASE_URL}`;
    store.dispatch(logoutUser())
};

export const callLogout = async () => {
    try {
        await api.post("auth/logout");
    } catch (err) {
        console.error("Logout API failed", err);
    }
};

export const login = async ({ email, password }: LoginArgs) => {
    try {
        const res = await api.post<AuthResponse>("auth/login", {
            email,
            password,
        });

        return res.data;
    } catch (err: any) {
        console.error('Login error:', err);
        return handleAuthApiFailure(err);
    }
};

export const register = async (userdata: any) => {
    try {
        const res = await api.post<any>("auth/register", userdata);

        return res.data;
    } catch (err: any) {
        return handleAuthApiFailure(err);
    }
};

export const resendConfirmEmail = async ({ email }: any) => {
    try {
        const res = await api.post<any>("auth/resendConfirmEmail", { email });

        return res.data;
    } catch (err: any) {
        return handleAuthApiFailure(err);
    }
};

export const confirmLoginByCode = async ({ email, password, code }: any) => {
    try {
        const res = await api.post<any>("auth/confirmLoginByCode", { email, password, code});

        return res.data;
    } catch (err: any) {
        return handleAuthApiFailure(err);
    }
};

export const confirmPasswordResetByCode = async ({ email, password, code }: any) => {
    try {
        const res = await api.post<any>("auth/confirmPasswordResetByCode", { email, password, code });

        return res.data;
    } catch (err: any) {
        return handleAuthApiFailure(err);
    }
};

export const verifyPasswordResetOTP = async ({ email, code }: any) => {
    try {
        const res = await api.post<any>("auth/verifyPasswordResetOTP", { email, code });

        return res.data;
    } catch (err: any) {
        return handleAuthApiFailure(err);
    }
};

export const confirmEmailChange = async ({ confirmCode }: any) => {
    try {
        const res = await api.post<any>("auth/confirmEmailChange", { confirmCode });
        return res.data;
    } catch (error) {
        return { status: "FAIL", error: resolveUserFacingError(error) };
    }
}

export const verifyRegistration = async ({ email, confirmCode }: any) => {
    try {
        const res = await api.post<any>("auth/verifyRegistration", { email, confirmCode });
        return res.data;
    } catch (error) {
        return { status: "FAIL", error: resolveUserFacingError(error) };
    }
}

export const checkVerificationStatus = async (email: string) => {
    try {
        const res = await api.get<any>(`auth/checkVerification?email=${encodeURIComponent(email)}`);
        return res.data;
    } catch (error) {
        return { status: "FAIL", error: resolveUserFacingError(error) };
    }
}

export const passwordResetRequest = async ({ email, password }: any) => {
    try {
        const res = await api.post<any>("auth/passwordResetRequest", { email, password });

        return res.data;
    } catch (err: any) {
        return handleAuthApiFailure(err);
    }
};

export const getTimezone = async ({ lat, lng }: { lat: number; lng: number }) => {
    try {
        const res = await api.get(`auth/getTimezone/`, {
            params: { lat, lng }
        });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

// protected routes

export const getMe = async (accessToken?: string, options?: { logoutOnAuth?: boolean }) => {
    try {
        const headers: Record<string, string> = {};
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }
        const res = await api.get<GetMeResponse>("auth/me", { headers });

        return {
            me: res.data.me,
            statusCode: 200
        };

    } catch (err: any) {
        return handleApiFailure(err, {
            notify: false,
            logoutOnAuth: options?.logoutOnAuth !== false,
        });
    }
};

export const doUpdateMissedChats = async (id: any, count: any) => {
    try {
        const res = await api.post("auth/updateMissedChats", { id: id, count: count });
        return res.data

    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doUpdateProfile = async (updates: any) => {
    try {
        const res = await api.post("auth/updateProfile", updates);
        store.dispatch({
            type: 'updateUserDetails',
            payload: res.data.result
        })
        return true
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const inviteFriendRequest = async ({ email }: InviteFriendArgs) => {
    try {
        const res = await api.post("invite-friend/invite", {
            email,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const rejectFriendRequest = async (invitationId: string) => {
    try {
        const res = await api.post("invite-friend/reject", {
            invitationId,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const acceptFriendRequest = async (invitationId: string) => {
    try {
        const res = await api.post("invite-friend/accept", {
            invitationId,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const joinGeneralChat = async (adminId: string) => {
    try {
        const res = await api.post("group-chat/joinGeneralChat", { adminId });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};
export const joinPrivateChat = async (personId: string) => {
    try {
        const res = await api.post("group-chat/joinPrivateChat", { personId });
        return res.data;
    } catch (err: any) {
        // Preserve existing authorization/error handling behavior in your codebase
        return checkForAuthorization ? checkForAuthorization(err) : Promise.reject(err);
    }
};

export const createCommunityChat = async (data: { name: string; description?: string; participants?: string[]; isOpenToAll?: boolean }) => {
    try {
        const res = await api.post("group-chat/create-community-chat", data);
        return res.data;
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
            return checkForAuthorization(err);
        }
        const payload = err?.response?.data;
        return {
            status: 'FAILED',
            error: typeof payload === 'string' ? payload : payload?.error || payload?.message || err?.message || 'Failed to create community chat',
        };
    }
};

export const joinCommunityChat = async (communityChatId: string) => {
    try {
        const res = await api.post("group-chat/join-community-chat", { communityChatId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const addParticipantsToCommunityChat = async (data: { communityChatId: string; participantIds: string[] }) => {
    try {
        const res = await api.post("group-chat/add-participants-to-community-chat", data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getAllCommunityChats = async () => {
    try {
        const res = await api.get("group-chat/get-all-community-chats");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const createGroupChat = async (details: any) => {
    try {
        const res = await api.post("group-chat", details);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

/** Lazily ensure a seminar's group chat channel exists; returns { rcChannelId }. */
export const ensureSeminarChannel = async (groupChatId: string) => {
    try {
        const res = await api.post("group-chat/ensure-seminar-channel", { groupChatId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const uploadSeminarCover = async (file: File): Promise<string | null> => {
    try {
        const formData = new FormData();
        formData.append("media", file, file.name);
        const res = await api.post("auth/uploadChatFile", formData);
        return res.data?.chatFile || null;
    } catch (err: any) {
        checkForAuthorization(err);
        return null;
    }
};

export const createGroupChatByUser = async (details: any) => {
    try {
        const res = await api.post("group-chat/create-by-user", details);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const proposeIndividualAppointment = async (details: any) => {
    try {
        const res = await api.post("group-chat/propose-individual-appointment", details);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getGroupChatById = async (groupChatId: string) => {
    try {
        const res = await api.get(`group-chat/${groupChatId}`);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const joinGroupChat = async (details: any) => {
    try {
        const res = await api.post("group-chat/join", details);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const updateGroupChat = async (details: any) => {
    try {
        const res = await api.post("group-chat/update", details);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const cancelIndividualAppointment = async (groupChatId: any) => {
    try {
        const res = await api.post("group-chat/cancel-individual-appointment", { groupChatId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doUpdateExpertEvent = async (eventId: any, updates: any) => {
    try {
        const res = await api.post("expert/updateEvent", { eventId, updates });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doUpdateEvent = async (eventId: any, updates: any) => {
    try {
        const res = await api.post("customer/updateEvent", { eventId, updates });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const acceptIndividualAppointment = async (data: any) => {
    try {
        const res = await api.post("group-chat/accept-individual-appointment", {
            groupChatId: data.groupChatId,
            payment_intent: data.payment_intent,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const registerForSeminar = async (data: any) => {
    try {
        const res = await api.post("group-chat/register-seminar", {
            groupChatId: data.groupChatId,
            payment_intent: data.payment_intent,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const requestSeminarSeat = async (data: any) => {
    try {
        const res = await api.post("group-chat/request-seminar-seat", {
            groupChatId: data.groupChatId,
            payment_intent: data.payment_intent,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getSeminarSeatRequests = async () => {
    try {
        const res = await api.get("group-chat/seat-requests");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getMyFollowers = async () => {
    try {
        const res = await api.get("expert/followers");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getMySeatRequests = async () => {
    try {
        const res = await api.get("group-chat/my-seat-requests");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const approveSeminarSeatRequest = async (requestId: string) => {
    try {
        const res = await api.post("group-chat/approve-seat-request", { requestId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const rejectSeminarSeatRequest = async (requestId: string) => {
    try {
        const res = await api.post("group-chat/reject-seat-request", { requestId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const leaveGroup = async (data: LeaveGroupArgs) => {
    try {
        const res = await api.post("group-chat/leave", {
            groupChatId: data.groupChatId,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const removeFriend = async (data: RemoveFriendArgs) => {
    try {
        const res = await api.post("invite-friend/remove", {
            friendId: data.friendId,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const removeCommunityMember = async (
    groupChatId: string,
    memberUserId: string,
    reason: string = '',
) => {
    try {
        const res = await api.post('group-chat/remove-community-member', {
            groupChatId,
            memberUserId,
            reason,
        });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const setCommunityCoModerator = async (
    groupChatId: string,
    memberUserId: string,
    isCoModerator: boolean,
) => {
    try {
        const res = await api.post('group-chat/set-community-co-moderator', {
            groupChatId,
            memberUserId,
            isCoModerator,
        });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const deleteGroup = async (data: DeleteGroupArgs) => {
    try {
        const res = await api.post("group-chat/delete", {
            groupChatId: data.groupChatId,
            scope: data.scope,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetEventsBetweenCustomerAndExpert = async (expertId: any, customerId: any, isOngoing: any) => {
    try {
        const res = await api.post("auth/getEventsBetweenCustomerAndExpert", { expertId, customerId, isOngoing });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doGetKeywordsAndServices = async () => {
    try {
        const res = await api.get("auth/getKeywordsAndServices");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doGetCustomMajors = async () => {
    try {
        const res = await api.get("admin/getCustomMajors");
        return res.data?.result || [];
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doConsolidateMajors = async (data: { sources: string[]; target: string }) => {
    try {
        const res = await api.post("admin/consolidateMajors", data);
        return res.data?.result;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doGetMajorConsolidations = async () => {
    try {
        const res = await api.get("admin/getMajorConsolidations");
        return res.data?.result || [];
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const callApi = async (
    method: string,
    url: string,
    data: any,
    file?: any,
    options?: { notify?: boolean; logoutOnAuth?: boolean },
) => {
    const callOptions = options || {};

    const runRequest = async (csrfRetried = false): Promise<unknown> => {
        const formData = new FormData();
        for (const x in data) {
            if (typeof data[x] === 'object' && data[x] !== null) {
                formData.append(x, JSON.stringify(data[x]));
            } else {
                formData.append(x, data[x]);
            }
        }

        if (file) {
            formData.append("media", file, file.name);
        }

        const headers: Record<string, string> = {};
        if (needsCsrf(method)) {
            const t = await ensureCsrfToken();
            if (t) headers['X-CSRF-Token'] = t;
        }

        const fetchInit: RequestInit = {
            method: method,
            body: formData,
            credentials: 'include',
            headers,
        };

        const response = await fetch(BASE_URL + url, fetchInit);
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.indexOf('application/json') > -1;

        if (!response.ok) {
            let parsedBody: unknown = null;
            if (isJson) {
                try {
                    parsedBody = await response.json();
                } catch {
                    parsedBody = null;
                }
            }
            if (!csrfRetried && isCsrfError(parsedBody, response.status)) {
                await ensureCsrfToken({ force: true });
                return runRequest(true);
            }
            throw {
                status: response.status,
                statusText: response.statusText,
                parsedBody,
            };
        }

        if (isJson) {
            try {
                const json = await response.json();
                if (Array.isArray(json)) return [...json];
                return { ...json };
            } catch {
                throw { status: response.status, statusText: response.statusText };
            }
        }
        return {};
    };

    try {
        return await runRequest();
    } catch (err: any) {
        return callOptions.notify === false
            ? handleAuthApiFailure(err, { logoutOnAuth: callOptions.logoutOnAuth })
            : handleApiFailure(err, { logoutOnAuth: callOptions.logoutOnAuth });
    }
}

export const leaveFeedback = async (data: any) => {
    try {
        const res = await api.post("auth/leaveFeedback", data);
        return res;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const getUserFeedbacks = async (userId: string) => {
    try {
        const res = await api.post("admin/getUserFeedbacks", { userId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const createStripePaymentIntent = async (data: any) => {
    try {
        const res = await api.post("auth/createStripePaymentIntent", data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const getStripeMode = async () => {
    try {
        const res = await api.post("auth/getStripeMode");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const setStripeMode = async ({ stripeMode }: any) => {
    try {
        const res = await api.post("admin/setStripeMode", { stripeMode });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const setSeminarApprovalDeadline = async (seminarApprovalDeadlineHours: number) => {
    try {
        const res = await api.post("admin/setSeminarApprovalDeadline", { seminarApprovalDeadlineHours });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const sendPaymentLinkToUser = async (data: any) => {
    try {
        const res = await api.post("admin/sendPaymentLinkToUser", data);
        return res.data;
    } catch (err: any) {
        // Handle authorization first
        const authResult = checkForAuthorization(err);
        if (authResult === false) {
            // Return a proper error response format
            return {
                status: 'FAILED',
                message: err?.response?.data?.message || err?.message || 'An error occurred'
            };
        }
        return authResult;
    }
}

export const processRefund = async (data: any) => {
    try {
        const res = await api.post("admin/processRefund", data);
        return res.data;
    } catch (err: any) {
        // Handle authorization first
        const authResult = checkForAuthorization(err);
        if (authResult === false) {
            // Return a proper error response format
            return {
                status: 'FAILED',
                message: err?.response?.data?.message || err?.message || 'An error occurred'
            };
        }
        return authResult;
    }
}

export const sendAdHocPaymentLink = async (data: any) => {
    try {
        const res = await api.post("admin/sendAdHocPaymentLink", data);
        return res.data;
    } catch (err: any) {
        // Handle authorization first
        const authResult = checkForAuthorization(err);
        if (authResult === false) {
            // Return a proper error response format
            return {
                status: 'FAILED',
                message: err?.response?.data?.message || err?.message || 'An error occurred'
            };
        }
        return authResult;
    }
}

// CUSTOMER APIS ------------------
export async function profileImageUpload(formData: FormData): Promise<any> {
    try {
        const response = await api.post("image-upload/upload",
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

/** Upload profile photo and persist on the authenticated user (updates Redux userDetails). */
export const saveProfilePhoto = async (file: File): Promise<{ result: any; filename?: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await api.post('auth/profilePhoto', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.result) {
            store.dispatch({
                type: 'updateUserDetails',
                payload: res.data.result,
            });
        }
        return res.data;
    } catch (err: any) {
        const msg =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            'Failed to upload profile photo';
        throw new Error(typeof msg === 'string' ? msg : 'Failed to upload profile photo');
    }
};


export const profileImageFetch = async (url: string, size: string) => {
    try {
        const res = await api.get(`image-fetch?file=${url}&folder=${size}`, {
            responseType: 'arraybuffer'
        });

        const blob = new Blob([res.data], { type: res.headers['content-type'] });

        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        return typeof base64Data === 'string' ? base64Data : null;
    } catch (err) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('profileImageFetch failed', err);
        }
        return null;
    }
};



export const doFilterExperts = async (filter: any) => {
    try {
        const res = await api.post("customer/filterExperts", filter);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doFilterSeminars = async (filter: any) => {
    try {
        const res = await api.post("customer/filterSeminars", filter);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

/** Same seminar discovery as customer flow; use while logged in as expert */
export const doExpertFilterSeminars = async (filter: any) => {
    try {
        const res = await api.post("expert/filterSeminars", filter);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

/** @deprecated Use createGroupChatByUser for new 1:1 bookings. Legacy Event path only. */
export const doAppendEvent = async ({ title, start, end, duration, price, paidBy, expert, customer, payment_intent, eventId, createdBy }: any) => {
    try {
        const res = await api.post("customer/appendEvent", { title, start, end, duration, price, paidBy, expert, customer, payment_intent, eventId, createdBy });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doCancelEvent = async (eventId: any) => {
    try {
        const res = await api.post("customer/cancelEvent", { eventId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doLeftSeminar = async (seminarId: any) => {
    try {
        const res = await api.post("customer/leftSeminar", { seminarId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doGetMyEvents = async () => {
    try {
        const res = await api.get("auth/getMyEvents");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const getExpertById = async (id: any) => {
    try {
        const res = await api.get(`customer/getUser/${id}`);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

// Follow / unfollow an expert. Returns { following, followerCount } from the
// server (the source of truth) so the caller can reconcile optimistic UI.
export const doFollowExpert = async (expertId: string) => {
    try {
        const res = await api.post(`customer/follow/${expertId}`);
        return res.data as { following: boolean; followerCount: number };
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doUnfollowExpert = async (expertId: string) => {
    try {
        const res = await api.post(`customer/unfollow/${expertId}`);
        return res.data as { following: boolean; followerCount: number };
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

// EXPERT APIS ------------------
export const getDailyTimeSlots = async (startTime: number, endTime: number, userId: string) => {
    try {
        const res = await api.post("expert/getDailyTimeSlots", {
            startTime,
            endTime,
            userId
        })
        return res.data
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doUpdateDailyTimeSlots = async (newSlots: Array<any>, startTime: number, endTime: number) => {
    try {
        const res = await api.post("expert/updateDailyTimeSlots", { newSlots, startTime, endTime })
        return res.data
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doUpdateTimeSlots = async (
    timeSlots: any,
    options?: {
        availabilityMode?: 'common' | 'daily';
        weeklyTimeSlots?: Record<string, number[]>;
    }
) => {
    try {
        const res = await api.post("expert/updateTimeSlots", {
            timeSlots,
            ...(options?.availabilityMode ? { availabilityMode: options.availabilityMode } : {}),
            ...(options?.weeklyTimeSlots ? { weeklyTimeSlots: options.weeklyTimeSlots } : {}),
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

/** Expert-only: replace list of YYYY-MM-DD dates when no new bookings should be accepted. */
export const doSetExpertBlockedBookingDates = async (dates: string[]) => {
    try {
        const res = await api.post("expert/blockedBookingDates", { dates });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

/** Expert-only: replace per-date blocked time slots ({ "YYYY-MM-DD": [halfHourIndex, ...] }). */
export const doSetExpertBlockedBookingSlots = async (
    slots: Record<string, number[]>,
) => {
    try {
        const res = await api.post("expert/blockedBookingSlots", { slots });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

/** Expert-only: minimum advance booking window for students (24, 48, or 72 hours). */
export const doSetExpertBookingNoticeHours = async (bookingNoticeHours: number) => {
    try {
        const res = await api.post("expert/bookingNoticeHours", {
            bookingNoticeHours,
        });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const createEvent = async ({ title, start, end, duration, price, expert, customer, createdBy }: any) => {
    try {
        const res = await api.post("expert/createEvent", { title, start, end, duration, price, expert, customer, createdBy });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doAcceptEvent = async (eventId: any) => {
    try {
        const res = await api.post("expert/acceptEvent", {
            eventId
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doCancelInvitation = async (eventId: any) => {
    try {
        const res = await api.post("expert/cancelInvitation", {
            eventId
        });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doDeclineEvent = async (eventId: any) => {
    try {
        const res = await api.post("expert/declineEvent", {
            eventId
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doFilterCustomers = async (filter: any) => {
    try {
        const res = await api.post("expert/filterCustomers", filter);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const searchPrivateChatUsers = async (q: string) => {
    try {
        const res = await api.get(`chat/search-users?q=${encodeURIComponent(String(q || ''))}`);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getCustomerById = async (id: any) => {
    try {
        const res = await api.get(`expert/getUser/${id}`);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const shareMeetingViaEmail = async (data: any) => {
    try {
        const res = await api.post("expert/shareMeetingViaEmail", data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetExpertPaymentHistory = async () => {
    try {
        const res = await api.post("expert/getMyPaymentHistory", {});
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetCustomerPaymentHistory = async () => {
    try {
        const res = await api.post("customer/getMyPaymentHistory", {});
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

// ADMIN APIS ------------------

export type AdminDashboardStatsData = {
    pendingApprovals: number;
    newContactMessages: number;
    unansweredChatbotQuestions: number;
    expertCount: number;
    customerCount: number;
    oneOnOneSessions: number;
    seminarsHeld: number;
    totalPayments: number;
    refundCount: number;
    todayUpcomingEvents: number;
};

export type AdminPlatformEventItem = {
    kind: "booking" | "seminar" | "groupOneToOne";
    id: string;
    title: string;
    start: string;
    end: string;
    status?: string;
    expert: { username?: string; email?: string } | null;
    customer: { username?: string; email?: string } | null;
    groupChatType?: string;
};

export const doGetAdminDashboardStats = async (): Promise<{
    status: string;
    data?: AdminDashboardStatsData;
} | null> => {
    try {
        const res = await api.get("admin/dashboardStats");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetAdminPlatformEvents = async (params: {
    scope?: "today" | "upcoming" | "past" | "all";
    types?: string[];
}) => {
    try {
        const search = new URLSearchParams();
        if (params.scope) search.set("scope", params.scope);
        if (params.types?.length) search.set("types", params.types.join(","));
        const q = search.toString();
        const res = await api.get(`admin/platformEvents${q ? `?${q}` : ""}`);
        return res.data as { status: string; items: AdminPlatformEventItem[] };
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doFilterUsers = async (filter: any) => {
    try {
        const res = await api.post("admin/filterUsers", filter);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const doFilterPaymentHistories = async (filter: any) => {
    try {
        const res = await api.post("admin/filterPaymentHistories", filter);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetFullUserDataByEmail = async (email: any) => {
    try {
        const res = await api.post("admin/getFullUserDataByEmail", { email });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doUpdateProfileByAdmin = async (updates: any) => {
    try {
        const res = await api.post("admin/updateProfileOfUser", updates);
        return res.data
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetDirectChatHistory = async (filter: any) => {
    try {
        const res = await api.post("admin/getDirectChatHistory", filter);
        return res.data
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetGroupChatHistory = async (filter: any) => {
    try {
        const res = await api.post("admin/getGroupChatHistory", filter);
        return res.data
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doContactUs = async (data: {
    name: string;
    email: string;
    countryCode?: string;
    contactNumber?: string;
    subject?: string;
    issue?: string;
}) => {
    try {
        const res = await api.post("auth/contact-form", data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetContactedUs = async (filters: {
    name?: string;
    email?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: string;
}) => {
    try {
        const res = await api.post("admin/getContactedUs", filters);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const toggleActionedStatus = async (id: string) => {
    try {
        const res = await api.post("admin/toggleActionedStatus", { id });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const sendEmailToUser = async (email: string, message: string) => {
    try {
        const res = await api.post("admin/sendEmailToUser", { email, message });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const sendWelcomeEmail = async (email: string, password: string) => {
    try {
        const res = await api.post("auth/sendWelcomeEmail", { email, password });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
}

export const sendEmailToAdmin = async (message: string) => {
    try {
        const res = await api.post("auth/sendEmailToAdmin", { message });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getChatBotAnswer = async (data: any) => {
    try {
        const res = await api.post(`auth/getChatBotAnswer`, data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetPendingUsers = async () => {
    try {
        const res = await api.get("admin/getPendingUsers");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doGetPendingLogins = async () => {
    try {
        const res = await api.get("admin/getPendingLogins");
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doDeletePendingUserById = async (pendingUserId: string) => {
    try {
        const res = await api.post("admin/deletePendingUser", { pendingUserId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doDeletePendingLoginById = async (pendingLoginId: string) => {
    try {
        const res = await api.post("admin/deletePendingLogin", { pendingLoginId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const doActivatePendingUserById = async (pendingUserId: string) => {
    try {
        const res = await api.post("admin/convertPendingUserToUserByAdmin", { pendingUserId });
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const registerUserByAdmin = async (userdata: any) => {
    try {
        // This uses the /registerUserByAdmin route
        const res = await api.post<any>("admin/registerUserByAdmin", userdata);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const createChatBotQA = async (data: any) => {
    try {
        const res = await api.post("admin/createChatBotQA", data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const getChatBotQA = async (data: any) => {
    try {
        const { page, limit } = data;
        const queryString = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        }).toString();
        const res = await api.get(`admin/getChatBotQA?${queryString}`, data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};
export const updateChatBotQA = async (data: any, id: any) => {
    try {
        const res = await api.post(`admin/updateChatBotQA/${id}`, data);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const deleteChatBotQA = async (id: any) => {
    try {
        const res = await api.post(`admin/deleteChatBotQA/${id}`);
        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};
