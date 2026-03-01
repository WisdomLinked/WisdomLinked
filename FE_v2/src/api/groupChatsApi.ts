import { apiClient } from "./client";

// ─── Enums / primitives ───────────────────────────────────────────────────────

export type GroupChatType = "seminar" | "individual" | "community";
export type GroupChatStatus = "pending" | "active" | "cancelled" | "completed";
export type GroupMessageType = "text" | "file" | "system";
export type AppointmentStatus = "pending" | "approved" | "rejected";

// ─── Entity interfaces ────────────────────────────────────────────────────────

export interface GroupChatParticipant {
  _id: string;
  username: string;
  email: string;
  image?: string;
  role: string;
}

export interface GroupChat {
  _id: string;
  name: string;
  description?: string;
  type: GroupChatType;
  status: GroupChatStatus;
  /** Populated when detail endpoint is used; string ID otherwise. */
  admin: GroupChatParticipant | string;
  participants: (GroupChatParticipant | string)[];
  createdBy: string;
  keywords: string[];
  services: string[];
  start?: string;
  end?: string;
  duration?: number;
  price?: number;
  paidBy: string[];
  isOpenToAll: boolean;
  totalTimeSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface PendingAppointment {
  _id: string;
  userId: string;
  groupChatId: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMessage {
  _id: string;
  /** Populated when detail endpoint is used; string ID otherwise. */
  author:
    | {
        _id: string;
        username: string;
        image?: string;
      }
    | string;
  content: string;
  type: GroupMessageType;
  groupChatId: string;
  fileUrl?: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Request / response shapes ────────────────────────────────────────────────

export interface CreateGroupChatData {
  name: string;
  description?: string;
  type: GroupChatType;
  start?: string;
  end?: string;
  duration?: number;
  price?: number;
  isOpenToAll?: boolean;
  keywords?: string[];
  services?: string[];
}

export interface GroupChatListParams {
  type?: GroupChatType;
  status?: GroupChatStatus;
  keyword?: string;
  service?: string;
  /** When true, only return groups the current user belongs to. */
  mine?: boolean;
  page?: number;
  limit?: number;
}

export interface GroupChatListResponse {
  groupChats: GroupChat[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SendGroupMessageData {
  content: string;
  type?: "text" | "file";
  fileUrl?: string;
}

export interface GroupMessageListParams {
  page?: number;
  limit?: number;
}

export interface GroupMessageListResponse {
  messages: GroupMessage[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const groupChatsApi = {
  /** Create a new group chat. Seminar/individual require expert role. */
  async createGroupChat(data: CreateGroupChatData): Promise<{ groupChat: GroupChat }> {
    const response = await apiClient.post("/api/v1/group-chats", data);
    return response.data;
  },

  /** Fetch a single group chat with populated admin, participants, keywords, and services. */
  async getGroupChat(groupChatId: string): Promise<{ groupChat: GroupChat }> {
    const response = await apiClient.get(`/api/v1/group-chats/${groupChatId}`);
    return response.data;
  },

  /** List group chats with optional filtering and pagination. */
  async listGroupChats(params?: GroupChatListParams): Promise<GroupChatListResponse> {
    const response = await apiClient.get("/api/v1/group-chats", { params });
    return response.data;
  },

  /**
   * Join a group chat.
   * - Community (isOpenToAll=true): direct join.
   * - Seminar with price: requires prior payment (paidBy contains userId).
   * - Individual: forbidden — use requestAppointment instead.
   */
  async joinGroupChat(groupChatId: string): Promise<{ groupChat: GroupChat }> {
    const response = await apiClient.post(`/api/v1/group-chats/${groupChatId}/join`);
    return response.data;
  },

  /** Leave a group chat. Admin cannot leave their own group. */
  async leaveGroupChat(groupChatId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/v1/group-chats/${groupChatId}/leave`);
    return response.data;
  },

  /** Cancel a group chat. Requires caller to be the group admin or system admin. */
  async cancelGroupChat(groupChatId: string): Promise<{ groupChat: GroupChat }> {
    const response = await apiClient.put(`/api/v1/group-chats/${groupChatId}/cancel`);
    return response.data;
  },

  /**
   * Request an appointment to join an individual group chat.
   * Only customers may call this. Creates a PendingAppointment awaiting expert approval.
   */
  async requestAppointment(groupChatId: string): Promise<{ appointment: PendingAppointment }> {
    const response = await apiClient.post(`/api/v1/group-chats/${groupChatId}/appointment`);
    return response.data;
  },

  /**
   * Approve a pending appointment (expert/admin only).
   * Adds the requesting user to participants, activates the group, and removes the appointment.
   */
  async approveAppointment(
    groupChatId: string,
    appointmentId: string
  ): Promise<{ message: string; groupChat: GroupChat }> {
    const response = await apiClient.put(
      `/api/v1/group-chats/${groupChatId}/appointment/${appointmentId}/approve`
    );
    return response.data;
  },

  /** Send a message to a group chat. Caller must be a participant. */
  async sendGroupMessage(
    groupChatId: string,
    data: SendGroupMessageData
  ): Promise<{ message: GroupMessage }> {
    const response = await apiClient.post(
      `/api/v1/group-chats/${groupChatId}/messages`,
      data
    );
    return response.data;
  },

  /** Retrieve paginated messages for a group chat. Caller must be a participant. */
  async getGroupMessages(
    groupChatId: string,
    params?: GroupMessageListParams
  ): Promise<GroupMessageListResponse> {
    const response = await apiClient.get(
      `/api/v1/group-chats/${groupChatId}/messages`,
      { params }
    );
    return response.data;
  },
};
