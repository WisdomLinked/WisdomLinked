import { BookOpen, Receipt, RefreshCw, Users, Wallet } from 'lucide-react';
import { usePaymentHistory, PaymentHistoryTable } from './PaymentHistoryTable';

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

const TONE: Record<string, string> = {
  primary: 'bg-[#234C6A]/10 text-[#234C6A]',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
};

function StatCard({
  label,
  value,
  subline,
  icon: Icon,
  color = 'primary',
}: {
  label: string;
  value: string;
  subline: string;
  icon: any;
  color?: keyof typeof TONE;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e6e1] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-[12px] text-slate-500">{subline}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[color]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export default function StudentPaymentHistory() {
  const { payments, loading, error, reload } = usePaymentHistory();

  const completed = payments.filter(p => p.status === 'completed');
  const totalCents = completed.reduce((sum, p) => sum + p.amount, 0);
  const oneToOneCents = completed
    .filter(p => p.paymentKind === 'individual')
    .reduce((sum, p) => sum + p.amount, 0);
  const seminarCents = completed
    .filter(p => p.paymentKind === 'seminar')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F5F3EF] px-5 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-900 md:text-3xl">
              Payment History
            </h1>
            <p className="mt-1 max-w-xl text-[14px] text-slate-600">
              Payments you have made for 1:1 sessions and seminars. Amounts reflect
              successful charges; each row links to its Stripe receipt where one exists.
            </p>
          </div>
          {reload ? (
            <button
              type="button"
              onClick={() => reload()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e8e6e1] bg-white px-4 py-2 text-[13px] font-semibold text-[#234C6A] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Total spent"
            value={loading ? '…' : money(totalCents)}
            subline="Completed payments"
            icon={Wallet}
            color="primary"
          />
          <StatCard
            label="1:1 sessions"
            value={loading ? '…' : money(oneToOneCents)}
            subline="Meetings & individual chats"
            icon={Users}
            color="success"
          />
          <StatCard
            label="Seminars"
            value={loading ? '…' : money(seminarCents)}
            subline="Group seminar registrations"
            icon={BookOpen}
            color="warning"
          />
        </section>

        <section className="rounded-2xl border border-[#e8e6e1] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#234C6A]/10 text-[#234C6A]">
              <Receipt className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Payment history</h2>
              <p className="text-[12px] text-slate-500">
                Newest first · {loading ? '…' : `${payments.length} shown`}
              </p>
            </div>
          </div>

          <PaymentHistoryTable payments={payments} loading={loading} error={error} flush />
        </section>
      </div>
    </div>
  );
}
