/**
 * Restores the payment ledger from Stripe using stored paymentIntent ids.
 * Never writes to Stripe. Safe to re-run.
 *
 * Pass A — existing charge rows:
 *   1. Restore amount / currency / receiptUrl / status from Stripe
 *   2. Insert any missing paymentType=refund rows (keyed on stripeRefundId)
 *
 * Pass B — refund rows with no matching charge on the same paymentIntent:
 *   1. Recreate the original charge from Stripe (amount, date, Paid/refunded
 *      status, receiptUrl), copying party/session links from the refund row
 *   2. Ensure each refund row is linked (same paymentIntent + stripeRefundId)
 *
 *   npx tsx scripts/backfillRefundLedger.ts            # dry run
 *   npx tsx scripts/backfillRefundLedger.ts --apply     # write
 *   npx tsx scripts/backfillRefundLedger.ts --apply --live
 *   npx tsx scripts/backfillRefundLedger.ts --apply --test
 *
 * Do not SSH/run against prod from an agent unless explicitly approved.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PaymentHistory = require('../models/PaymentHistory');
const {
    recordChargeRefund,
    chargeStatusAfterRefunds,
} = require('../utils/paymentRefundLedger');

const APPLY = process.argv.includes('--apply');
const ONLY_LIVE = process.argv.includes('--live');
const ONLY_TEST = process.argv.includes('--test');

const stripeFor = (mode: string) =>
    require('stripe')(mode === 'live' ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST);

type StripeSnap = {
    originalCents: number;
    currency: string;
    receiptUrl: string | null;
    receiptNumber: string | null;
    balanceTransaction: string | null;
    chargeCreatedAt: Date | null;
    refunds: Array<{ id: string; amount: number; currency: string; created?: number }>;
};

async function loadStripeSnap(pi: string, mode: string): Promise<StripeSnap> {
    const stripe = stripeFor(mode);
    const intent = await stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge'] });
    const stripeCharge =
        intent?.latest_charge && typeof intent.latest_charge === 'object'
            ? intent.latest_charge
            : null;
    const refundPage = await stripe.refunds.list({ payment_intent: pi, limit: 100 });
    const refunds = (refundPage?.data || [])
        .filter((r: any) => r && r.id && (!r.status || r.status === 'succeeded'))
        .map((r: any) => ({
            id: String(r.id),
            amount: typeof r.amount === 'number' ? r.amount : 0,
            currency: String(r.currency || intent.currency || 'usd'),
            created: typeof r.created === 'number' ? r.created : undefined,
        }));
    const originalCents = Math.round(
        Number(
            stripeCharge?.amount_captured
                ?? stripeCharge?.amount
                ?? intent.amount_received
                ?? intent.amount
                ?? 0,
        ),
    );
    const bt =
        stripeCharge?.balance_transaction && typeof stripeCharge.balance_transaction === 'string'
            ? stripeCharge.balance_transaction
            : stripeCharge?.balance_transaction?.id || null;
    return {
        originalCents,
        currency: String(intent.currency || 'usd'),
        receiptUrl: stripeCharge?.receipt_url ?? null,
        receiptNumber: stripeCharge?.receipt_number ?? null,
        balanceTransaction: bt,
        chargeCreatedAt: stripeCharge?.created
            ? new Date(Number(stripeCharge.created) * 1000)
            : intent.created
                ? new Date(Number(intent.created) * 1000)
                : null,
        refunds,
    };
}

async function ensureChargeFromSnap(args: {
    pi: string;
    mode: string;
    snap: StripeSnap;
    template?: any;
}): Promise<{ charge: any; created: boolean }> {
    const existing = await PaymentHistory.findOne({
        paymentIntent: args.pi,
        paymentType: { $ne: 'refund' },
    });
    if (existing) return { charge: existing, created: false };

    const refundedCents = args.snap.refunds.reduce((s, r) => s + r.amount, 0);
    const status = chargeStatusAfterRefunds(args.snap.originalCents, refundedCents);
    const t = args.template || {};
    const rawDesc = String(t.description || '').trim();
    const description = !rawDesc || /^refund\b/i.test(rawDesc)
        ? 'Payment (backfill from Stripe)'
        : rawDesc;
    const payload: Record<string, unknown> = {
        stripeMode: args.mode,
        paymentType: 'charge',
        amount: args.snap.originalCents,
        currency: args.snap.currency,
        description,
        paymentIntent: args.pi,
        status,
        receiptUrl: args.snap.receiptUrl,
        receiptNumber: args.snap.receiptNumber,
        balanceTransaction: args.snap.balanceTransaction,
        customer: t.customer,
        expert: t.expert,
        groupChat: t.groupChat,
        event: t.event,
        pendingAppointmentToGroup: t.pendingAppointmentToGroup,
    };

    if (!APPLY) {
        return { charge: { ...payload, _id: '(new)', paymentIntent: args.pi }, created: true };
    }

    const created = await PaymentHistory.create(payload);
    if (args.snap.chargeCreatedAt) {
        // Bypass mongoose timestamps so Stripe's charge.created sticks.
        await PaymentHistory.collection.updateOne(
            { _id: created._id },
            { $set: { createdAt: args.snap.chargeCreatedAt } },
        );
        created.createdAt = args.snap.chargeCreatedAt;
    }
    return { charge: created, created: true };
}

const run = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not set');
    await mongoose.connect(uri);

    const modeFilter: Record<string, unknown> = {};
    if (ONLY_LIVE && !ONLY_TEST) modeFilter.stripeMode = 'live';
    if (ONLY_TEST && !ONLY_LIVE) modeFilter.stripeMode = 'test';

    let restored = 0;
    let chargesCreated = 0;
    let refundRowsInserted = 0;
    let refundsLinked = 0;
    let skippedNoRefunds = 0;
    let failed = 0;
    const unresolved: string[] = [];

    // ── Pass A: existing charges ──────────────────────────────────────────
    const charges = await PaymentHistory.find({
        paymentType: { $ne: 'refund' },
        paymentIntent: { $type: 'string', $ne: '' },
        ...modeFilter,
    }).select(
        '_id paymentIntent stripeMode amount currency status receiptUrl description customer expert groupChat event pendingAppointmentToGroup paymentType',
    );

    console.log(`Pass A: ${charges.length} existing charge rows with a paymentIntent`);

    for (const charge of charges) {
        const mode = charge.stripeMode === 'live' ? 'live' : 'test';
        const pi = String(charge.paymentIntent);
        try {
            const snap = await loadStripeSnap(pi, mode);

            if (!snap.refunds.length) {
                if (snap.receiptUrl && !charge.receiptUrl) {
                    console.log(`  ${APPLY ? 'set' : 'would set'} receipt ${pi}`);
                    if (APPLY) {
                        await PaymentHistory.updateOne(
                            { _id: charge._id },
                            { $set: { receiptUrl: snap.receiptUrl } },
                        );
                    }
                    restored += 1;
                } else {
                    skippedNoRefunds += 1;
                }
                continue;
            }

            const nextStatus = chargeStatusAfterRefunds(
                snap.originalCents,
                snap.refunds.reduce((s, r) => s + r.amount, 0),
            );
            const chargeNeedsRestore =
                charge.amount !== snap.originalCents
                || charge.currency !== snap.currency
                || charge.status !== nextStatus
                || (!charge.receiptUrl && !!snap.receiptUrl);

            if (chargeNeedsRestore) {
                console.log(
                    `  ${APPLY ? 'restore' : 'would restore'} ${pi} ` +
                        `amount ${charge.amount}->${snap.originalCents} ` +
                        `status ${charge.status}->${nextStatus}`,
                );
                if (APPLY) {
                    const $set: Record<string, unknown> = {
                        amount: snap.originalCents,
                        currency: snap.currency,
                        status: nextStatus,
                    };
                    if (snap.receiptUrl && !charge.receiptUrl) $set.receiptUrl = snap.receiptUrl;
                    await PaymentHistory.updateOne({ _id: charge._id }, { $set });
                    charge.amount = snap.originalCents;
                    charge.currency = snap.currency;
                    charge.status = nextStatus;
                    if (snap.receiptUrl) charge.receiptUrl = snap.receiptUrl;
                }
                restored += 1;
            }

            for (const refund of snap.refunds) {
                if (APPLY) {
                    const result = await recordChargeRefund({
                        charge,
                        refund: {
                            id: refund.id,
                            amount: refund.amount,
                            currency: refund.currency,
                            payment_intent: pi,
                        },
                        description: charge.description
                            ? `Refund (backfill): ${charge.description}`
                            : 'Refund (backfill from Stripe)',
                        receiptUrl: snap.receiptUrl,
                    });
                    if (result.created) {
                        refundRowsInserted += 1;
                        console.log(`    + refund ${refund.id} ${refund.amount}`);
                    }
                } else {
                    const exists = await PaymentHistory.exists({ stripeRefundId: refund.id });
                    if (!exists) {
                        refundRowsInserted += 1;
                        console.log(`    would + refund ${refund.id} ${refund.amount}`);
                    }
                }
            }
        } catch (err: any) {
            failed += 1;
            unresolved.push(`${charge._id} pi=${pi} (${mode}): ${err?.message}`);
            console.log(`  SKIP ${pi} (${mode}): ${err?.message}`);
        }
    }

    // ── Pass B: refund rows missing a charge parent ───────────────────────
    const refundRows = await PaymentHistory.find({
        paymentType: 'refund',
        paymentIntent: { $type: 'string', $ne: '' },
        ...modeFilter,
    }).select(
        '_id paymentIntent stripeMode amount currency status stripeRefundId description customer expert groupChat event pendingAppointmentToGroup createdAt',
    );

    const byPi = new Map<string, any[]>();
    for (const row of refundRows) {
        const pi = String(row.paymentIntent);
        const list = byPi.get(pi) || [];
        list.push(row);
        byPi.set(pi, list);
    }

    let orphanPiCount = 0;
    console.log(`\nPass B: ${refundRows.length} refund rows across ${byPi.size} paymentIntents`);

    for (const [pi, rows] of byPi) {
        const parentExists = await PaymentHistory.exists({
            paymentIntent: pi,
            paymentType: { $ne: 'refund' },
        });
        if (parentExists) {
            // Still stamp missing stripeRefundId when we can match Stripe.
            const mode = rows[0]?.stripeMode === 'live' ? 'live' : 'test';
            try {
                const snap = await loadStripeSnap(pi, mode);
                for (const row of rows) {
                    if (row.stripeRefundId) continue;
                    const match = snap.refunds.find((r) =>
                        !rows.some((other: any) => other.stripeRefundId === r.id)
                        && r.amount === row.amount,
                    ) || snap.refunds.find((r) =>
                        !rows.some((other: any) => other.stripeRefundId === r.id),
                    );
                    if (!match) continue;
                    console.log(
                        `  ${APPLY ? 'link' : 'would link'} refund ${row._id} -> ${match.id} (existing charge)`,
                    );
                    if (APPLY) {
                        await PaymentHistory.updateOne(
                            { _id: row._id, stripeRefundId: { $in: [null, undefined, ''] } },
                            { $set: { stripeRefundId: match.id } },
                        );
                    }
                    refundsLinked += 1;
                }
            } catch (err: any) {
                failed += 1;
                unresolved.push(`link ${pi} (${mode}): ${err?.message}`);
            }
            continue;
        }

        orphanPiCount += 1;
        const mode = rows[0]?.stripeMode === 'live' ? 'live' : 'test';
        try {
            const snap = await loadStripeSnap(pi, mode);
            if (!(snap.originalCents > 0)) {
                failed += 1;
                unresolved.push(`${rows.map((r: any) => r._id).join(',')} pi=${pi}: Stripe amount is 0`);
                console.log(`  SKIP create charge ${pi}: Stripe amount is 0`);
                continue;
            }

            const { charge, created } = await ensureChargeFromSnap({
                pi,
                mode,
                snap,
                template: rows[0],
            });
            if (created) {
                chargesCreated += 1;
                const when = snap.chargeCreatedAt ? snap.chargeCreatedAt.toISOString() : '?';
                console.log(
                    `  ${APPLY ? 'create' : 'would create'} charge ${pi} ` +
                        `amount=${snap.originalCents} status=${charge.status} date=${when} ` +
                        `(from ${rows.length} orphan refund row(s))`,
                );
            }

            // Link orphan refund rows: stripeRefundId + ensure paymentIntent.
            const usedStripeIds = new Set<string>(
                rows.map((r: any) => r.stripeRefundId).filter(Boolean).map(String),
            );
            for (const row of rows) {
                let stripeRefundId = row.stripeRefundId ? String(row.stripeRefundId) : '';
                if (!stripeRefundId) {
                    const match =
                        snap.refunds.find((r) => !usedStripeIds.has(r.id) && r.amount === row.amount)
                        || snap.refunds.find((r) => !usedStripeIds.has(r.id));
                    if (match) {
                        stripeRefundId = match.id;
                        usedStripeIds.add(match.id);
                    }
                }
                if (!stripeRefundId) {
                    unresolved.push(`${row._id} pi=${pi}: no Stripe refund id to link`);
                    console.log(`  SKIP link refund ${row._id}: no Stripe refund id`);
                    continue;
                }

                const needsLink = !row.stripeRefundId || String(row.stripeRefundId) !== stripeRefundId;
                if (needsLink || created) {
                    console.log(
                        `  ${APPLY ? 'link' : 'would link'} refund ${row._id} -> charge ${pi} refundId=${stripeRefundId}`,
                    );
                    if (APPLY && needsLink) {
                        await PaymentHistory.updateOne(
                            { _id: row._id },
                            { $set: { stripeRefundId, paymentIntent: pi } },
                        );
                    }
                    refundsLinked += 1;
                }
            }

            // Insert Stripe refunds that have no ledger row yet (not the orphans we linked).
            for (const refund of snap.refunds) {
                if (usedStripeIds.has(refund.id)) continue;
                const exists = await PaymentHistory.exists({
                    $or: [
                        { stripeRefundId: refund.id },
                        { paymentType: 'refund', paymentIntent: pi, amount: refund.amount },
                    ],
                });
                if (exists) continue;
                if (APPLY) {
                    const liveCharge = await PaymentHistory.findOne({
                        paymentIntent: pi,
                        paymentType: { $ne: 'refund' },
                    });
                    if (!liveCharge) continue;
                    const result = await recordChargeRefund({
                        charge: liveCharge,
                        refund: {
                            id: refund.id,
                            amount: refund.amount,
                            currency: refund.currency,
                            payment_intent: pi,
                        },
                        description: 'Refund (backfill from Stripe)',
                        receiptUrl: snap.receiptUrl,
                    });
                    if (result.created) {
                        refundRowsInserted += 1;
                        console.log(`    + refund ${refund.id} ${refund.amount}`);
                    }
                } else {
                    refundRowsInserted += 1;
                    console.log(`    would + refund ${refund.id} ${refund.amount}`);
                }
            }
        } catch (err: any) {
            failed += 1;
            unresolved.push(`${rows.map((r: any) => r._id).join(',')} pi=${pi} (${mode}): ${err?.message}`);
            console.log(`  SKIP orphan ${pi} (${mode}): ${err?.message}`);
        }
    }

    console.log(
        `\n${APPLY ? 'restored' : 'would restore'} charges: ${restored}` +
            `   ${APPLY ? 'created' : 'would create'} charges: ${chargesCreated}` +
            `   ${APPLY ? 'linked' : 'would link'} refunds: ${refundsLinked}` +
            `   ${APPLY ? 'inserted' : 'would insert'} refund rows: ${refundRowsInserted}` +
            `   orphan PIs: ${orphanPiCount}` +
            `   no stripe refunds: ${skippedNoRefunds}` +
            `   unreadable: ${failed}`,
    );
    if (unresolved.length) {
        console.log('\nUnresolved:');
        for (const line of unresolved) console.log(`  - ${line}`);
    }
    if (!APPLY && (restored || chargesCreated || refundsLinked || refundRowsInserted)) {
        console.log('Re-run with --apply to write these.');
    }

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error(err?.message || err);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
