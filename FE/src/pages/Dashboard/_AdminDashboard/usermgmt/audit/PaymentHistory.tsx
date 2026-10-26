import React from 'react';
import { format } from 'date-fns';
import Pagination from '../../../../../components/Pagination';
import EmptyState from './EmptyState';
import { AUDIT_PILL } from './auditUi';
import {
  explainPaymentRow,
  formatUsdFromCents,
  paidByLabel,
  parseDate,
  paymentDescription,
  paymentDisplayStatus,
  paymentToneClass,
  paymentTransactionId,
  DEFAULT_AUDIT_RATES,
  type AuditCheque,
  type AuditCommissionRates,
  type PaymentSummary,
} from './auditModel';
import type { PaymentHistoryRow } from '../../payment/paymentHistoryUtils';

const UTC_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function payrollMonthLabel(year?: number, month?: number): string {
  const name = month ? UTC_MONTHS[month - 1] : '';
  if (!name || typeof year !== 'number' || !Number.isFinite(year)) return '—';
  return `${name} ${year}`;
}

function formatChequeDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), 'MMM d, yyyy');
}

function chequeSort(a: AuditCheque, b: AuditCheque): number {
  if (Number(b.year) !== Number(a.year)) return Number(b.year) - Number(a.year);
  if (Number(b.month) !== Number(a.month)) return Number(b.month) - Number(a.month);
  return (parseDate(b.chequeDate)?.getTime() ?? 0) - (parseDate(a.chequeDate)?.getTime() ?? 0);
}

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

function PaymentCard({ row, expert, rates }: { row: PaymentHistoryRow; expert: boolean; rates: AuditCommissionRates }) {
  const when = parseDate(row.createdAt);
  const money = explainPaymentRow(row, rates);
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
        {expert ? (
          <>
            <div>
              <dt className="text-xs uppercase tracking-wider text-audit-muted">Amount</dt>
              <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(money.advertisedCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-audit-muted">Fee</dt>
              <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(money.commissionCents)}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-xs uppercase tracking-wider text-audit-muted">Price</dt>
              <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(money.advertisedCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-audit-muted">Platform fee</dt>
              <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(money.platformFeeCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-audit-muted">Tax</dt>
              <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(money.taxCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-audit-muted">Amount</dt>
              <dd className="tabular-nums text-audit-ink">{formatUsdFromCents(money.paidCents)}</dd>
            </div>
          </>
        )}
      </dl>
    </article>
  );
}

export default function PaymentHistory({
  rows,
  summary,
  cheques = [],
  rates = DEFAULT_AUDIT_RATES,
  totalCount,
  currentPage,
  pageSize,
  onPage,
  onPageSize,
  loading,
}: {
  rows: PaymentHistoryRow[];
  summary: PaymentSummary;
  cheques?: AuditCheque[];
  rates?: AuditCommissionRates;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  loading: boolean;
}) {
  const expert = summary.role === 'expert';
  const paidCheques = expert ? [...cheques].sort(chequeSort) : [];
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pt-4">
      <div className={`grid grid-cols-2 gap-3 ${expert ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
        {expert ? (
          <>
            <Tile label="Gross earnings" value={formatUsdFromCents(summary.gross)} />
            <Tile label="Platform fees" value={formatUsdFromCents(summary.fees)} />
            <Tile label="Paid out" value={formatUsdFromCents(summary.paidOut)} />
            <Tile label="Ready to pay" value={formatUsdFromCents(summary.readyToPay)} />
            <Tile label="Pending payout" value={formatUsdFromCents(summary.pending)} />
          </>
        ) : (
          <>
            <Tile label="Price collected" value={formatUsdFromCents(summary.priceCollected)} />
            <Tile label="Platform fees" value={formatUsdFromCents(summary.fees)} />
            <Tile label="Tax" value={formatUsdFromCents(summary.tax)} />
          </>
        )}
      </div>

      {paidCheques.length > 0 ? (
        <section aria-label="Paid out cheques">
          <h3 className="mb-2 text-sm font-semibold text-audit-ink">Paid out</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-audit-line text-xs uppercase tracking-wider text-audit-muted">
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Cheque number</th>
                  <th className="px-3 py-2 font-medium">Cheque date</th>
                </tr>
              </thead>
              <tbody>
                {paidCheques.map(cheque => (
                  <tr key={`${cheque.year}-${cheque.month}-${cheque.chequeNumber || ''}`} className="border-b border-audit-line">
                    <td className="whitespace-nowrap px-3 py-3 text-audit-ink">
                      {payrollMonthLabel(cheque.year, cheque.month)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                      {formatUsdFromCents(cheque.amountCents)}
                    </td>
                    <td className="px-3 py-3 text-audit-ink">{cheque.chequeNumber || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                      {formatChequeDate(cheque.chequeDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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
                  {expert ? (
                    <>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Fee</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Platform fee</th>
                      <th className="px-3 py-2 font-medium">Tax</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                    </>
                  )}
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const when = parseDate(row.createdAt);
                  const money = explainPaymentRow(row, rates);
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
                      {expert ? (
                        <>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                            {formatUsdFromCents(money.advertisedCents)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                            {formatUsdFromCents(money.commissionCents)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                            {formatUsdFromCents(money.advertisedCents)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                            {formatUsdFromCents(money.platformFeeCents)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                            {formatUsdFromCents(money.taxCents)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-audit-ink">
                            {formatUsdFromCents(money.paidCents)}
                          </td>
                        </>
                      )}
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
              <PaymentCard key={row._id || paymentTransactionId(row)} row={row} expert={expert} rates={rates} />
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
