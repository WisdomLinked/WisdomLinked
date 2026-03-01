import { apiClient } from "./client";

export interface PublicSettings {
  registrationEnabled: boolean;
  loginMethods: {
    local: boolean;
    discord: boolean;
  };
}

export const settingsApi = {
  async getPublicSettings(): Promise<PublicSettings> {
    const response = await apiClient.get("/api/v1/settings/public");
    return response.data;
  },
};
