import React from 'react';

const KEYS = ['unpaid', 'refunded', 'in_flight', 'withheld', 'paid', 'free'] as const;

export default function PaymentIntegrityCard({
  report,
  loading,
  onRefresh,
}: {
  report: any | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-2xl border border-wl-line bg-wl-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-wl-brand">Payment integrity</h3>
          <p className="mt-0.5 text-sm text-wl-muted">
            Actionable mismatches: unpaid seats, refunded-but-enrolled, and stuck pending charges.
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
        <p className="mt-4 text-sm text-wl-muted">Loading integrity report…</p>
      ) : report ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {KEYS.map(key => (
              <div key={key} className="rounded-xl border border-wl-line bg-wl-pageAlt/60 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-wl-muted">
                  {key.replace('_', ' ')}
                </div>
                <div className="text-lg font-semibold tabular-nums text-wl-ink">
                  {report.summary?.[key] ?? 0}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-wl-muted">
            Scanned {report.bookingsScanned ?? 0} paid bookings
            {report.lookbackDays ? ` (last ${report.lookbackDays} days)` : ''}
            {report.truncated ? ' — truncated' : ''}.
          </p>
          {(report.rows?.length > 0 || report.stuckPendingPayments?.length > 0) ? (
            <div className="mt-4 space-y-4">
              {report.rows?.length > 0 ? (
                <div>
                  <div className="mb-2 text-sm font-medium text-wl-ink">Booking mismatches</div>
                  <ul className="space-y-2 text-sm">
                    {report.rows.slice(0, 50).map((row: any, i: number) => (
                      <li
                        key={`${row.groupChatId}-${row.customer}-${i}`}
                        className="rounded-xl border border-wl-line bg-white px-3 py-2"
                      >
                        <span className="font-medium capitalize text-wl-ink">{row.verdict}</span>
                        {' · '}
                        <span className="text-wl-muted">{row.name || 'Session'}</span>
                        {row.customerEmail ? ` · ${row.customerEmail}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {report.stuckPendingPayments?.length > 0 ? (
                <div>
                  <div className="mb-2 text-sm font-medium text-wl-ink">Stuck pending payments (&gt;1h)</div>
                  <ul className="space-y-2 text-sm">
                    {report.stuckPendingPayments.slice(0, 30).map((row: any, i: number) => (
                      <li key={`${row.paymentIntent || i}`} className="rounded-xl border border-wl-line bg-white px-3 py-2">
                        {typeof row.amount === 'number'
                          ? `${(row.amount / 100).toFixed(2)} ${row.currency || ''}`.trim()
                          : '—'}
                        {row.paymentIntent ? ` · ${row.paymentIntent}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-green">No actionable payment mismatches found.</p>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-wl-muted">Integrity report unavailable.</p>
      )}
    </section>
  );
}
