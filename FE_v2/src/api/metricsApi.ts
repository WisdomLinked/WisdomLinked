import { apiClient } from "./client";

export interface MetricsResponse {
  metrics: Array<{
    id: string;
    path: string;
    method: string;
    ip: string;
    username?: string;
    userId?: string;
    isAuthenticated: boolean;
    timestamp: string;
    responseTime?: number;
    statusCode?: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MetricsSummaryResponse {
  summary: {
    totalRequests: number;
    authenticatedRequests: number;
    anonymousRequests: number;
    uniquePaths: number;
  };
  topEndpoints: Array<{
    path: string;
    count: number;
    avgResponseTime: number;
  }>;
  recentActivity: Array<{
    id: string;
    path: string;
    method: string;
    username?: string;
    isAuthenticated: boolean;
    timestamp: string;
    responseTime?: number;
  }>;
}

export const metricsApi = {
  async getMetrics(page = 1, limit = 50, path?: string): Promise<MetricsResponse> {
    const params: { page: number; limit: number; path?: string } = { page, limit };
    if (path) params.path = path;

    const response = await apiClient.get("/api/v1/metrics", { params });
    return response.data;
  },

  async getMetricsSummary(): Promise<MetricsSummaryResponse> {
    const response = await apiClient.get("/api/v1/metrics/summary");
    return response.data;
  },

  async clearMetrics(): Promise<void> {
    await apiClient.delete("/api/v1/metrics");
  },
};

