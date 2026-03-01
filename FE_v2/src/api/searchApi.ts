import { apiClient } from "./client";

export interface ExpertResult {
  id: string;
  username: string;
  email: string;
  role: string;
  title?: string;
  description?: string;
  image?: string;
  rating: number;
  price: number[];
  timeSlots: number[];
  keywords: Array<{ _id: string; name?: string }>;
  services: Array<{ _id: string; name?: string }>;
  country?: string;
  city?: string;
  timeZone?: string;
}

export interface CustomerResult {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  status: string;
  image?: string;
  country?: string;
  city?: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SearchExpertsResponse {
  experts: ExpertResult[];
  pagination: PaginationMeta;
}

export interface SearchCustomersResponse {
  customers: CustomerResult[];
  pagination: PaginationMeta;
}

export interface SearchExpertsParams {
  name?: string;
  /** Comma-separated keyword IDs */
  keywords?: string;
  /** Comma-separated service IDs */
  services?: string;
  /** Minimum rating (0–5) */
  rating?: number;
  page?: number;
  limit?: number;
}

export interface SearchCustomersParams {
  name?: string;
  page?: number;
  limit?: number;
}

function buildQueryString(
  params: Record<string, string | number | undefined>
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  const qs = entries
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join("&");
  return `?${qs}`;
}

export const searchApi = {
  async searchExperts(
    params: SearchExpertsParams = {}
  ): Promise<SearchExpertsResponse> {
    const qs = buildQueryString({
      name: params.name,
      keywords: params.keywords,
      services: params.services,
      rating: params.rating,
      page: params.page,
      limit: params.limit,
    });
    const response = await apiClient.get(`/api/v1/search/experts${qs}`);
    return response.data;
  },

  async searchCustomers(
    params: SearchCustomersParams = {}
  ): Promise<SearchCustomersResponse> {
    const qs = buildQueryString({
      name: params.name,
      page: params.page,
      limit: params.limit,
    });
    const response = await apiClient.get(`/api/v1/search/customers${qs}`);
    return response.data;
  },
};
