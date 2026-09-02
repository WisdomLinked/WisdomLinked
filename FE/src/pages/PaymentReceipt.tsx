import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Printer } from 'lucide-react';
import { getPaymentReceipt } from '../api/api';

const SUPPORT_EMAIL = 'xbwang.linked@gmail.com';

export interface ReceiptData {
  id: string;
  receiptNumber?: string | null;
  status?: string;
  paymentType?: string;
  amount: number;
  currency: string;
  paidAt: string;
  description?: string;
  paymentMethod?: string;
  card?: { brand: string; last4: string } | null;
  transactionId?: string | null;
  balanceTransaction?: string | null;
  stripeReceiptUrl?: string | null;
  session: {
    name: string;
    typeLabel?: string;
    durationMinutes?: number | null;
    start?: string | null;
    timezone?: string | null;
  };
  expert?: { name: string; title?: string } | null;
  student?: { name: string; email?: string } | null;
}

export const formatMoney = (amountCents: number, currency = 'usd'): string => {
  const value = (Number(amountCents) || 0) / 100;
  const code = String(currency || 'usd').toUpperCase();
  const amount = `$${value.toFixed(2)}`;
  return code === 'USD' ? amount : `${amount} ${code}`;
};

export const formatPaidAt = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatScheduledFor = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
};

/** "1:1 Session · 45 min" — either half is dropped when we don't have it. */
export const formatSessionMeta = (typeLabel?: string, durationMinutes?: number | null): string =>
  [typeLabel, durationMinutes ? `${durationMinutes} min` : ''].filter(Boolean).join(' · ');

export const formatPaymentMethod = (
  card?: { brand: string; last4: string } | null,
  fallbackLabel?: string,
): { primary: string; secondary: string } => {
  if (card?.brand && card?.last4) {
    return { primary: card.brand.toUpperCase(), secondary: `· ${card.last4}` };
  }
  return { primary: fallbackLabel || '—', secondary: '' };
};

/**
 * Only a completed payment may be described as paid. Everything else names what
 * actually happened to the money, so the page never claims a charge that was never
 * made — a released authorization and a refund are both "not paid".
 */
const MONEY_LABELS: Record<string, { amount: string; date: string }> = {
  completed: { amount: 'Amount paid', date: 'Date paid' },
  refunded: { amount: 'Amount refunded', date: 'Date refunded' },
  pending: { amount: 'Amount pending', date: 'Date initiated' },
  withheld: { amount: 'Amount authorized', date: 'Date authorized' },
  released: { amount: 'Amount authorized', date: 'Date authorized' },
  failed: { amount: 'Amount attempted', date: 'Date attempted' },
};

export const moneyLabels = (
  status?: string,
  paymentType?: string,
): { amount: string; date: string } => {
  const labels = MONEY_LABELS[String(status || '').toLowerCase()];
  if (!labels) return { amount: 'Amount', date: 'Date' };
  if (labels === MONEY_LABELS.refunded && String(paymentType || 'charge') !== 'refund') {
    return { amount: labels.amount, date: 'Date charged' };
  }
  return labels;
};

const STATUS_NOTE: Record<string, { label: string; note: string; tone: string }> = {
  refunded: {
    label: 'Refunded',
    note: 'This payment has been refunded in full.',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  pending: {
    label: 'Payment clearing',
    note: 'This payment has not finished clearing yet. We will update this receipt once it settles.',
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  withheld: {
    label: 'Not yet charged',
    note: 'This amount is authorized on the card but has not been charged.',
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  released: {
    label: 'Authorization released',
    note: 'The authorization for this booking was released. Nothing was charged.',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  failed: {
    label: 'Payment failed',
    note: 'This payment did not go through. Nothing was charged.',
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
  },
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{children}</p>
);

const DetailRow: React.FC<{
  label: string;
  value: string;
  subValue?: string;
  last?: boolean;
}> = ({ label, value, subValue, last }) => (
  <div
    className={`flex items-start justify-between gap-6 px-4 py-3 sm:px-5 ${
      last ? '' : 'border-b border-slate-200'
    }`}
  >
    <span className="shrink-0 text-[13px] text-slate-500">{label}</span>
    <span className="min-w-0 text-right">
      <span className="block break-words text-[13px] font-bold text-slate-900 sm:text-sm">{value}</span>
      {subValue ? <span className="mt-0.5 block break-words text-xs text-slate-400">{subValue}</span> : null}
    </span>
  </div>
);

export default function PaymentReceipt() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const res: any = await getPaymentReceipt(String(paymentId || ''));
      if (cancelled) return;
      if (res?.success && res?.receipt) {
        setReceipt(res.receipt as ReceiptData);
      } else {
        setError(
          typeof res === 'string' && res
            ? res
            : res?.error || 'We could not load this receipt. Please try again from your payment history.',
        );
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading your receipt…
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Receipt unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const method = formatPaymentMethod(receipt.card, receipt.paymentMethod);
  const sessionMeta = formatSessionMeta(receipt.session?.typeLabel, receipt.session?.durationMinutes);
  const statusNote = STATUS_NOTE[String(receipt.status || '').toLowerCase()];
  const labels = moneyLabels(receipt.status, receipt.paymentType);
  const summaryLine =
    receipt.description
    || [receipt.session?.name, receipt.expert?.name].filter(Boolean).join(' — ')
    || receipt.session?.name;

  return (
    <div className="min-h-screen bg-slate-100 py-0 sm:py-6 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-2xl bg-white shadow-sm print:max-w-none print:shadow-none">
        <header className="flex items-center justify-center bg-[#12294A] px-6 py-5">
          <img src="/logos/b_w.svg" alt="WisdomLinked" className="h-8 w-auto max-w-[220px] object-contain" />
        </header>

        <main className="px-5 py-7 sm:px-9">
          <div className="relative">
            <h1 className="text-center text-xl font-bold text-slate-900 underline decoration-2 underline-offset-4 sm:text-[22px]">
              Payment Receipt
            </h1>
            <button
              type="button"
              onClick={() => window.print()}
              className="absolute right-0 top-1 hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:inline-flex print:hidden"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </button>
          </div>

          {receipt.receiptNumber ? (
            <p className="mt-1.5 text-center text-xs text-slate-400">Receipt no. {receipt.receiptNumber}</p>
          ) : null}

          {statusNote ? (
            <div className={`mt-5 rounded-xl border px-4 py-2.5 text-[13px] ${statusNote.tone}`}>
              <span className="font-semibold">{statusNote.label}.</span> {statusNote.note}
            </div>
          ) : null}

          <section className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <Label>{labels.amount}</Label>
              <p className="mt-1 text-[15px] text-slate-900">{formatMoney(receipt.amount, receipt.currency)}</p>
            </div>
            <div>
              <Label>{labels.date}</Label>
              <p className="mt-1 text-[15px] text-slate-900">{formatPaidAt(receipt.paidAt)}</p>
            </div>
            <div className="sm:text-right">
              <Label>Payment method</Label>
              <p className="mt-1 text-[15px] text-slate-900">
                <span className="font-bold">{method.primary}</span>
                {method.secondary ? <span className="text-slate-400"> {method.secondary}</span> : null}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <Label>Session details</Label>
            <div className="mt-2.5 overflow-hidden rounded-2xl bg-[#F5F5F5]">
              <DetailRow label="Session" value={receipt.session?.name || '—'} subValue={sessionMeta} />
              {receipt.expert ? (
                <DetailRow
                  label="Expert / Professor"
                  value={receipt.expert.name || '—'}
                  subValue={receipt.expert.title || undefined}
                />
              ) : null}
              {receipt.student ? (
                <DetailRow
                  label="Student"
                  value={receipt.student.name || '—'}
                  subValue={receipt.student.email || undefined}
                />
              ) : null}
              <DetailRow label="Scheduled For" value={formatScheduledFor(receipt.session?.start)} last />
            </div>
          </section>

          <section className="mt-8">
            <Label>Summary</Label>
            <div className="mt-2.5 flex items-start justify-between gap-6">
              <span className="break-words text-[13px] text-slate-700">{summaryLine}</span>
              <span className="shrink-0 text-[13px] font-bold text-slate-900">
                {formatMoney(receipt.amount, receipt.currency)}
              </span>
            </div>
          </section>

          <hr className="mt-8 border-slate-200" />

          <p className="py-5 text-center text-[13px] text-slate-600">
            If you have any questions, contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-[#234C6A] underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>

          <hr className="border-slate-200" />

          {receipt.stripeReceiptUrl ? (
            <p className="pt-5 text-center text-xs text-slate-400 print:hidden">
              <a
                href={receipt.stripeReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-600"
              >
                View the official Stripe receipt
              </a>
            </p>
          ) : null}
        </main>

        <footer className="bg-[#12294A] px-6 py-4 text-center text-[13px] font-bold text-white">
          © {new Date(receipt.paidAt).getFullYear() || new Date().getFullYear()} WisdomLinked. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
