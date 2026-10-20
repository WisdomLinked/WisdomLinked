import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { getMyDecisionNotices, markDecisionNoticeRead } from '../../api/api';

export type DecisionNotice = {
  id: string;
  kind: 'session' | 'seat';
  outcome: 'accepted' | 'accepted_awaiting_payment' | 'declined' | 'withdrawn';
  title: string;
  note: string;
  decidedAt: string;
  /** Set only while payment is owed, so the notice can offer to collect it. */
  price?: number | null;
  payBy?: string | null;
  groupChatId?: string | null;
  expertName?: string | null;
};

const hoursLeft = (decidedAt: string) => {
  const decided = new Date(decidedAt).getTime();
  if (!Number.isFinite(decided)) return 0;
  return Math.max(0, Math.ceil((decided + 48 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)));
};

/**
 * Notes from recent accept / decline / seat-offer decisions. The backend only
 * returns notices inside the 48-hour window, and dismissing one marks it read so
 * it never comes back — email remains the durable copy.
 */
export default function DecisionNotices({
  enabled = true,
  onPay,
  onOpenSeminar,
}: {
  enabled?: boolean;
  onPay?: (notice: DecisionNotice) => void;
  onOpenSeminar?: (groupChatId: string) => void;
}) {
  const [notices, setNotices] = useState<DecisionNotice[]>([]);

  const load = useCallback(async () => {
    const res: any = await getMyDecisionNotices();
    setNotices(Array.isArray(res?.result) ? res.result : []);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const dismiss = async (notice: DecisionNotice) => {
    setNotices(prev => prev.filter(n => n.id !== notice.id));
    await markDecisionNoticeRead(notice.id, notice.kind);
  };

  if (!enabled || notices.length === 0) return null;

  return (
    <section className="space-y-2" aria-label="Responses from experts">
      {notices.map(notice => {
        const awaitingPayment = notice.outcome === 'accepted_awaiting_payment';
        const accepted = notice.outcome === 'accepted' || awaitingPayment;
        const who = notice.expertName || 'The expert';
        const remaining = hoursLeft(notice.decidedAt);
        const seatOffer = notice.kind === 'seat' && accepted;
        const headline = seatOffer
          ? awaitingPayment
            ? `A seat is available for “${notice.title || 'this seminar'}” — pay to confirm.`
            : `A seat opened for you on “${notice.title || 'this seminar'}” — you’re in.`
          : `${who} ${
              notice.outcome === 'accepted' || awaitingPayment
                ? 'accepted'
                : notice.outcome === 'withdrawn'
                  ? 'withdrew'
                  : 'declined'
            } your ${notice.kind === 'seat' ? 'seminar seat request' : '1:1 request'}${
              notice.title ? ` for “${notice.title}”` : ''
            }.`;
        return (
          <div
            key={`${notice.kind}-${notice.id}`}
            className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
              accepted
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            {accepted ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`text-[12px] font-semibold ${
                  accepted ? 'text-emerald-900' : 'text-amber-900'
                }`}
              >
                {headline}
              </p>
              <p className="mt-1 whitespace-pre-line text-[12px] text-slate-700">{notice.note}</p>
              {awaitingPayment ? (
                <div className="mt-2">
                  <p className="text-[12px] font-medium text-emerald-900">
                    Pay
                    {typeof notice.price === 'number' ? ` $${notice.price}` : ''} to confirm
                    {notice.payBy
                      ? ` by ${new Date(notice.payBy).toLocaleString()}`
                      : ''}
                    .
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {notice.kind === 'seat' && notice.groupChatId && onOpenSeminar ? (
                      <button
                        type="button"
                        onClick={() => onOpenSeminar(String(notice.groupChatId))}
                        className="rounded-[4px] border border-[#1A3A4A]/20 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
                      >
                        Open seminar
                      </button>
                    ) : null}
                    {onPay ? (
                      <button
                        type="button"
                        onClick={() => onPay(notice)}
                        className="rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#122635]"
                      >
                        Pay now
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : seatOffer && notice.groupChatId && onOpenSeminar ? (
                <button
                  type="button"
                  onClick={() => onOpenSeminar(String(notice.groupChatId))}
                  className="mt-2 rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#122635]"
                >
                  Open seminar
                </button>
              ) : null}
              <p className="mt-1 text-[10px] text-slate-500">
                Also sent to your email
                {remaining > 0 ? ` · this message clears in ${remaining}h` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void dismiss(notice)}
              aria-label="Dismiss this message"
              title="Dismiss"
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/70 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </section>
  );
}
