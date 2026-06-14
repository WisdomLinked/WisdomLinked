import { CreditCard } from 'lucide-react';
import { usePaymentHistory, PaymentHistoryTable, PaymentHistorySummary } from './PaymentHistoryTable';

export default function StudentPaymentHistory() {
  const { payments, loading, error } = usePaymentHistory();

  return (
    <div className="px-6 py-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="h-6 w-6 text-[#234C6A]" />
        <h2 className="text-2xl font-semibold text-slate-900">Payment History</h2>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <PaymentHistoryTable payments={payments} loading={loading} error={error} />
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 text-sm text-slate-600">
          <PaymentHistorySummary payments={payments} loading={loading} />
        </div>
      </div>
    </div>
  );
}
