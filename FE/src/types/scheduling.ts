/** Shared scheduling shapes for User availability and bookings (BE-aligned). */

export type BookingNoticeHours = 24 | 48 | 72;

/** Half-hour index 0–47 within a nominal local day (00:00 = 0, 00:30 = 1, …). */
export type HalfHourSlotIndex = number;

export interface ExpertSchedulingFields {
  timeSlots?: HalfHourSlotIndex[];
  dailyTimeSlots?: number[];
  blockedBookingDates?: string[];
  bookingNoticeHours?: BookingNoticeHours | number;
  price?: number | number[];
  timeZone?: string;
}

export type EventStatus = 'pending' | 'accepted' | 'declined';

/** @deprecated Legacy 1:1 calendar event; new bookings use GroupChat individual. */
export interface CalendarEvent {
  _id: string;
  title?: string;
  start: string | Date;
  end: string | Date;
  duration?: number;
  price?: number;
  status?: EventStatus;
  expert?: string | { _id: string };
  customer?: string | { _id: string };
  paidBy?: string;
  createdBy?: string;
}

export type GroupChatType = 'seminar' | 'individual' | 'community';
export type GroupChatStatus = 'pending' | 'active' | 'cancelled';

export interface GroupChatBooking {
  _id: string;
  name?: string;
  start: string | Date;
  end: string | Date;
  duration?: number;
  price?: number;
  type?: GroupChatType;
  status?: GroupChatStatus;
  paidBy?: string;
}

export interface PendingGroupChatEnrollment {
  groupChatId?: GroupChatBooking;
}

export interface CreateGroupChatByUserPayload {
  name: string;
  description?: string;
  services?: string[];
  keywords?: string[];
  start: string | Date;
  end: string | Date;
  duration: number;
  price: number;
  expert: string;
  payment_intent?: string;
}

export type BookingDisplayTimeZoneMode = 'mine' | 'expert' | 'custom';
