import { atom } from "jotai";

export type EventType = "session" | "seminar" | "webinar";
export type EventStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface EventParticipant {
  userId: string;
  username: string;
  role: "host" | "attendee";
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  status: EventStatus;
  hostId: string;
  hostUsername: string;
  participants: EventParticipant[];
  scheduledAt: string;
  durationMinutes: number;
  roomId: string | null;
  createdAt: string;
}

export const eventsAtom = atom<CalendarEvent[]>([]);
export const activeEventIdAtom = atom<string | null>(null);
