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

export type LoginResponse = {
    status: string;
    error?: string;
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
};

export type RemoveFriendArgs = {
    friendId: string;
};

export type User  = {
    _id: string;
    email: string;
    username: string;
    role: string;
    createdAt: string;
    updatedAt: string;    
}

export type Session = {
    _id: string;
    createdAt: string;
    updatedAt: string;
    status: string;
    customer: User;
    expert: User;
    start: string;
    duration: number;
    price: number;
}