/**
 * A student's open seat requests, indexed so a seminar view can tell which of three
 * states it is in. Approval and payment are separate events for a wallet request, so
 * "approved but unpaid" must not read as "no request" — that puts the join-the-waiting-list
 * button back in front of a student who is already holding an approved seat.
 */
export type SeatRequestState = 'awaiting_host' | 'awaiting_payment';

export type SeatRequestEntry = {
  requestId: string;
  groupChatId: string;
  seriesId: string;
  state: SeatRequestState;
  /** Dollars owed, from the amount snapshotted when the host approved. */
  price: number;
  payBy: string | null;
  /** 'host' when the host invited this student, rather than the student asking. */
  origin: 'student' | 'host';
};

export type SeatRequestIndex = {
  byGroupChat: Map<string, SeatRequestEntry>;
  bySeries: Map<string, SeatRequestEntry>;
};

export const emptySeatRequestIndex = (): SeatRequestIndex => ({
  byGroupChat: new Map(),
  bySeries: new Map(),
});

const openStateOf = (row: any, now: number): SeatRequestState | null => {
  const status = String(row?.status || '').toLowerCase();
  if (status === 'pending') return 'awaiting_host';
  if (status !== 'awaiting_payment') return null;
  // A lapsed window is not an open request — the sweep is about to release the seat,
  // and the student should be able to ask again.
  if (!row?.paymentDeadline) return 'awaiting_payment';
  const due = new Date(row.paymentDeadline).getTime();
  return Number.isFinite(due) && due <= now ? null : 'awaiting_payment';
};

export const indexSeatRequests = (
  rows: any,
  now: number = Date.now(),
): SeatRequestIndex => {
  const index = emptySeatRequestIndex();
  (Array.isArray(rows) ? rows : []).forEach((row: any) => {
    const state = openStateOf(row, now);
    if (!state) return;

    const seminar = row?.groupChat;
    const groupChatId = String(
      (seminar && typeof seminar === 'object' ? seminar._id : seminar) ?? '',
    );
    if (!groupChatId) return;
    const seriesId = String(
      (seminar && typeof seminar === 'object' ? seminar.seriesId : '') ?? '',
    );

    const entry: SeatRequestEntry = {
      requestId: String(row?._id ?? ''),
      groupChatId,
      seriesId,
      state,
      price: typeof row?.amount === 'number' ? row.amount / 100 : 0,
      payBy: row?.paymentDeadline ?? null,
      origin: String(row?.origin || 'student') === 'host' ? 'host' : 'student',
    };

    // An unpaid approval outranks a pending request for the same seminar: it is the one
    // the student can actually act on.
    const keep = (existing?: SeatRequestEntry) =>
      !existing || (existing.state === 'awaiting_host' && state === 'awaiting_payment');

    if (keep(index.byGroupChat.get(groupChatId))) index.byGroupChat.set(groupChatId, entry);
    if (seriesId && keep(index.bySeries.get(seriesId))) index.bySeries.set(seriesId, entry);
  });
  return index;
};

/** The open request covering a seminar, matching a series booking on any occurrence. */
export const seatRequestFor = (
  index: SeatRequestIndex | null | undefined,
  seminar: any,
): SeatRequestEntry | null => {
  if (!index || !seminar) return null;
  const id = String(seminar?._id ?? seminar?.id ?? '');
  const direct = id ? index.byGroupChat.get(id) : undefined;
  if (direct) return direct;
  const seriesId = String(seminar?.seriesId ?? '');
  return (seriesId && index.bySeries.get(seriesId)) || null;
};
