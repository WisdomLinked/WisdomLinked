import axios from "axios";
import { Method } from "axios";

import {
    LoginArgs,
    AuthResponse,
    InviteFriendArgs,
    GetMeResponse,
    AddMembersToGroupArgs,
    LeaveGroupArgs,
    RemoveFriendArgs,
    DeleteGroupArgs,
} from "./types";

import { store } from "../store";
import { actionTypes } from "../actions/types";
import { showAlert } from "../actions/alertActions";
import { logoutUser } from "../actions/authActions";
import { SetLoadingStatus } from "../actions/appActions";
import { group } from "console";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const api = axios.create({
    withCredentials: true,
    baseURL: BASE_URL
});

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

const checkForAuthorization = (error: any) => {
    const responseCode = error?.response?.status;

    if (responseCode === 401 || responseCode === 403) {
        logOut();
        return false
    }
    store.dispatch({
        type: actionTypes.authError,
        payload: error.message
    })
    if(responseCode == 413){
        store.dispatch(showAlert('payload size too large'));
    }
    else
    store.dispatch(showAlert(error.response?.data || error.message));
    SetLoadingStatus(false)
    return false
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
        return checkForAuthorization(err);
    }
};

export const register = async (userdata: any) => {
    try {
        const res = await api.post<any>("auth/register", userdata);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const resendConfirmEmail = async ({ email }: any) => {
    try {
        const res = await api.post<any>("auth/resendConfirmEmail", { email });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const confirmLoginByCode = async ({ email, password, code, timeZone }: any) => {
    try {
        const res = await api.post<any>("auth/confirmLoginByCode", { email, password, code, timeZone });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const confirmPasswordResetByCode = async ({ email, password, code }: any) => {
    try {
        const res = await api.post<any>("auth/confirmPasswordResetByCode", { email, password, code });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const verifyRegistration = async ({ email, confirmCode }: any) => {
    try {
        const res = await api.post<any>("auth/verifyRegistration", { email, confirmCode });

        return res.data;
    } catch (err: any) {
        console.log(err, '////')
        return checkForAuthorization(err);
    }
};

export const passwordResetRequest = async ({ email, password }: any) => {
    try {
        const res = await api.post<any>("auth/passwordResetRequest", { email, password });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
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

export const getMe = async () => {
    try {
        const res = await api.get<GetMeResponse>("auth/me");

        return {
            me: res.data.me,
            statusCode: 200
        };

    } catch (err: any) {
        return checkForAuthorization(err);
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

export const createGroupChat = async (details: any) => {
    try {
        const res = await api.post("group-chat", details);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
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

export const addMemberToGroup = async (data: any) => {
    try {
        const res = await api.post("group-chat/add", {
            _id: data._id,
            friendId: data.friendId,
            groupChatId: data.groupChatId
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const acceptIndividualAppointment = async (data: any) => {
    try {
        const res = await api.post("group-chat/accept-individual-appointment", {
            groupChatId: data.groupChatId,
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const addMemberToPendingGroup = async (data: any) => {
    try {
        const res = await api.post("group-chat/add-to-pending", {
            groupChatId: data.groupChatId,
            payment_intent: data.payment_intent,
            price: data.price
        });

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

export const deleteGroup = async (data: DeleteGroupArgs) => {
    try {
        const res = await api.post("group-chat/delete", {
            groupChatId: data.groupChatId,
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

export const callApi = async (method: string, url: string, data: any, file?: any) => {
    try {

        const formData = new FormData()
        for (const x in data) {
            formData.append(x, JSON.stringify(data[x]))
        }

        if (file) {
            formData.append("media", file, file.name);
        }

        console.log("Making API Call:", {
            method,
            url: BASE_URL + url,
            data,
        });


        let options = {
            method: method,
            body: formData
        }
        return fetch(BASE_URL + url, options)
            .then((response: any) => {
                console.log("API Response:", {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });

                if (!response.ok) {
                    const error = Object.assign({}, response, {
                        status: response.status,
                        statusText: response.statusText,
                    });

                    return Promise.reject(error);
                }
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.indexOf('application/json') > -1) {
                    return response
                        .json()
                        .then((json: any) => {
                            if (Array.isArray(json))
                                return [...json];
                            else
                                return { ...json };
                        })
                        .catch(() => {
                            throw new Error(response.status);
                        });
                } else {
                    return {};
                }
            })
            .catch((err) => {
                return checkForAuthorization(err);
            });
    } catch (err: any) {
        return checkForAuthorization(err);
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

        return base64Data;
    } catch (err) {
        return err;
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

export const doAppendEvent = async ({ title, start, end, duration, price, paidBy, expert, customer, payment_intent, eventId ,createdBy }: any) => {
    try {
        const res = await api.post("customer/appendEvent", { title, start, end, duration, price, paidBy, expert, customer, payment_intent, eventId,createdBy });
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

export const doCancelPendingSeminar = async (pendingSeminarId: any) => {
    try {
        const res = await api.post("customer/cancelPendingSeminar", { pendingSeminarId });
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

export const doUpdateTimeSlots = async (timeSlots: any) => {
    try {
        const res = await api.post("expert/updateTimeSlots", {
            timeSlots
        });

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

export const createEvent = async ({ title, start, end, duration, price, expert, customer, createdBy }: any) => {
    try {
        const res = await api.post("expert/createEvent", { title, start, end, duration, price, expert, customer ,createdBy });
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

export const getCustomerById = async (id: any) => {
    try {
        const res = await api.get(`expert/getUser/${id}`);

        return res.data;
    } catch (err: any) {
        return checkForAuthorization(err);
    }
};

// ADMIN APIS ------------------
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

export const sendEmailToAdmin = async (message: string) => {
    try {
        const res = await api.post("auth/sendEmailToAdmin", { message });
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
