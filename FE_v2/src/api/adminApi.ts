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

