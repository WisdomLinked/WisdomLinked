/**
 * Fixes charge rows created by backfillRefundLedger Pass B that kept a refund
 * description and/or the backfill run's createdAt instead of Stripe's charge date.
 *
 *   npx tsx scripts/fixBackfillChargeMetadata.ts            # dry run
 *   npx tsx scripts/fixBackfillChargeMetadata.ts --apply     # write
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PaymentHistory = require('../models/PaymentHistory');

const APPLY = process.argv.includes('--apply');
const ONLY_LIVE = process.argv.includes('--live');
const ONLY_TEST = process.argv.includes('--test');

const stripeFor = (mode: string) =>
    require('stripe')(mode === 'live' ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST);

function looksLikeRefundDescription(desc: unknown): boolean {
    const s = String(desc || '').trim();
    if (!s) return false;
    return /^refund\b/i.test(s) || /recorded from/i.test(s) || /backfill from stripe/i.test(s);
}

function paymentDescriptionFromStripe(intent: any, charge: any): string {
    const fromIntent = String(intent?.description || '').trim();
    if (fromIntent && !/^refund\b/i.test(fromIntent)) return fromIntent;
    const fromCharge = String(charge?.description || '').trim();
    if (fromCharge && !/^refund\b/i.test(fromCharge)) return fromCharge;
    return 'Payment';
}

const run = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');
    await mongoose.connect(uri);

    const modeFilter: Record<string, unknown> = {};
    if (ONLY_LIVE && !ONLY_TEST) modeFilter.stripeMode = 'live';
    if (ONLY_TEST && !ONLY_LIVE) modeFilter.stripeMode = 'test';

    const charges = await PaymentHistory.find({
        paymentType: { $ne: 'refund' },
        paymentIntent: { $type: 'string', $ne: '' },
        ...modeFilter,
    }).select('_id paymentIntent stripeMode description createdAt amount status');

    console.log(`${charges.length} charge rows to inspect`);

    let wouldFix = 0;
    let failed = 0;

    for (const row of charges) {
        const mode = row.stripeMode === 'live' ? 'live' : 'test';
        const pi = String(row.paymentIntent);
        try {
            const intent = await stripeFor(mode).paymentIntents.retrieve(pi, {
                expand: ['latest_charge'],
            });
            const stripeCharge =
                intent?.latest_charge && typeof intent.latest_charge === 'object'
                    ? intent.latest_charge
                    : null;
            const stripeCreatedMs = stripeCharge?.created
                ? Number(stripeCharge.created) * 1000
                : intent?.created
                    ? Number(intent.created) * 1000
                    : NaN;
            if (!Number.isFinite(stripeCreatedMs)) {
                failed += 1;
                console.log(`  SKIP ${pi}: no Stripe created timestamp`);
                continue;
            }

            const stripeCreated = new Date(stripeCreatedMs);
            const localCreated = row.createdAt ? new Date(row.createdAt) : null;
            const dateSkewMs = localCreated
                ? Math.abs(localCreated.getTime() - stripeCreated.getTime())
                : Infinity;
            const dateWrong = dateSkewMs > 60_000;
            const descWrong = looksLikeRefundDescription(row.description);
            if (!dateWrong && !descWrong) continue;

            const nextDesc = descWrong
                ? paymentDescriptionFromStripe(intent, stripeCharge)
                : row.description;

            wouldFix += 1;
            console.log(
                `  ${APPLY ? 'FIX' : 'DRY'} ${row._id} ${pi}` +
                    (dateWrong
                        ? ` createdAt ${localCreated?.toISOString() || '?'} -> ${stripeCreated.toISOString()}`
                        : '') +
                    (descWrong
                        ? ` desc ${JSON.stringify(String(row.description || '').slice(0, 60))} -> ${JSON.stringify(nextDesc)}`
                        : ''),
            );

            if (APPLY) {
                const $set: Record<string, unknown> = {};
                if (dateWrong) $set.createdAt = stripeCreated;
                if (descWrong) $set.description = nextDesc;
                await PaymentHistory.collection.updateOne({ _id: row._id }, { $set });
            }
        } catch (err: any) {
            failed += 1;
            console.log(`  SKIP ${pi} (${mode}): ${err?.message}`);
        }
    }

    console.log(
        `\n${APPLY ? 'Updated' : 'Would update'} ${wouldFix} charge row(s); unreadable: ${failed}`,
    );
    if (!APPLY && wouldFix) console.log('Re-run with --apply to write these.');

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error(err?.message || err);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
