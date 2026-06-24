import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { doGetCustomerPaymentHistory } from '../../api/api';

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

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    doGetCustomerPaymentHistory()
      .then((data: any) => setPayments(data?.result ?? []))
      .catch(() => setError('Failed to load payment history.'))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { payments, loading, error };
}

type TableProps = {
  payments: PaymentRecord[];
  loading: boolean;
  error: string;
  /** Keeps the header visible while the body scrolls (used inside the modal). */
  stickyHeader?: boolean;
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

const TH = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500';

export function PaymentHistoryTable({ payments, loading, error, stickyHeader = false }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className={`bg-slate-50 border-b border-[#e8e6e1]${stickyHeader ? ' sticky top-0' : ''}`}>
          <tr>
            <th className={TH}>Receipt #</th>
            <th className={TH}>Date</th>
            <th className={TH}>Amount</th>
            <th className={TH}>Purpose</th>
            <th className={TH}>Session / Details</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading payment history…
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-red-500">{error}</td>
            </tr>
          ) : payments.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No payment history yet.</td>
            </tr>
          ) : (
            payments.map(p => {
              const amountDollars = (p.amount / 100).toFixed(2);
              const detail = detailName(p);
              return (
                <tr key={p._id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    {p.receiptNumber ? (
                      p.receiptNumber
                    ) : p.receiptUrl ? (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#234C6A] hover:underline"
                      >
                        View receipt
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                    {(p.currency ?? 'usd').toUpperCase()} {amountDollars}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{p.description ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <span className="text-slate-500">{kindLabel(p)}</span>
                    {detail && <span className="block text-slate-700">{detail}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : p.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.status}
                    </span>
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

/** Totals line shared by both payment-history views. */
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
