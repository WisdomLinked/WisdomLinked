import { apiClient } from "./client";

export interface SystemSettings {
  registrationEnabled: boolean;
  loginMethods: {
    local: boolean;
    discord: boolean;
  };
  discordOAuth: {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
  };
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
}

export interface UserManagementSearchResponse {
  users: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    authMethods: string[];
    lastLogin?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const userManagementApi = {
  async searchUsers(params: {
    search?: string;
    role?: string;
    isActive?: boolean;
    authMethod?: string;
    page?: number;
    limit?: number;
  }): Promise<UserManagementSearchResponse> {
    const response = await apiClient.get("/api/v1/user-management/users", { params });
    return response.data;
  },

  async getUserStats(): Promise<UserStats> {
    const response = await apiClient.get("/api/v1/user-management/stats");
    return response.data;
  },

  async toggleUserStatus(userId: string) {
    const response = await apiClient.put(`/api/v1/user-management/users/${userId}/toggle-status`);
    return response.data;
  },

  async resetUserPassword(userId: string, newPassword: string) {
    const response = await apiClient.post(`/api/v1/user-management/users/${userId}/reset-password`, {
      newPassword,
    });
    return response.data;
  },

  async generateResetLink(userId: string) {
    const response = await apiClient.post(`/api/v1/user-management/users/${userId}/generate-reset-link`);
    return response.data;
  },
};

export const settingsApi = {
  async getSettings(): Promise<{ settings: SystemSettings }> {
    const response = await apiClient.get("/api/v1/settings");
    return response.data;
  },

  async updateSettings(settings: SystemSettings): Promise<{ message: string; settings: SystemSettings }> {
    const response = await apiClient.put("/api/v1/settings", settings);
    return response.data;
  },
};

export const oauthApi = {
  async getDiscordAuthUrl() {
    const response = await apiClient.get("/api/v1/oauth/discord");
    return response.data;
  },

  async handleDiscordCallback(code: string) {
    const response = await apiClient.get(`/api/v1/oauth/discord/callback?code=${code}`);
    return response.data;
  },
};

// ── Shared paginated response envelope ──────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Chatbot Q&A types ────────────────────────────────────────────────────────

export interface ChatBotQA {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Contact submission types ─────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ── Event feedback types ─────────────────────────────────────────────────────

export interface FeedbackEntry {
  id: string;
  rating: number;
  comment: string;
  authorUsername: string;
  createdAt: string;
}

export interface EventWithFeedback {
  id: string;
  title: string;
  expertName: string;
  customerName: string;
  completedAt: string;
  feedbacks: FeedbackEntry[];
}

// ── Admin chat types ─────────────────────────────────────────────────────────

export interface AdminConversation {
  id: string;
  participants: string[];
  lastMessagePreview: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface AdminMessage {
  id: string;
  authorUsername: string;
  content: string;
  type: "text" | "file" | "system";
  createdAt: string;
}

// ── Chatbot API ──────────────────────────────────────────────────────────────

export const chatbotApi = {
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<ChatBotQA>> {
    const response = await apiClient.get("/api/v1/chatbot", { params });
    return response.data;
  },

  async create(data: {
    question: string;
    answer: string;
    category?: string;
  }): Promise<ChatBotQA> {
    const response = await apiClient.post("/api/v1/chatbot", data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<{ question: string; answer: string; category: string; isActive: boolean }>,
  ): Promise<ChatBotQA> {
    const response = await apiClient.put(`/api/v1/chatbot/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/chatbot/${id}`);
  },
};

// ── Contacts API ─────────────────────────────────────────────────────────────

export const contactsApi = {
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    isRead?: boolean;
  }): Promise<PaginatedResponse<Contact>> {
    const response = await apiClient.get("/api/v1/contacts", { params });
    return response.data;
  },

  async markRead(id: string): Promise<Contact> {
    const response = await apiClient.put(`/api/v1/contacts/${id}/read`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/contacts/${id}`);
  },
};

// ── Feedback API ─────────────────────────────────────────────────────────────

export const feedbackApi = {
  async list(params: {
    page?: number;
    limit?: number;
    expertId?: string;
  }): Promise<PaginatedResponse<EventWithFeedback>> {
    const response = await apiClient.get("/api/v1/feedback", { params });
    return response.data;
  },
};

// ── Admin Chats API ───────────────────────────────────────────────────────────

export const adminChatsApi = {
  async listConversations(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<AdminConversation>> {
    const response = await apiClient.get("/api/v1/admin/chats", { params });
    return response.data;
  },

  async getMessages(
    conversationId: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<AdminMessage>> {
    const response = await apiClient.get(
      `/api/v1/admin/chats/${conversationId}/messages`,
      { params },
    );
    return response.data;
  },
};

