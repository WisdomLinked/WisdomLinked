import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { doGetCustomerPaymentHistory } from '../../api/api';

type PaymentRecord = {
  _id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentKind: 'individual' | 'seminar' | 'other';
  createdAt: string;
  expert?: { username: string; email: string };
  groupChat?: { name: string; type: string };
  event?: { title: string };
};

export default function StudentPaymentHistory() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    doGetCustomerPaymentHistory()
      .then((data: any) => setPayments(data?.result ?? []))
      .catch(() => setError('Failed to load payment history.'))
      .finally(() => setLoading(false));
  }, []);

  const totalSpentCents = payments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="px-6 py-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="h-6 w-6 text-[#234C6A]" />
        <h2 className="text-2xl font-semibold text-slate-900">Payment History</h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Session / Seminar</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type / Expert</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading payment history…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-red-500">{error}</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                    No payment history yet.
                  </td>
                </tr>
              ) : (
                payments.map(p => {
                  const sessionLabel = p.groupChat?.name ?? p.event?.title ?? p.description ?? '—';
                  const kindLabel = p.paymentKind === 'seminar' ? 'Seminar' : p.paymentKind === 'individual' ? 'Session' : 'Other';
                  const amountDollars = (p.amount / 100).toFixed(2);
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {(p.currency ?? 'usd').toUpperCase()} {amountDollars}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{sessionLabel}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <span className="text-slate-500">{kindLabel}</span>
                        {p.expert && (
                          <span className="block text-slate-700">{p.expert.username}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : p.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
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
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 text-sm text-slate-600">
          {loading ? 'Loading…' : (
            <>Total payments: {payments.length} · Total spent: USD {(totalSpentCents / 100).toFixed(2)}</>
          )}
        </div>
      </div>
    </div>
  );
}
