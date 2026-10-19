import React from 'react';

function money(cents: unknown, currency?: string) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'A payment';
  const dollars = (amount / 100).toFixed(2);
  return currency ? `${dollars} ${currency}` : dollars;
}

function seatProblem(row: any): string {
  const who = row.customerEmail || 'This person';
  const session = row.name || 'a paid session';
  if (row.verdict === 'refunded') {
    return `${who} is still on “${session}” after that payment was refunded. Remove them from the session, or take payment again.`;
  }
  if (row.verdict === 'unpaid') {
    return `${who} is on “${session}” and there is no payment for it.`;
  }
  return `${who} is on “${session}” and the payment does not match the seat.`;
}

export default function PaymentIntegrityCard({
  report,
  loading,
  onRefresh,
}: {
  report: any | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const problems = Array.isArray(report?.rows) ? report.rows : [];
  const stuck = Array.isArray(report?.stuckPendingPayments) ? report.stuckPendingPayments : [];
  const empty = problems.length === 0 && stuck.length === 0;

  return (
    <section className="rounded-2xl border border-wl-line bg-wl-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-wl-brand">Seats to check</h3>
          <p className="mt-0.5 text-sm text-wl-muted">
            A person is still on a paid session, and the payment does not match.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="h-9 rounded-full border border-wl-line bg-white px-4 text-sm font-medium text-wl-brand hover:bg-wl-brandSoft disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && !report ? (
        <p className="mt-4 text-sm text-wl-muted">Loading…</p>
      ) : report ? (
        empty ? (
          <p className="mt-4 text-sm text-green">
            Nothing to fix. Every paid seat from the last {report.lookbackDays || 120} days has a matching payment.
          </p>
        ) : (
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1 text-sm">
            {problems.slice(0, 50).map((row: any, i: number) => (
              <li
                key={`${row.groupChatId}-${row.customer}-${i}`}
                className="rounded-xl border border-wl-line bg-white px-3 py-2 text-wl-ink"
              >
                {seatProblem(row)}
              </li>
            ))}
            {stuck.slice(0, 30).map((row: any, i: number) => (
              <li
                key={`${row.paymentIntent || i}`}
                className="rounded-xl border border-wl-line bg-white px-3 py-2 text-wl-ink"
              >
                This payment has been waiting more than an hour
                {row.amount != null ? `: ${money(row.amount, row.currency)}` : ''}.
                {row.paymentIntent ? ` ${row.paymentIntent}` : ''}
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-4 text-sm text-wl-muted">This list could not be loaded.</p>
      )}
    </section>
  );
}
