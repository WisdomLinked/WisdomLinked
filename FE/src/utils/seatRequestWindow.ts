// Waiting-list availability for a full seminar. Students can join the interest
// waitlist anytime before the seminar starts — no payment until a seat is offered.

export const SEAT_REQUEST_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type SeatRequestWindowState =
  /** Seminar is still upcoming — student can join the waitlist. */
  | 'open'
  /** @deprecated Interest waitlist no longer waits for a 7-day hold window. */
  | 'too_early'
  /** The seminar has started; nothing to wait for. */
  | 'closed'
  /** No usable start date on the seminar yet — still allow waitlist join. */
  | 'undated';

export type SeatRequestWindow = {
  state: SeatRequestWindowState;
  /** Legacy field; unused for interest waitlist (always 0 when open). */
  opensAtMs: number;
};

export function seatRequestWindow(
  startMs: number | null | undefined,
  nowMs: number = Date.now(),
): SeatRequestWindow {
  const start = Number(startMs);
  // Callers use MAX_SAFE_INTEGER as the "date TBD" sentinel when sorting seminars.
  if (!Number.isFinite(start) || start <= 0 || start >= Number.MAX_SAFE_INTEGER) {
    return { state: 'undated', opensAtMs: 0 };
  }
  if (start <= nowMs) return { state: 'closed', opensAtMs: start - SEAT_REQUEST_HOLD_MS };
  return { state: 'open', opensAtMs: start - SEAT_REQUEST_HOLD_MS };
}

export function formatSeatRequestOpenDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const FULL_WAITLIST_COPY =
  'This seminar is full. Join the waitlist — you’ll be offered a seat if one opens (first come, first served). No payment until you join.';

/** Full sentence shown next to a "Full" seminar, explaining what the student can do. */
export function seatRequestWindowMessage(
  window: SeatRequestWindow,
  _options?: { price?: number },
): string {
  switch (window.state) {
    case 'open':
    case 'too_early':
    case 'undated':
      return FULL_WAITLIST_COPY;
    case 'closed':
      return 'This seminar is full and has already started, so the waiting list is closed.';
    default:
      return FULL_WAITLIST_COPY;
  }
}

/** Compact version for cards and badges, where a full sentence doesn't fit. */
export function seatRequestWindowShortLabel(window: SeatRequestWindow): string {
  switch (window.state) {
    case 'closed':
      return 'Waiting list closed';
    default:
      return 'Join waitlist';
  }
}

/** Button label for joining the waiting list; only meaningful when the window is open. */
export function seatRequestActionLabel(_price?: number): string {
  return 'Join waitlist';
}

/** True when a full seminar can take an interest waitlist join. */
export function canJoinWaitlist(window: SeatRequestWindow): boolean {
  return window.state !== 'closed';
}
