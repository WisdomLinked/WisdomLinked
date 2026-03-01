import { apiClient } from "./client";

// ──────────────────────────────────────────────────────────────────────────────
// Domain types
// ──────────────────────────────────────────────────────────────────────────────

export type FriendInvitationStatus = "pending" | "accepted" | "rejected";
export type InvitationQueryType = "sent" | "received" | "all";

export interface FriendUser {
  id: string;
  username: string;
  email: string;
  image?: string;
  status: string;
  role: string;
}

export interface FriendInvitationUser {
  _id: string;
  username: string;
  email: string;
  image?: string;
}

export interface FriendInvitation {
  id: string;
  sender: FriendInvitationUser;
  receiver: FriendInvitationUser;
  status: FriendInvitationStatus;
  createdAt: string;
}

export interface SentInvitationResult {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendInvitationStatus;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Response types
// ──────────────────────────────────────────────────────────────────────────────

export interface ListFriendsResponse {
  friends: FriendUser[];
}

export interface ListInvitationsResponse {
  invitations: FriendInvitation[];
}

export interface SendInvitationResponse {
  invitation: SentInvitationResult;
}

export interface AcceptInvitationResponse {
  message: string;
  conversationId: string;
}

export interface RejectInvitationResponse {
  invitation: {
    id: string;
    senderId: string;
    receiverId: string;
    status: FriendInvitationStatus;
    updatedAt: string;
  };
}

export interface RemoveFriendResponse {
  message: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// API client
// ──────────────────────────────────────────────────────────────────────────────

export const friendsApi = {
  async listFriends(): Promise<ListFriendsResponse> {
    const response = await apiClient.get("/api/v1/friends");
    return response.data;
  },

  async sendInvitation(receiverId: string): Promise<SendInvitationResponse> {
    const response = await apiClient.post("/api/v1/friends", { receiverId });
    return response.data;
  },

  async listInvitations(type: InvitationQueryType = "all"): Promise<ListInvitationsResponse> {
    const response = await apiClient.get("/api/v1/friends/invitations", {
      params: { type },
    });
    return response.data;
  },

  async acceptInvitation(invitationId: string): Promise<AcceptInvitationResponse> {
    const response = await apiClient.put(`/api/v1/friends/${invitationId}/accept`);
    return response.data;
  },

  async rejectInvitation(invitationId: string): Promise<RejectInvitationResponse> {
    const response = await apiClient.put(`/api/v1/friends/${invitationId}/reject`);
    return response.data;
  },

  async removeFriend(friendId: string): Promise<RemoveFriendResponse> {
    const response = await apiClient.delete(`/api/v1/friends/${friendId}`);
    return response.data;
  },
};
