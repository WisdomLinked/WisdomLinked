import { apiClient } from "./client";

// ──────────────────────────────────────────────────────────────────────────────
// Domain types
// ──────────────────────────────────────────────────────────────────────────────

export type MessageType = "text" | "file" | "system";

export interface ConversationParticipant {
  _id: string;
  username: string;
  email: string;
  image?: string;
}

export interface ConversationLastMessage {
  _id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: ConversationLastMessage | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAuthor {
  _id: string;
  username: string;
  image?: string;
}

export interface Message {
  id: string;
  author: MessageAuthor | string;
  content: string;
  type: MessageType;
  conversationId: string;
  fileUrl?: string;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Response types
// ──────────────────────────────────────────────────────────────────────────────

export interface ListConversationsResponse {
  conversations: Conversation[];
}

export interface GetConversationResponse {
  conversation: Conversation;
}

export interface SendMessageResponse {
  message: Message;
}

export interface GetMessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Request parameter types
// ──────────────────────────────────────────────────────────────────────────────

export interface SendMessageParams {
  content: string;
  type?: "text" | "file";
  fileUrl?: string;
}

export interface GetMessagesParams {
  page?: number;
  limit?: number;
}

export interface UploadChatFileResponse {
  fileUrl: string;
  filename: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// API client
// ──────────────────────────────────────────────────────────────────────────────

export const conversationsApi = {
  async listConversations(): Promise<ListConversationsResponse> {
    const response = await apiClient.get("/api/v1/conversations");
    return response.data;
  },

  async getConversation(conversationId: string): Promise<GetConversationResponse> {
    const response = await apiClient.get(`/api/v1/conversations/${conversationId}`);
    return response.data;
  },

  async sendMessage(
    conversationId: string,
    params: SendMessageParams
  ): Promise<SendMessageResponse> {
    const response = await apiClient.post(
      `/api/v1/conversations/${conversationId}/messages`,
      params
    );
    return response.data;
  },

  async getMessages(
    conversationId: string,
    params: GetMessagesParams = {}
  ): Promise<GetMessagesResponse> {
    const response = await apiClient.get(
      `/api/v1/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  },

  async uploadChatFile(
    conversationId: string,
    file: File
  ): Promise<UploadChatFileResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(
      `/api/v1/conversations/${conversationId}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },
};
