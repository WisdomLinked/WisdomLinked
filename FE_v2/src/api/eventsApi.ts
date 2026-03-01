import { apiClient } from "./client";

// ── Types ──────────────────────────────────────────────────────────────────

export type EventStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export interface EventParticipantSummary {
  id: string;
  username: string;
}

export interface EventParticipantDetail {
  id: string;
  username: string;
  email: string;
  image?: string;
  title?: string;
}

export interface Event {
  id: string;
  expert: EventParticipantDetail;
  customer: EventParticipantDetail;
  start?: string;
  end?: string;
  duration?: number;
  title?: string;
  status: EventStatus;
  price?: number;
  totalTimeSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventListItem {
  id: string;
  expert: EventParticipantSummary;
  customer: EventParticipantSummary;
  start?: string;
  end?: string;
  duration?: number;
  title?: string;
  status: EventStatus;
  price?: number;
  totalTimeSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title?: string;
  start?: string;
  end?: string;
  status: EventStatus;
  expert: EventParticipantSummary;
  customer: EventParticipantSummary;
}

export interface CreateEventData {
  customerId: string;
  start?: string;
  end?: string;
  duration?: number;
  title?: string;
  price?: number;
}

export interface EventListResponse {
  events: EventListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EventListParams {
  status?: EventStatus;
  role?: "as-expert" | "as-customer";
  page?: number;
  limit?: number;
}

export interface FeedbackData {
  rating: number;
  comment?: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
}

// ── Created event response type (expert/customer are IDs, not populated) ──

export interface CreatedEvent {
  id: string;
  expert: string;
  customer: string;
  start?: string;
  end?: string;
  duration?: number;
  title?: string;
  status: EventStatus;
  price?: number;
  createdBy: string;
  totalTimeSpent: number;
  createdAt: string;
  updatedAt: string;
}

// ── API methods ────────────────────────────────────────────────────────────

export const eventsApi = {
  async createEvent(
    data: CreateEventData
  ): Promise<{ event: CreatedEvent }> {
    const response = await apiClient.post("/api/v1/events", data);
    return response.data;
  },

  async getEvent(eventId: string): Promise<{ event: Event }> {
    const response = await apiClient.get(`/api/v1/events/${eventId}`);
    return response.data;
  },

  async listEvents(params?: EventListParams): Promise<EventListResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.status !== undefined) queryParams["status"] = params.status;
    if (params?.role !== undefined) queryParams["role"] = params.role;
    if (params?.page !== undefined)
      queryParams["page"] = String(params.page);
    if (params?.limit !== undefined)
      queryParams["limit"] = String(params.limit);

    const response = await apiClient.get("/api/v1/events", {
      params: queryParams,
    });
    return response.data;
  },

  async acceptEvent(eventId: string): Promise<{ event: EventListItem }> {
    const response = await apiClient.put(
      `/api/v1/events/${eventId}/accept`
    );
    return response.data;
  },

  async declineEvent(eventId: string): Promise<{ event: EventListItem }> {
    const response = await apiClient.put(
      `/api/v1/events/${eventId}/decline`
    );
    return response.data;
  },

  async cancelEvent(
    eventId: string
  ): Promise<{ event: EventListItem; refundRequested?: boolean }> {
    const response = await apiClient.put(
      `/api/v1/events/${eventId}/cancel`
    );
    return response.data;
  },

  async completeEvent(eventId: string): Promise<{ event: EventListItem }> {
    const response = await apiClient.put(
      `/api/v1/events/${eventId}/complete`
    );
    return response.data;
  },

  async getCalendar(
    startDate: string,
    endDate: string
  ): Promise<CalendarResponse> {
    const response = await apiClient.get("/api/v1/events/calendar", {
      params: { startDate, endDate },
    });
    return response.data;
  },

  async submitFeedback(
    eventId: string,
    data: FeedbackData
  ): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/api/v1/events/${eventId}/feedback`,
      data
    );
    return response.data;
  },
};
