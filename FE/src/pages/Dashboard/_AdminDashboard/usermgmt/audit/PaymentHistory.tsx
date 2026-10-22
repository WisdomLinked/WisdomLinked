import React from 'react';
import { format } from 'date-fns';
import Pagination from '../../../../../components/Pagination';
import EmptyState from './EmptyState';
import { AUDIT_PILL } from './auditUi';
import {
  formatUsdFromCents,
  paidByLabel,
  parseDate,
  paymentDescription,
  paymentDisplayStatus,
  paymentToneClass,
  paymentTransactionId,
  type PaymentSummary,
} from './auditModel';
import type { PaymentHistoryRow } from '../../payment/paymentHistoryUtils';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-audit-line bg-audit-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-audit-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-audit-ink">{value}</div>
    </div>
  );
}

function StatusPill({ row }: { row: PaymentHistoryRow }) {
  const status = paymentDisplayStatus(row);
  return <span className={`${AUDIT_PILL} ${paymentToneClass(status.tone)}`}>{status.label}</span>;
}

function PaymentCard({ row }: { row: PaymentHistoryRow }) {
  const when = parseDate(row.createdAt);
  return (
    <article className="space-y-2 rounded-xl border border-audit-line bg-audit-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-audit-ink">{paymentDescription(row)}</p>
          <p className="truncate text-xs text-audit-muted">{paymentTransactionId(row) || 'No transaction id'}</p>
        </div>
        <StatusPill row={row} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-audit-muted">Date</dt>
          <dd className="tabular-nums text-audit-ink">{when ? format(when, 'MMM d, yyyy') : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-audit-muted">Paid by</dt>
          <dd className="truncate text-audit-ink">{paidByLabel(row)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-audit-muted">Amount</dt>
          <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(row.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-audit-muted">Fee</dt>
          <dd className="tabular-nums text-audit-ink">—</dd>
        </div>
      </dl>
    </article>
  );
}

export default function PaymentHistory({
  rows,
  summary,
  totalCount,
  currentPage,
  pageSize,
  onPage,
  onPageSize,
  loading,
}: {
  rows: PaymentHistoryRow[];
  summary: PaymentSummary;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  loading: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Gross earnings" value={formatUsdFromCents(summary.gross)} />
        <Tile label="Platform fees" value={formatUsdFromCents(summary.fees)} />
        <Tile label="Paid out" value={formatUsdFromCents(summary.paidOut)} />
        <Tile label="Pending payout" value={formatUsdFromCents(summary.pending)} />
      </div>

      {loading && rows.length === 0 ? (
        <EmptyState title="Loading payments" />
      ) : rows.length === 0 ? (
        <EmptyState title="No payments yet" description="This account has no payment history to show." />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-audit-line text-xs uppercase tracking-wider text-audit-muted">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Paid by</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Fee</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const when = parseDate(row.createdAt);
                  return (
                    <tr key={row._id || paymentTransactionId(row)} className="border-b border-audit-line">
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                        {when ? format(when, 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="max-w-[240px] px-3 py-3">
                        <p className="truncate text-audit-ink">{paymentDescription(row)}</p>
                        <p className="truncate text-xs text-audit-muted">{paymentTransactionId(row) || '—'}</p>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-3 text-audit-ink">{paidByLabel(row)}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                        {formatUsdFromCents(row.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-muted">—</td>
                      <td className="px-3 py-3">
                        <StatusPill row={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map(row => (
              <PaymentCard key={row._id || paymentTransactionId(row)} row={row} />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalCount={Math.max(0, totalCount)}
            pageSize={Number(pageSize)}
            onPage={onPage}
            onPageSize={onPageSize}
          />
        </>
      )}
    </div>
  );
}
