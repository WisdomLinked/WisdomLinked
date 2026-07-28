// Waiting-list (seat request) availability for a full seminar, mirrored from the
// server guard in BE/utils/seminarCapacity.ts. A request holds the fee on the
// student's card via Stripe, and that authorization only lives ~7 days, so the
// waiting list cannot open earlier than 7 days before the seminar starts.
// The student is told this up front instead of discovering it at the payment step.

export const SEAT_REQUEST_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type SeatRequestWindowState =
  /** Inside the hold window — the student can pay to join the waiting list now. */
  | 'open'
  /** Still further out than the hold window — come back after `opensAtMs`. */
  | 'too_early'
  /** The seminar has started; nothing to wait for. */
  | 'closed'
  /** No usable start date on the seminar yet. */
  | 'undated';

export type SeatRequestWindow = {
  state: SeatRequestWindowState;
  /** When the waiting list opens; 0 when the seminar has no usable start date. */
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
  const opensAtMs = start - SEAT_REQUEST_HOLD_MS;
  if (start <= nowMs) return { state: 'closed', opensAtMs };
  return { state: start <= nowMs + SEAT_REQUEST_HOLD_MS ? 'open' : 'too_early', opensAtMs };
}

export function formatSeatRequestOpenDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Full sentence shown next to a "Full" seminar, explaining what the student can do. */
export function seatRequestWindowMessage(
  window: SeatRequestWindow,
  options?: { price?: number },
): string {
  const paid = (options?.price ?? 0) > 0;
  switch (window.state) {
    case 'open':
      return paid
        ? 'Pay to get on the waiting list for the host to approve. Your card is authorized, not charged — you’re only charged if the host approves.'
        : 'Join the waiting list for the host to approve. You’re enrolled only if they approve.';
    case 'too_early':
      return `After ${formatSeatRequestOpenDate(window.opensAtMs)}, check for seat availability again — the waiting list opens 7 days before the seminar starts.`;
    case 'closed':
      return 'This seminar has already started, so the waiting list is closed.';
    default:
      return 'The waiting list opens once the host sets a start date.';
  }
}

/** Compact version for cards and badges, where a full sentence doesn't fit. */
export function seatRequestWindowShortLabel(window: SeatRequestWindow): string {
  switch (window.state) {
    case 'open':
      return 'Waiting list open';
    case 'too_early':
      return `Waiting list opens ${formatSeatRequestOpenDate(window.opensAtMs)}`;
    case 'closed':
      return 'Waiting list closed';
    default:
      return 'Waiting list opens once dated';
  }
}

/** Button label for joining the waiting list; only meaningful when the window is open. */
export function seatRequestActionLabel(price: number): string {
  return price > 0 ? 'Pay to join the waiting list' : 'Join the waiting list';
}
