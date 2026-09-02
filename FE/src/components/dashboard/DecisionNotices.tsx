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

const HEADLINE: Record<DecisionNotice['outcome'], string> = {
  accepted: 'accepted',
  accepted_awaiting_payment: 'accepted',
  declined: 'declined',
  withdrawn: 'withdrew',
};

const hoursLeft = (decidedAt: string) => {
  const decided = new Date(decidedAt).getTime();
  if (!Number.isFinite(decided)) return 0;
  return Math.max(0, Math.ceil((decided + 48 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)));
};

/**
 * Notes an expert attached to a recent accept or decline. The backend only
 * returns notices inside the 48-hour window, and dismissing one marks it read so
 * it never comes back — email remains the durable copy.
 */
export default function DecisionNotices({
  enabled = true,
  onPay,
}: {
  enabled?: boolean;
  onPay?: (notice: DecisionNotice) => void;
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
        const what = notice.kind === 'seat' ? 'seminar seat request' : '1:1 request';
        const remaining = hoursLeft(notice.decidedAt);
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
                {who} {HEADLINE[notice.outcome]} your {what}
                {notice.title ? ` for “${notice.title}”` : ''}.
              </p>
              <p className="mt-1 whitespace-pre-line text-[12px] text-slate-700">{notice.note}</p>
              {awaitingPayment ? (
                <div className="mt-2">
                  <p className="text-[12px] font-medium text-emerald-900">
                    Pay
                    {typeof notice.price === 'number' ? ` $${notice.price}` : ''} with WeChat Pay or
                    Alipay to confirm it
                    {notice.payBy
                      ? ` by ${new Date(notice.payBy).toLocaleString()}`
                      : ''}
                    .
                  </p>
                  {onPay ? (
                    <button
                      type="button"
                      onClick={() => onPay(notice)}
                      className="mt-2 rounded-[4px] bg-[#1A3A4A] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#122635]"
                    >
                      Pay now
                    </button>
                  ) : null}
                </div>
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
