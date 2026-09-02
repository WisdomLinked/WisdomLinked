/**
 * Fills in balanceTransaction (and any missing receipt fields) on payment rows written
 * before those columns existed. Reads from Stripe by payment intent and never writes
 * anything to Stripe, so it is safe to re-run.
 *
 *   npx tsx scripts/backfillBalanceTransactions.ts            # report only
 *   npx tsx scripts/backfillBalanceTransactions.ts --apply    # write the values
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PaymentHistory = require('../models/PaymentHistory');
const { balanceTransactionId } = require('../utils/bookingPrice');

const APPLY = process.argv.includes('--apply');

const stripeFor = (mode: string) =>
    require('stripe')(mode === 'live' ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST);

const run = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');
    await mongoose.connect(uri);

    const rows = await PaymentHistory.find({
        paymentType: 'charge',
        paymentIntent: { $type: 'string', $ne: '' },
        $or: [{ balanceTransaction: null }, { balanceTransaction: { $exists: false } }],
    }).select('paymentIntent stripeMode status receiptUrl receiptNumber');

    console.log(`${rows.length} charge rows without a balance transaction`);

    let filled = 0;
    let unsettled = 0;
    let failed = 0;

    for (const row of rows) {
        const mode = row.stripeMode === 'live' ? 'live' : 'test';
        try {
            const intent = await stripeFor(mode).paymentIntents.retrieve(String(row.paymentIntent), {
                expand: ['latest_charge'],
            });
            const charge = intent?.latest_charge && typeof intent.latest_charge === 'object'
                ? intent.latest_charge
                : null;
            const txn = balanceTransactionId(charge);

            if (!txn) {
                // Held or still clearing: there is no ledger entry to record yet.
                unsettled += 1;
                continue;
            }

            const update: any = { balanceTransaction: txn };
            if (!row.receiptUrl && charge?.receipt_url) update.receiptUrl = charge.receipt_url;
            if (!row.receiptNumber && charge?.receipt_number) update.receiptNumber = charge.receipt_number;

            if (APPLY) await PaymentHistory.updateOne({ _id: row._id }, { $set: update });
            filled += 1;
            console.log(`  ${APPLY ? 'set' : 'would set'} ${row.paymentIntent} -> ${txn}`);
        } catch (err: any) {
            failed += 1;
            console.log(`  SKIP ${row.paymentIntent} (${mode}): ${err?.message}`);
        }
    }

    console.log(
        `\n${APPLY ? 'updated' : 'would update'}: ${filled}   not settled yet: ${unsettled}   unreadable: ${failed}`,
    );
    if (!APPLY && filled) console.log('Re-run with --apply to write these.');

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error(err?.message || err);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
