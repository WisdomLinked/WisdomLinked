/**
 * Ledger shape for refunds:
 *   charge  paymentType=charge  amount=original  status=completed|partially_refunded|refunded
 *   refund  paymentType=refund  amount=refunded  stripeRefundId=re_…  same paymentIntent
 *
 * Never convert a charge row into a refund or rewrite its amount/date.
 */
const PaymentHistory = require('../models/PaymentHistory');

export type StripeRefundLike = {
  id?: string | null;
  amount?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
};

function refundCents(refund: StripeRefundLike, fallbackCents?: number): number {
  if (typeof refund.amount === 'number' && Number.isFinite(refund.amount)) return Math.max(0, Math.round(refund.amount));
  if (typeof fallbackCents === 'number' && Number.isFinite(fallbackCents)) return Math.max(0, Math.round(fallbackCents));
  return 0;
}

export function chargeStatusAfterRefunds(originalCents: number, refundedCents: number): 'completed' | 'partially_refunded' | 'refunded' {
  if (refundedCents <= 0) return 'completed';
  if (refundedCents >= Math.max(0, originalCents)) return 'refunded';
  return 'partially_refunded';
}

async function refundedCentsForIntent(paymentIntent: string): Promise<number> {
  const rows = await PaymentHistory.find({
    paymentIntent: String(paymentIntent),
    paymentType: 'refund',
  }).select('amount').lean();
  return rows.reduce((sum: number, row: any) => sum + (typeof row?.amount === 'number' ? row.amount : 0), 0);
}

/**
 * Insert (or reuse) a refund ledger row keyed by Stripe refund id, then mark the
 * original charge refunded / partially refunded without changing its amount.
 */
export async function recordChargeRefund(args: {
  charge: any;
  refund: StripeRefundLike;
  description?: string;
  amountCents?: number;
  receiptUrl?: string | null;
}): Promise<{ created: boolean; refundRow: any; chargeStatus: string }> {
  const charge = args.charge;
  if (!charge?._id) throw new Error('recordChargeRefund requires a charge row');
  const paymentIntent = String(args.refund.payment_intent || charge.paymentIntent || '');
  if (!paymentIntent) throw new Error('recordChargeRefund requires a payment intent');
  const stripeRefundId = String(args.refund.id || '').trim();
  if (!stripeRefundId) throw new Error('recordChargeRefund requires a Stripe refund id');

  const amount = refundCents(args.refund, args.amountCents);
  let created = false;
  let refundRow = await PaymentHistory.findOne({ stripeRefundId });
  if (!refundRow) {
    refundRow = await PaymentHistory.create({
      stripeMode: charge.stripeMode || 'test',
      paymentType: 'refund',
      amount,
      currency: args.refund.currency || charge.currency || 'usd',
      description: args.description || charge.description || 'Refund',
      paymentIntent,
      stripeRefundId,
      status: 'refunded',
      customer: charge.customer,
      expert: charge.expert,
      pendingAppointmentToGroup: charge.pendingAppointmentToGroup,
      groupChat: charge.groupChat,
      event: charge.event,
    });
    created = true;
  }

  // Sum other refund rows + this one so status is correct even when the just-written
  // row is not yet visible to a subsequent find (and so partial refunds stack).
  const otherRows = await PaymentHistory.find({
    paymentIntent: String(paymentIntent),
    paymentType: 'refund',
    stripeRefundId: { $ne: stripeRefundId },
  }).select('amount').lean();
  const othersCents = (otherRows || []).reduce(
    (sum: number, row: any) => sum + (typeof row?.amount === 'number' ? row.amount : 0),
    0,
  );
  const totalRefunded = othersCents + amount;
  const originalCents = typeof charge.amount === 'number' ? charge.amount : 0;
  const chargeStatus = chargeStatusAfterRefunds(originalCents, totalRefunded);
  const chargeUpdate: Record<string, unknown> = { status: chargeStatus };
  if (args.receiptUrl && !charge.receiptUrl) chargeUpdate.receiptUrl = args.receiptUrl;
  await PaymentHistory.updateOne({ _id: charge._id }, { $set: chargeUpdate });

  return { created, refundRow, chargeStatus };
}

export async function syncChargeRefundStatus(charge: any): Promise<string> {
  const paymentIntent = String(charge?.paymentIntent || '');
  if (!paymentIntent || !charge?._id) return String(charge?.status || 'completed');
  const totalRefunded = await refundedCentsForIntent(paymentIntent);
  const originalCents = typeof charge.amount === 'number' ? charge.amount : 0;
  const chargeStatus = chargeStatusAfterRefunds(originalCents, totalRefunded);
  if (charge.status !== chargeStatus) {
    await PaymentHistory.updateOne({ _id: charge._id }, { $set: { status: chargeStatus } });
  }
  return chargeStatus;
}
