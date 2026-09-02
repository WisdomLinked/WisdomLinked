import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StripeReference from '../../../components/dashboard/StripeReference';
import { Wallet, Users, BookOpen, Receipt, RefreshCw } from 'lucide-react';
import { doGetExpertPaymentHistory } from '../../../api/api';
import StatCard from '../../../components/ui/StatCard';

const ZERO_DECIMAL = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

function stripeToMajor(amount: number, currency: string) {
  const c = (currency || 'usd').toLowerCase();
  if (ZERO_DECIMAL.has(c)) return amount;
  return amount / 100;
}

function formatMoney(amount: number | undefined, currency: string | undefined) {
  const amt = typeof amount === 'number' ? amount : 0;
  const cur = (currency || 'usd').toUpperCase();
  const major = stripeToMajor(amt, cur);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: ZERO_DECIMAL.has(cur.toLowerCase()) ? 0 : 2,
    maximumFractionDigits: ZERO_DECIMAL.has(cur.toLowerCase()) ? 0 : 2,
  }).format(major);
}

type PaymentKind = 'seminar' | 'individual' | 'other';

type PaymentRow = {
  _id: string;
  amount?: number;
  currency?: string;
  description?: string;
  status?: string;
  paymentIntent?: string;
  balanceTransaction?: string;
  paymentKind?: PaymentKind;
  createdAt?: string;
  customer?: { username?: string; email?: string };
  groupChat?: { name?: string; type?: string };
  event?: { title?: string };
};

type Summary = {
  totalReceivedCents: number;
  individualSessionsCents: number;
  seminarsCents: number;
  otherCents: number;
};

type DateFilter = 'all' | 'today' | 'last7' | 'last30';

const kindLabel = (k: PaymentKind | undefined) => {
  if (k === 'seminar') return 'Seminar';
  if (k === 'individual') return '1:1 session';
  return 'Other';
};

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  withheld: 'bg-amber-50 text-amber-900 border-amber-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-100',
  failed: 'bg-red-50 text-red-800 border-red-100',
  released: 'bg-slate-100 text-slate-600 border-slate-200',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ExpertRevenue() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'seminar'>(
    'all',
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await doGetExpertPaymentHistory();
    if (data && data !== false && Array.isArray(data.result)) {
      setRows(data.result);
      setSummary(data.summary || null);
    } else {
      setRows([]);
      setSummary(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isInsideDateFilter = useCallback((createdAt?: string) => {
    if (dateFilter === 'all') return true;
    if (!createdAt) return false;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return false;

    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return created >= start;
    }
    const days = dateFilter === 'last7' ? 7 : 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return created >= start;
  }, [dateFilter]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const typeOk =
        typeFilter === 'all'
          ? true
          : typeFilter === 'seminar'
            ? r.paymentKind === 'seminar'
            : r.paymentKind === 'individual';
      const dateOk = isInsideDateFilter(r.createdAt);
      return typeOk && dateOk;
    });
  }, [rows, typeFilter, isInsideDateFilter]);

  const primaryCurrency = useMemo(() => {
    const first = rows.find((r) => r.currency);
    return (first?.currency || 'usd').toUpperCase();
  }, [rows]);

  const totalDisplay = summary
    ? formatMoney(summary.totalReceivedCents, primaryCurrency)
    : '—';
  const individualDisplay = summary
    ? formatMoney(summary.individualSessionsCents, primaryCurrency)
    : '—';
  const seminarDisplay = summary
    ? formatMoney(summary.seminarsCents, primaryCurrency)
    : '—';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F5F3EF] px-5 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-900 md:text-3xl">
              Revenue
            </h1>
            <p className="mt-1 max-w-xl text-[14px] text-slate-600">
              Payments received from students for 1:1 sessions and seminars. Amounts
              reflect successful charges; history includes descriptions and payer
              where available.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e8e6e1] bg-white px-4 py-2 text-[13px] font-semibold text-[#234C6A] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Refresh
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Total received"
            value={loading ? '…' : totalDisplay}
            subline="Completed payments"
            icon={Wallet}
            color="primary"
            tooltip="Sum of all completed charges in your history"
          />
          <StatCard
            label="1:1 sessions"
            value={loading ? '…' : individualDisplay}
            subline="Meetings & individual chats"
            icon={Users}
            color="success"
          />
          <StatCard
            label="Seminars"
            value={loading ? '…' : seminarDisplay}
            subline="Group seminar registrations"
            icon={BookOpen}
            color="warning"
          />
        </section>

        <section className="rounded-2xl border border-[#e8e6e1] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] md:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#234C6A]/10 text-[#234C6A]">
                <Receipt className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  Payment history
                </h2>
                <p className="text-[12px] text-slate-500">
                  Newest first · {filteredRows.length} shown
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="inline-flex rounded-full bg-slate-100 p-0.5">
                {(
                  [
                    ['all', 'All dates'],
                    ['today', 'Today'],
                    ['last7', 'Last 7 days'],
                    ['last30', 'Last 30 days'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDateFilter(key)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition ${
                      dateFilter === key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-full bg-slate-100 p-0.5">
                {(
                  [
                    ['all', 'All sessions'],
                    ['individual', '1:1'],
                    ['seminar', 'Seminars'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTypeFilter(key)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full transition ${
                      typeFilter === key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[13px] text-slate-500">
              Loading payment history…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-14 text-center">
              <p className="text-[14px] font-medium text-slate-700">
                No payments in this view yet
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                Completed Stripe charges will appear here with type and description.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[13px]">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[19%]" />
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Type</th>
                    <th className="pb-3 pr-4 font-semibold">Description</th>
                    <th className="pb-3 pr-4 font-semibold">From</th>
                    <th className="pb-3 pr-4 font-semibold">Transaction ID</th>
                    <th className="pb-3 pr-4 font-semibold">Balance transaction</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {filteredRows.map((r) => {
                    const desc =
                      r.description ||
                      r.groupChat?.name ||
                      r.event?.title ||
                      '—';
                    const payer =
                      r.customer?.username ||
                      r.customer?.email ||
                      '—';
                    const dateStr = r.createdAt
                      ? new Date(r.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—';
                    const st = (r.status || 'completed').toLowerCase();
                    const badgeClass =
                      statusStyles[st] ||
                      'bg-slate-50 text-slate-700 border-slate-100';

                    return (
                      <tr
                        key={r._id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-3 pr-4 align-top text-slate-600">
                          {dateStr}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-[#234C6A]/8 px-2.5 py-0.5 text-[11px] font-semibold text-[#234C6A]">
                            {kindLabel(r.paymentKind)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className="block break-words text-slate-800" title={desc}>
                            {desc}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top break-words text-slate-600">
                          {payer}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <StripeReference value={r.paymentIntent} />
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <StripeReference value={r.balanceTransaction} />
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${badgeClass}`}
                          >
                            {st}
                          </span>
                        </td>
                        <td className="py-3 text-right align-top font-semibold tabular-nums text-slate-900">
                          {formatMoney(r.amount, r.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
