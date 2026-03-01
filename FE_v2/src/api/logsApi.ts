import { apiClient } from "./client";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface LogsResponse {
  logs: Array<{
    id: string;
    level: string;
    message: string;
    metadata?: Record<string, JsonValue>;
    timestamp: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const logsApi = {
  async getLogs(page = 1, limit = 50, level?: string): Promise<LogsResponse> {
    const params: { page: number; limit: number; level?: string } = { page, limit };
    if (level) params.level = level;

    const response = await apiClient.get("/api/v1/logs", { params });
    return response.data;
  },

  async clearLogs(): Promise<void> {
    await apiClient.delete("/api/v1/logs");
  },
};

