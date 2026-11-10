import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PaymentHistoryRow } from '../../../pages/Dashboard/_AdminDashboard/payment/paymentHistoryUtils';
import {
  formatMoney,
  isValidRecordDate,
  paymentBookingStart,
  statusLabel,
  stripRefundPrefix,
} from '../../../utils/adminSnapshotDisplay';
import { CopyIntent, DateCell, Field, Section, StatusPill } from './RecordAtoms';
import type { RecordHeader } from './RecordDetailPanel';

export type PaymentRow = {
  kind: 'payment';
  id: string;
  userLabel: string;
  userMissing: boolean;
  amount?: number;
  currency?: string;
  createdAt?: string;
  status?: string;
  description?: string;
  paymentType?: string;
  bookingStart?: unknown;
  groupName?: string;
  groupType?: string;
  groupStatus?: string;
  eventTitle?: string;
  raw: PaymentHistoryRow;
};

export function paymentUser(row: PaymentHistoryRow): { label: string; missing: boolean; email?: string } {
  const customerName = row.customer?.username || row.customer?.email;
  const expertName = row.expert?.username || row.expert?.email;
  const email = row.customer?.email || row.expert?.email || undefined;
  if (customerName && expertName) return { label: `${customerName} → ${expertName}`, missing: false, email };
  if (customerName || expertName) return { label: customerName || expertName || '', missing: false, email };
  return { label: 'Unknown user', missing: true };
}

export function toPaymentRow(row: PaymentHistoryRow): PaymentRow {
  const user = paymentUser(row);
  const event = row.event && typeof row.event === 'object' ? row.event : null;
  return {
    kind: 'payment',
    id: String(row._id || ''),
    userLabel: user.label,
    userMissing: user.missing,
    amount: row.amount,
    currency: row.currency,
    createdAt: row.createdAt,
    status: row.status,
    description: row.description,
    paymentType: row.paymentType,
    bookingStart: paymentBookingStart(row),
    groupName: row.groupChat?.name,
    groupType: row.groupChat?.type,
    groupStatus: row.groupChat?.status,
    eventTitle: event?.title,
    raw: row,
  };
}

export function paymentHeader(row: PaymentRow): RecordHeader {
  const subtitle = formatMoney(row.amount, row.currency) || undefined;
  if (row.userMissing) return { title: 'Unknown user', subtitle, unknownUser: true };
  return { title: row.userLabel, subtitle, unknownUser: false };
}

/** What kind of booking a payment is for, in plain words. */
export function bookingKindLabel(groupType?: string): string {
  if (groupType === 'seminar') return 'Seminar';
  if (groupType === 'individual') return '1:1 session';
  if (groupType === 'community') return 'Community';
  return statusLabel(groupType);
}

export function PaymentDetailFields({
  row,
  variant,
  statusPill = status => <StatusPill status={status} />,
  showLiveMode = false,
}: {
  row: PaymentRow;
  /** A refund row reads as a refund: Reason, Refunded, no booking section. */
  variant: 'payment' | 'refund';
  statusPill?: (status: string) => React.ReactNode;
  /** Payments page: tag live rows too, not only test rows. */
  showLiveMode?: boolean;
}) {
  const refund = variant === 'refund';
  const reason = stripRefundPrefix(row.description);
  const hasBooking = !refund && Boolean(row.groupName || row.eventTitle || row.bookingStart);
  const intent = String(row.raw.paymentIntent || '').trim();
  const receiptUrl = String(row.raw.receiptUrl || '').trim();
  const studentEmail = row.raw.customer?.email || '';
  const expertEmail = row.raw.expert?.email || '';
  const stripeMode = String(row.raw.stripeMode || '').toLowerCase();
  const showMode = stripeMode === 'test' || (showLiveMode && stripeMode === 'live');
  return (
    <div className="space-y-5">
      {refund && row.userMissing ? (
        <div className="flex gap-2 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            No account is linked to this refund. It was recorded from Stripe without a matching user.
            Check the charge in Stripe using the payment intent below.
          </p>
        </div>
      ) : row.userMissing ? (
        <p className="text-xs text-amber-800">No account is linked to this record.</p>
      ) : null}
      <Section title={refund ? 'Refund' : 'Charge'}>
        {!row.userMissing ? <Field label="User" value={row.userLabel} /> : null}
        {studentEmail ? <Field label={expertEmail ? 'Student email' : 'Email'} value={studentEmail} /> : null}
        {expertEmail ? <Field label={studentEmail ? 'Expert email' : 'Email'} value={expertEmail} /> : null}
        {row.paymentType ? (
          <Field
            label="Type"
            value={
              <span className="inline-flex items-center gap-2">
                {statusLabel(row.paymentType)}
                {showMode ? (
                  <span className="rounded-full bg-wl-brandSoft px-2 py-0.5 text-[11px] font-medium text-wl-brand">
                    {stripeMode} · {row.paymentType || 'charge'}
                  </span>
                ) : null}
              </span>
            }
          />
        ) : null}
        {row.status ? <Field label="Status" value={statusPill(row.status)} /> : null}
        <Field label="Amount" value={formatMoney(row.amount, row.currency) || '—'} />
        {reason ? <Field label={refund ? 'Reason' : 'Description'} value={reason} wide /> : null}
        <Field label={refund ? 'Refunded' : 'Date'} value={<DateCell value={row.createdAt} />} />
        {intent ? <Field label="Payment intent" value={<CopyIntent value={intent} />} /> : null}
        {receiptUrl ? (
          <Field
            label="Receipt"
            value={
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-wl-brand hover:underline">
                Open receipt
              </a>
            }
          />
        ) : null}
      </Section>
      {!isValidRecordDate(row.createdAt) ? <p className="text-xs text-amber-800">No date is set for this record.</p> : null}
      {hasBooking ? (
        <Section title="Booking">
          {row.groupName ? <Field label="Session" value={row.groupName} /> : null}
          {row.groupType ? <Field label="Kind" value={bookingKindLabel(row.groupType)} /> : null}
          {row.groupStatus ? <Field label="Session status" value={<StatusPill status={row.groupStatus} />} /> : null}
          {row.eventTitle ? <Field label="Event" value={row.eventTitle} /> : null}
          {row.bookingStart ? <Field label="Booking start" value={<DateCell value={row.bookingStart} />} /> : null}
        </Section>
      ) : null}
    </div>
  );
}
