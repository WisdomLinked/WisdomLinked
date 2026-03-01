import { atom } from "jotai";

export interface Metric {
  id: string;
  path: string;
  method: string;
  ip?: string;
  username?: string;
  userId?: string;
  isAuthenticated: boolean;
  timestamp: string;
  responseTime?: number;
  statusCode?: number;
}

export interface MetricsSummary {
  totalRequests: number;
  authenticatedRequests: number;
  anonymousRequests: number;
  uniquePaths: number;
}

export interface EndpointStat {
  path: string;
  count: number;
  avgResponseTime: number;
}

export const metricsAtom = atom<Metric[]>([]);
export const metricsSummaryAtom = atom<MetricsSummary | null>(null);
export const topEndpointsAtom = atom<EndpointStat[]>([]);
export const metricsLoadingAtom = atom<boolean>(false);

