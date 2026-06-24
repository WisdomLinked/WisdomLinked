import { CreditCard } from 'lucide-react';
import { usePaymentHistory, PaymentHistoryTable, PaymentHistorySummary } from './PaymentHistoryTable';

export default function StudentPaymentHistory() {
  const { payments, loading, error } = usePaymentHistory();

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#F5F3EF] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="h-6 w-6 text-[#234C6A]" />
          <h2 className="text-2xl font-semibold text-slate-900">Payment History</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e8e6e1] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <PaymentHistoryTable payments={payments} loading={loading} error={error} />
          <div className="border-t border-[#e8e6e1] px-6 py-3 bg-slate-50 text-sm text-slate-600">
            <PaymentHistorySummary payments={payments} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}
