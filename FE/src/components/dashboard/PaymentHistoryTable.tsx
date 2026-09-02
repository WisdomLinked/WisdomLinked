import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { doGetCustomerPaymentHistory } from '../../api/api';
import StripeReference from './StripeReference';

// Single source of truth for the student payment-history view.
// Rendered both in the left-sidebar page (StudentPaymentHistory) and in the
// "Security & billing" modal (StudentProfile) — keep the data shape here only.

export type PaymentRecord = {
  _id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentKind: 'individual' | 'seminar' | 'other';
  createdAt: string;
  receiptUrl?: string | null;
  paymentIntent?: string | null;
  balanceTransaction?: string | null;
  receiptNumber?: string | null;
  expert?: { username: string; email: string };
  groupChat?: { name: string; type: string };
  event?: { title: string };
};

/** Fetches the logged-in student's payment history. Pass enabled=false to defer (e.g. until a modal opens). */
export function usePaymentHistory(enabled: boolean = true) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return doGetCustomerPaymentHistory()
      .then((data: any) => setPayments(data?.result ?? []))
      .catch(() => setError('Failed to load payment history.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return { payments, loading, error, reload: load };
}

type TableProps = {
  payments: PaymentRecord[];
  loading: boolean;
  error: string;
  /** Keeps the header visible while the body scrolls (used inside the modal). */
  stickyHeader?: boolean;
  /** Drops the table's own padding when the surrounding card already provides it. */
  flush?: boolean;
};

/** "Individual" / "Seminar" / "Other" label for the payment kind. */
function kindLabel(p: PaymentRecord): string {
  return p.paymentKind === 'seminar' ? 'Seminar' : p.paymentKind === 'individual' ? 'Individual' : 'Other';
}

/** The counterparty/title shown under the kind label. */
function detailName(p: PaymentRecord): string {
  if (p.paymentKind === 'seminar') return p.groupChat?.name ?? '';
  return p.expert?.username ?? p.groupChat?.name ?? p.event?.title ?? '';
}

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  failed: 'bg-red-50 text-red-700 border-red-100',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200',
  withheld: 'bg-sky-50 text-sky-700 border-sky-100',
  released: 'bg-slate-50 text-slate-600 border-slate-100',
};

export function PaymentHistoryTable({ payments, loading, error, stickyHeader = false, flush = false }: TableProps) {
  const headRow = `border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500${
    stickyHeader ? ' sticky top-0 bg-white' : ''
  }`;

  return (
    <div className={`overflow-x-auto${flush ? '' : ' px-5 py-4 md:px-6'}`}>
      <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[13px]">
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[13%]" />
          <col className="w-[19%]" />
          <col className="w-[14%]" />
          <col className="w-[15%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className={headRow}>
            <th className="pb-3 pr-4 font-semibold">Receipt</th>
            <th className="pb-3 pr-4 font-semibold">Date</th>
            <th className="pb-3 pr-4 font-semibold">Purpose</th>
            <th className="pb-3 pr-4 font-semibold">Session / Details</th>
            <th className="pb-3 pr-4 font-semibold">Transaction ID</th>
            <th className="pb-3 pr-4 font-semibold">Balance transaction</th>
            <th className="pb-3 pr-4 font-semibold">Status</th>
            <th className="pb-3 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {loading ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading payment history…
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-sm text-red-500">{error}</td>
            </tr>
          ) : payments.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-sm text-slate-400">No payment history yet.</td>
            </tr>
          ) : (
            payments.map(p => {
              const detail = detailName(p);
              const st = (p.status || 'completed').toLowerCase();
              const badgeClass = statusStyles[st] || 'bg-slate-50 text-slate-700 border-slate-100';

              return (
                <tr key={p._id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 align-top">
                    <a
                      href={`/user/receipt/${p._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#234C6A] underline underline-offset-2"
                    >
                      View
                    </a>
                  </td>
                  <td className="py-3 pr-4 align-top text-slate-600">
                    {new Date(p.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <span className="block break-words text-slate-800" title={p.description ?? ''}>
                      {p.description ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <span className="text-slate-500">{kindLabel(p)}</span>
                    {detail ? <span className="block break-words text-slate-700">{detail}</span> : null}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <StripeReference value={p.paymentIntent} />
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <StripeReference value={p.balanceTransaction} />
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${badgeClass}`}
                    >
                      {st}
                    </span>
                  </td>
                  <td className="py-3 text-right align-top font-semibold tabular-nums text-slate-900">
                    {(p.currency ?? 'usd').toUpperCase()} {(p.amount / 100).toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentHistorySummary({ payments, loading }: { payments: PaymentRecord[]; loading: boolean }) {
  const totalSpentCents = payments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + p.amount, 0);
  if (loading) return <>Loading…</>;
  return (
    <>
      Total payments: {payments.length} · Total spent: USD {(totalSpentCents / 100).toFixed(2)}
    </>
  );
}
