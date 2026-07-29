export type LoginArgs = {
    email: string;
    password: string;
};

export type RegisterArgs = {
    email: string;
    password: string;
    username: string;
    role: string;
    
};

export type InviteFriendArgs = {
    email: string;
}

export type AuthResponse = {
    userDetails: {
        _id: string;
        email: string;
        token: string;
        username: string;
    };
};

export type GetMeResponse = {
    me: {
        _id: string;
        email: string;
        username: string;
    };
};

export type AddMembersToGroupArgs = {
    friendIds: string[];
    groupChatId: string;
};

export type LeaveGroupArgs = {
    groupChatId: string;
};

export type DeleteGroupArgs = {
    groupChatId: string;
    /** 'occurrence' deletes only this session; 'series' (default) the whole series. */
    scope?: 'occurrence' | 'series';
};

export type RemoveFriendArgs = {
    friendId: string;
};