import { apiClient } from "./client";

export const sessionApi = {
  async getMySessions() {
    const response = await apiClient.get("/api/v1/sessions/my-sessions");
    return response.data;
  },

  async revokeSession(sessionId: string) {
    const response = await apiClient.delete(`/api/v1/sessions/${sessionId}`);
    return response.data;
  },

  async revokeAllSessions() {
    const response = await apiClient.delete("/api/v1/sessions");
    return response.data;
  },

  async getUserSessions(userId: string) {
    const response = await apiClient.get(`/api/v1/sessions/user/${userId}`);
    return response.data;
  },

  async revokeUserSessions(userId: string) {
    const response = await apiClient.delete(`/api/v1/sessions/user/${userId}`);
    return response.data;
  },
};

