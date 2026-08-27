/**
 * Read-only audit of booking payments against Stripe.
 *
 * Finds bookings where the money and the booking disagree — money taken with nothing
 * confirmed, or a payment written off that actually went through. Both are states the
 * wallet (WeChat Pay / Alipay) rollout could produce before the delayed-settlement and
 * orphan-delivery fixes landed.
 *
 * Makes no writes of any kind: it reads Mongo, reads Stripe, and prints a report.
 *
 *   cd BE && npx tsx scripts/walletPaymentAudit.ts
 *   cd BE && npx tsx scripts/walletPaymentAudit.ts --days 30
 */
require("dotenv").config();

const mongoose = require("mongoose");

const PaymentHistory = require("../models/PaymentHistory");
const GroupChat = require("../models/GroupChat");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");
const User = require("../models/User");
const AppState = require("../models/AppState");

const argDays = () => {
    const i = process.argv.indexOf('--days');
    const value = i >= 0 ? Number(process.argv[i + 1]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : 14;
};

const money = (cents: any, currency: any) =>
    `${((Number(cents) || 0) / 100).toFixed(2)} ${String(currency || 'usd').toUpperCase()}`;

const stripeFor = (mode: string) =>
    require('stripe')(mode === 'live' ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST);

const retrieveIntent = async (id: string, mode: string) => {
    try {
        return await stripeFor(mode).paymentIntents.retrieve(id);
    } catch (err: any) {
        return { error: err?.message || 'could not retrieve' };
    }
};

type Finding = {
    severity: 'MONEY_AT_RISK' | 'NEEDS_REVIEW' | 'INFO';
    what: string;
    intent: string;
    stripeStatus: string;
    ourStatus: string;
    amount: string;
    student: string;
    booking: string;
    action: string;
};

const run = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI is not set. Run this from BE/ with your .env in place.');
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });

    const days = argDays();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const appState = await AppState.findOne();
    const serverMode = appState?.stripeMode === 'live' ? 'live' : 'test';

    console.log(`\nAuditing the last ${days} day(s). Server Stripe mode: ${serverMode}.`);
    console.log('This script writes nothing.\n');

    const findings: Finding[] = [];

    const nameOf = async (id: any) => {
        if (!id) return '—';
        const u = await User.findById(String(id)).select('email username').catch(() => null);
        return u?.email || u?.username || String(id);
    };

    // Every charge row we have touched recently, checked against Stripe's own view.
    const rows = await PaymentHistory.find({
        paymentType: 'charge',
        paymentIntent: { $nin: [null, ''] },
        createdAt: { $gte: since },
    }).sort({ createdAt: -1 });

    for (const row of rows) {
        const mode = row.stripeMode || serverMode;
        const intent: any = await retrieveIntent(String(row.paymentIntent), mode);
        const stripeStatus = intent?.error ? `ERROR: ${intent.error}` : String(intent?.status);
        const student = await nameOf(row.customer);

        const chat = row.groupChat
            ? await GroupChat.findById(String(row.groupChat)).select('name type status participants').catch(() => null)
            : null;
        const bookingLabel = chat ? `${chat.name} [${chat.type}/${chat.status}]` : '—';

        const paidAtStripe = stripeStatus === 'succeeded';
        const confirmed = chat
            ? (chat.type === 'individual'
                ? chat.status === 'active'
                : (chat.participants || []).some((p: any) => String(p) === String(row.customer)))
            : false;

        // Money is with Stripe but the student got nothing.
        if (paidAtStripe && chat && !confirmed && row.status !== 'refunded') {
            findings.push({
                severity: 'MONEY_AT_RISK',
                what: 'Paid at Stripe but the booking is not confirmed',
                intent: String(row.paymentIntent),
                stripeStatus,
                ourStatus: row.status,
                amount: money(row.amount, row.currency),
                student,
                booking: bookingLabel,
                action: 'Refund this payment, or confirm the booking manually if the session did happen.',
            });
            continue;
        }

        // We wrote the payment off, but Stripe took the money.
        if (paidAtStripe && ['failed', 'released'].includes(String(row.status))) {
            findings.push({
                severity: 'MONEY_AT_RISK',
                what: `Recorded as "${row.status}" but Stripe charged it`,
                intent: String(row.paymentIntent),
                stripeStatus,
                ourStatus: row.status,
                amount: money(row.amount, row.currency),
                student,
                booking: bookingLabel,
                action: confirmed
                    ? 'Booking is confirmed — correct this row to completed so revenue is right.'
                    : 'Refund this payment; the student was charged for nothing.',
            });
            continue;
        }

        // Still clearing. Normal for a wallet for a short while; stale if it lingers.
        if (stripeStatus === 'processing') {
            const ageMin = Math.round((Date.now() - new Date(row.createdAt).getTime()) / 60000);
            findings.push({
                severity: ageMin > 120 ? 'NEEDS_REVIEW' : 'INFO',
                what: `Wallet payment still clearing (${ageMin} min old)`,
                intent: String(row.paymentIntent),
                stripeStatus,
                ourStatus: row.status,
                amount: money(row.amount, row.currency),
                student,
                booking: bookingLabel,
                action: ageMin > 120
                    ? 'Unusually slow — check the Stripe webhook is reaching this server.'
                    : 'No action; the webhook settles this.',
            });
            continue;
        }

        // A hold nobody ever captured or released.
        if (stripeStatus === 'requires_capture' && ['pending', 'withheld'].includes(String(row.status))) {
            findings.push({
                severity: 'NEEDS_REVIEW',
                what: 'Authorization still open',
                intent: String(row.paymentIntent),
                stripeStatus,
                ourStatus: row.status,
                amount: money(row.amount, row.currency),
                student,
                booking: bookingLabel,
                action: 'Expected while an expert decides. Investigate if the deadline has passed.',
            });
        }
    }

    // Seats approved by a host that the student has not paid for.
    const seats = await SeminarSeatRequest.find({
        status: 'awaiting_payment',
        createdAt: { $gte: since },
    }).populate('groupChat', 'name');

    for (const seat of seats) {
        const overdue = seat.paymentDeadline && new Date(seat.paymentDeadline).getTime() < Date.now();
        findings.push({
            severity: overdue ? 'NEEDS_REVIEW' : 'INFO',
            what: overdue ? 'Approved seat past its payment deadline' : 'Approved seat awaiting payment',
            intent: seat.paymentIntent || '— (nothing charged yet)',
            stripeStatus: '—',
            ourStatus: seat.status,
            amount: money(seat.amount, seat.currency),
            student: await nameOf(seat.customer),
            booking: `${(seat.groupChat as any)?.name || 'Seminar'} [seat request]`,
            action: overdue
                ? 'The expiry sweep should have released this — check the sweep is running.'
                : 'No action; the student still has time to pay.',
        });
    }

    const order = { MONEY_AT_RISK: 0, NEEDS_REVIEW: 1, INFO: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);

    if (!findings.length) {
        console.log('No booking payments disagree with Stripe in this window.\n');
    } else {
        for (const f of findings) {
            console.log(`[${f.severity}] ${f.what}`);
            console.log(`   intent   : ${f.intent}`);
            console.log(`   stripe   : ${f.stripeStatus}   |   our row: ${f.ourStatus}`);
            console.log(`   amount   : ${f.amount}`);
            console.log(`   student  : ${f.student}`);
            console.log(`   booking  : ${f.booking}`);
            console.log(`   action   : ${f.action}\n`);
        }
        const atRisk = findings.filter((f) => f.severity === 'MONEY_AT_RISK').length;
        console.log(`${findings.length} finding(s); ${atRisk} involve money at risk.\n`);
    }

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('[walletPaymentAudit]', err?.message || err);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
