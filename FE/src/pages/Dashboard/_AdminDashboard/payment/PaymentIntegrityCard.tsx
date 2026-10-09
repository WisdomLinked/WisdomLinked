import React from 'react';

// Same order as the Status filter below. `historyStatus` is the Status filter value a tile's
// Records number applies; Unpaid has none because an unpaid seat has no payment record.
export const INTEGRITY_TILES = [
  { key: 'paid', historyStatus: 'completed' },
  { key: 'refunded', historyStatus: 'refunded' },
  { key: 'in_flight', historyStatus: 'pending' },
  { key: 'withheld', historyStatus: 'withheld' },
  { key: 'unpaid', historyStatus: null },
] as const;

export default function PaymentIntegrityCard({
  report,
  loading,
  onRefresh,
  activeStatus,
  onSelectStatus,
}: {
  report: any | null;
  loading: boolean;
  onRefresh: () => void;
  activeStatus?: string;
  onSelectStatus?: (status: string) => void;
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
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {INTEGRITY_TILES.map(({ key, historyStatus }) => {
              const label = key.replace('_', ' ');
              const records =
                historyStatus && typeof report.recordCounts?.[historyStatus] === 'number'
                  ? report.recordCounts[historyStatus]
                  : null;
              const active = Boolean(historyStatus) && activeStatus === historyStatus;
              return (
                <div
                  key={key}
                  data-testid={`integrity-tile-${key}`}
                  className={`rounded-xl border bg-wl-pageAlt/60 px-3 py-2 text-center ${
                    active ? 'border-wl-brand' : 'border-wl-line'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-wl-muted">{label}</div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <div>
                      <div className="text-lg font-semibold tabular-nums text-wl-ink">
                        {report.summary?.[key] ?? 0}
                      </div>
                      <div className="text-[10px] text-wl-muted">Students</div>
                    </div>
                    {records !== null && historyStatus && onSelectStatus ? (
                      <button
                        type="button"
                        onClick={() => onSelectStatus(historyStatus)}
                        aria-pressed={active}
                        aria-label={`Show ${label} records in Payment History`}
                        title="Show these records in Payment History"
                        className={`rounded-lg transition-colors ${active ? 'bg-wl-brandSoft' : 'hover:bg-black/5'}`}
                      >
                        <div className="text-lg font-semibold tabular-nums text-wl-brand">
                          {records}
                        </div>
                        <div className="text-[10px] text-wl-muted">Records</div>
                      </button>
                    ) : (
                      <div>
                        <div className="text-lg font-semibold tabular-nums text-wl-ink">
                          {records ?? '—'}
                        </div>
                        <div className="text-[10px] text-wl-muted">Records</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-wl-muted">
            Scanned {report.bookingsScanned ?? 0} paid bookings
            {report.lookbackDays ? ` (last ${report.lookbackDays} days)` : ''}
            {report.truncated ? ' — truncated' : ''}. Records count every payment with that
            status; click one to filter Payment History.
          </p>
          {(report.rows?.length > 0 || report.stuckPendingPayments?.length > 0) ? (
            <div className="mt-4 max-h-80 overflow-y-auto overscroll-contain pr-1 space-y-4">
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
