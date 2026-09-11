/**
 * One-shot repair for Expert Revenue ledger rows created by the old processRefund
 * path, which flipped the original charge to status "refunded" on a full refund.
 *
 * New shape (kept for display):
 *   charge  status=completed  +$X
 *   refund  status=refunded   −$X
 *   same paymentIntent on both rows
 *
 * This script finds charge rows with status "refunded" that already have at least
 * one paymentType=refund row on the same paymentIntent, and sets the charge back
 * to "completed". Safe to re-run.
 *
 *   npx tsx scripts/fixRefundedChargeStatus.ts            # report only
 *   npx tsx scripts/fixRefundedChargeStatus.ts --apply    # write the values
 *
 * Do not SSH/run against prod from an agent unless explicitly approved.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PaymentHistory = require('../models/PaymentHistory');

const APPLY = process.argv.includes('--apply');

const run = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');
    await mongoose.connect(uri);

    const refundedCharges = await PaymentHistory.find({
        paymentType: { $ne: 'refund' },
        status: 'refunded',
        paymentIntent: { $type: 'string', $ne: '' },
    }).select('_id paymentIntent amount status paymentType');

    console.log(`${refundedCharges.length} charge rows with status=refunded`);

    let wouldFix = 0;
    let skippedNoRefundRow = 0;

    for (const charge of refundedCharges) {
        const refundCount = await PaymentHistory.countDocuments({
            paymentIntent: charge.paymentIntent,
            paymentType: 'refund',
        });
        if (refundCount < 1) {
            skippedNoRefundRow += 1;
            continue;
        }
        wouldFix += 1;
        console.log(
            `${APPLY ? 'FIX' : 'DRY'} ${charge._id} pi=${charge.paymentIntent} ` +
                `amount=${charge.amount} (${refundCount} refund row(s))`
        );
        if (APPLY) {
            await PaymentHistory.updateOne({ _id: charge._id }, { $set: { status: 'completed' } });
        }
    }

    console.log(
        `${APPLY ? 'Updated' : 'Would update'} ${wouldFix}; ` +
            `skipped ${skippedNoRefundRow} with no matching refund row`
    );
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
