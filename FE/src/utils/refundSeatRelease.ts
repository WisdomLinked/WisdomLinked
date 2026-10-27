export type RefundSeatNotice = { sessionName: string; series: boolean };

export function seatReleasedByRefund(paymentItem: any, nowMs: number = Date.now()): RefundSeatNotice | null {
  const session = paymentItem?.groupChat;
  if (!session || typeof session !== 'object') return null;
  if (session.type !== 'individual' && session.type !== 'seminar') return null;
  if (session.status === 'cancelled') return null;
  const series = session.type === 'seminar' && Boolean(session.seriesId);
  const endMs = new Date(session.end ?? session.start ?? '').getTime();
  if (!series && Number.isFinite(endMs) && endMs <= nowMs) return null;
  const sessionName = String(session.name || (session.type === 'seminar' ? 'this seminar' : 'this 1:1 session'));
  return { sessionName, series };
}
