export type WaitlistSeats = { occupied: number; maxAttendees: number | null };

export type WaitlistStudent = {
  requestId: string;
  userId: string;
  name: string;
  joinedAt: string | null;
};

export type WaitlistSeminar = {
  seminarId: string;
  title: string;
  start: string | null;
  recurring: boolean;
  seats: WaitlistSeats;
  students: WaitlistStudent[];
};

export type WaitlistAdmitResult = {
  admitted: number;
  awaitingPayment: number;
  enrolled: number;
  stillWaiting: number;
  maxAttendees: number | null;
};

/** Older requests that hold a payment and still need the host's Accept or Decline. */
export function isLegacyHeldSeatRequest(request: any): boolean {
  if (request?.paymentIntent) return true;
  return String(request?.paymentMode || '') === 'wallet' && Number(request?.amount) > 0;
}

/** Groups waiting students by seminar, soonest first. Join order comes from the API. */
export function groupWaitlistBySeminar(
  requests: any[],
  seats: Record<string, WaitlistSeats> = {},
): WaitlistSeminar[] {
  const bySeminar = new Map<string, WaitlistSeminar>();
  for (const request of requests) {
    if (isLegacyHeldSeatRequest(request)) continue;
    const seminar = request?.groupChat;
    const seminarId = String(seminar?._id || '');
    if (!seminarId) continue;
    if (!bySeminar.has(seminarId)) {
      bySeminar.set(seminarId, {
        seminarId,
        title: seminar?.name || 'Seminar',
        start: seminar?.start || null,
        recurring: !!seminar?.seriesId,
        seats: seats[seminarId] || { occupied: 0, maxAttendees: null },
        students: [],
      });
    }
    bySeminar.get(seminarId)!.students.push({
      requestId: String(request?._id || ''),
      userId: String(request?.customer?._id || ''),
      name: request?.customer?.username || request?.customer?.email || 'Student',
      joinedAt: request?.createdAt || null,
    });
  }
  const startMs = (seminar: WaitlistSeminar) =>
    seminar.start ? new Date(seminar.start).getTime() : Number.MAX_SAFE_INTEGER;
  return Array.from(bySeminar.values()).sort((a, b) => startMs(a) - startMs(b));
}

/** How many students a typed number admits: limited to the waitlist, null if not valid. */
export function admitCountFromInput(input: string, waiting: number): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (value < 1) return null;
  return Math.min(value, waiting);
}

/** Mirrors the server: max attendees only rises as far as the admitted students need. */
export function maxAttendeesAfterAdmit(seats: WaitlistSeats, admitCount: number): number | null {
  if (seats.maxAttendees == null) return null;
  return Math.max(seats.maxAttendees, seats.occupied + admitCount);
}

const studentCount = (count: number) => `${count} ${count === 1 ? 'student' : 'students'}`;

export function admitConfirmation(seats: WaitlistSeats, admitCount: number): string {
  const admitting = `Admit ${studentCount(admitCount)} from the waitlist?`;
  const next = maxAttendeesAfterAdmit(seats, admitCount);
  if (next == null) return admitting;
  return next === seats.maxAttendees
    ? `${admitting} Max attendees stays at ${next}.`
    : `${admitting} Max attendees goes from ${seats.maxAttendees} to ${next}.`;
}

export function admitResultMessage(title: string, result: WaitlistAdmitResult): string {
  const parts = [`${studentCount(result.admitted)} admitted to “${title}”.`];
  if (result.awaitingPayment > 0) {
    parts.push(`${studentCount(result.awaitingPayment)} must pay by the deadline to keep the seat.`);
  }
  if (result.enrolled > 0) {
    parts.push(`${studentCount(result.enrolled)} enrolled.`);
  }
  if (result.maxAttendees != null) {
    parts.push(`Max attendees is now ${result.maxAttendees}.`);
  }
  return parts.join(' ');
}
