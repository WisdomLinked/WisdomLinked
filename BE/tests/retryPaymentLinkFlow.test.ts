import test from "node:test";
import assert from "node:assert/strict";

process.env.STRIPE_SECRET_KEY_TEST = process.env.STRIPE_SECRET_KEY_TEST || "sk_test_stub";
process.env.STRIPE_SECRET_KEY_LIVE = process.env.STRIPE_SECRET_KEY_LIVE || "sk_test_stub";

const Module = require("module");

const stripeCalls: any = { sessions: [], links: [], linkRetrieve: [], intentUpdate: [] };
let webhookEvent: any = null;
let linkMetadata: any = {};
const sentMail: any[] = [];

const stripeInstance = {
    checkout: {
        sessions: {
            create: async (params: any) => {
                stripeCalls.sessions.push(params);
                return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
            },
        },
    },
    paymentLinks: {
        create: async (params: any) => {
            stripeCalls.links.push(params);
            return { id: "plink_1", url: "https://buy.stripe.test/plink_1" };
        },
        retrieve: async (id: string) => {
            stripeCalls.linkRetrieve.push(id);
            return { id, metadata: linkMetadata };
        },
    },
    paymentIntents: {
        update: async (id: string, data: any) => {
            stripeCalls.intentUpdate.push({ id, data });
            return {};
        },
    },
};
const stripeFactory: any = () => stripeInstance;
stripeFactory.webhooks = { constructEvent: () => webhookEvent };

const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
    if (request === "stripe") return stripeFactory;
    if (request === "@sendgrid/mail") {
        return { setApiKey: () => {}, send: async (msg: any) => { sentMail.push(msg); } };
    }
    return originalLoad(request, parent, isMain);
};

const { sendPaymentLinkToUser, sendAdHocPaymentLink, handleStripeWebhook } = require("../controllers/stripe.controller");
const { sweepExpiredRetryPaymentLinks } = require("../services/retryPaymentLinkSweep");
const PaymentHistory = require("../models/PaymentHistory");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const AppState = require("../models/AppState");
const StripeWebhookEvent = require("../models/StripeWebhookEvent");
const AdminAuditLog = require("../models/AdminAuditLog");
const { RETRY_LINK_SESSION_STARTED, RETRY_LINK_SESSION_TOO_SOON } = require("../utils/retryPaymentLink");

const HOUR = 60 * 60 * 1000;

const makeRes = () => ({
    statusCode: 200, body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    send(body: any) { this.body = body; return this; },
    json(body: any) { this.body = body; return this; },
});

const reset = () => {
    stripeCalls.sessions = [];
    stripeCalls.links = [];
    stripeCalls.linkRetrieve = [];
    stripeCalls.intentUpdate = [];
    sentMail.length = 0;
};

const original = {
    _id: "ph_original", amount: 4000, currency: "usd", description: "Seminar seat",
    customer: "student-1", expert: "expert-1", groupChat: "seminar-1",
};

async function sendLink(t: any, sessionStart: Date | null, history: any = original) {
    reset();
    const saved: any[] = [];
    const audits: any[] = [];
    t.mock.method(AdminAuditLog, "create", async (doc: any) => { audits.push(doc); return doc; });
    t.mock.method(PaymentHistory, "findById", async () => history);
    t.mock.method(PaymentHistory.prototype, "save", async function (this: any) { saved.push(this.toObject()); return this; });
    t.mock.method(AppState, "findOne", async () => ({ stripeMode: "test" }));
    t.mock.method(GroupChat, "findById", () => ({ select: async () => (sessionStart ? { start: sessionStart } : null) }));
    t.mock.method(User, "findById", () => ({ select: async () => ({ timeZone: "America/Chicago" }) }));
    const res = makeRes();
    const before = Date.now();
    await sendPaymentLinkToUser({
        user: { userId: "admin-1", email: "admin@example.com" },
        body: { paymentHistoryId: "ph_original", customerEmail: "student@example.com", customAmount: 4000, customDescription: "Seminar seat" },
    }, res);
    return { res, saved, audits, before, after: Date.now() };
}

test("a retry link is a one-time Stripe Checkout Session, never a reusable Payment Link", async t => {
    const { res, saved } = await sendLink(t, new Date(Date.now() + 5 * 24 * HOUR));
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(stripeCalls.links.length, 0);
    assert.equal(stripeCalls.sessions.length, 1);
    const params = stripeCalls.sessions[0];
    assert.equal(params.mode, "payment");
    assert.equal(params.customer_email, "student@example.com");
    assert.equal(params.line_items[0].price_data.unit_amount, 4000);
    assert.equal(params.metadata.paymentType, "retry");
    assert.equal(params.metadata.originalPaymentHistoryId, "ph_original");
    assert.match(params.success_url, /\/payment-complete$/);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].checkoutSessionId, "cs_test_1");
    assert.equal(saved[0].status, "pending");
    assert.equal(sentMail.length, 1);
    assert.match(sentMail[0].html, /https:\/\/checkout\.stripe\.test\/cs_test_1/);
    assert.match(sentMail[0].html, /Link expires/);
});

test("a sent retry link is written to the admin audit log", async t => {
    const { res, saved, audits } = await sendLink(t, new Date(Date.now() + 5 * 24 * HOUR));
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "send_payment_link");
    assert.equal(audits[0].actorEmail, "admin@example.com");
    assert.equal(audits[0].targetType, "paymentHistory");
    assert.equal(audits[0].targetId, String(saved[0]._id));
    assert.equal(audits[0].targetEmail, "student@example.com");
    assert.deepEqual(audits[0].meta, {
        amount: "40.00 USD",
        description: "Seminar seat",
        originalPayment: "ph_original",
        stripeMode: "test",
    });
});

test("a refused retry link is not written to the admin audit log", async t => {
    const { res, audits } = await sendLink(t, new Date(Date.now() - HOUR));
    assert.equal(res.body.status, "FAILED");
    assert.equal(audits.length, 0);
});

test("a sent ad-hoc payment link is written to the admin audit log, a rejected one is not", async t => {
    reset();
    const audits: any[] = [];
    const saved: any[] = [];
    t.mock.method(AdminAuditLog, "create", async (doc: any) => { audits.push(doc); return doc; });
    t.mock.method(AppState, "findOne", async () => ({ stripeMode: "test" }));
    t.mock.method(User, "findOne", async () => ({ _id: "customer-1", email: "payer@example.com" }));
    t.mock.method(PaymentHistory.prototype, "save", async function (this: any) { saved.push(this.toObject()); return this; });
    const user = { userId: "admin-1", email: "admin@example.com" };

    const rejected = makeRes();
    await sendAdHocPaymentLink({ user, body: { amount: 0, description: "Consult", customerEmail: "payer@example.com" } }, rejected);
    assert.equal(rejected.statusCode, 400);
    assert.equal(audits.length, 0);

    const res = makeRes();
    await sendAdHocPaymentLink({
        user,
        body: { amount: 25, description: " Consult ", customerEmail: " payer@example.com ", customerName: "Pat" },
    }, res);
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(stripeCalls.links.length, 1);
    assert.equal(sentMail.length, 1);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "send_adhoc_payment_link");
    assert.equal(audits[0].targetType, "paymentHistory");
    assert.equal(audits[0].targetId, String(saved[0]._id));
    assert.equal(audits[0].targetEmail, "payer@example.com");
    assert.deepEqual(audits[0].meta, { amount: "25.00 USD", description: "Consult", stripeMode: "test" });
});

test("the link expires 24 hours after it is sent when the session is further away", async t => {
    const { saved, before, after } = await sendLink(t, new Date(Date.now() + 5 * 24 * HOUR));
    const stripeExpiresAt = stripeCalls.sessions[0].expires_at * 1000;
    assert.ok(stripeExpiresAt >= Math.floor((before + 24 * HOUR) / 1000) * 1000);
    assert.ok(stripeExpiresAt <= after + 24 * HOUR);
    const recordExpiresAt = new Date(saved[0].linkExpiresAt).getTime();
    assert.ok(recordExpiresAt >= before + 24 * HOUR && recordExpiresAt <= after + 24 * HOUR);
    assert.equal(Math.floor(recordExpiresAt / 1000), stripeCalls.sessions[0].expires_at);
});

test("the link expires when the session starts if that is sooner than 24 hours", async t => {
    const start = new Date(Date.now() + 3 * HOUR);
    const { saved } = await sendLink(t, start);
    assert.equal(stripeCalls.sessions[0].expires_at, Math.floor(start.getTime() / 1000));
    assert.equal(new Date(saved[0].linkExpiresAt).getTime(), start.getTime());
});

test("no link is sent, and nothing is charged or recorded, for a session that has started", async t => {
    const { res, saved } = await sendLink(t, new Date(Date.now() - HOUR));
    assert.deepEqual(res.body, { status: "FAILED", message: RETRY_LINK_SESSION_STARTED });
    assert.equal(stripeCalls.sessions.length, 0);
    assert.equal(saved.length, 0);
    assert.equal(sentMail.length, 0);
});

test("no link is sent for a session starting in under 30 minutes", async t => {
    const { res } = await sendLink(t, new Date(Date.now() + 20 * 60 * 1000));
    assert.deepEqual(res.body, { status: "FAILED", message: RETRY_LINK_SESSION_TOO_SOON });
    assert.equal(stripeCalls.sessions.length, 0);
});

test("a payment with no session behind it still gets a 24-hour link", async t => {
    const { res, before } = await sendLink(t, null, { ...original, groupChat: undefined });
    assert.equal(res.body.status, "SUCCESS");
    assert.ok(stripeCalls.sessions[0].expires_at * 1000 >= Math.floor((before + 24 * HOUR) / 1000) * 1000);
});


function mockFindOne(t: any, resolve: (filter: any) => any) {
    const filters: any[] = [];
    t.mock.method(PaymentHistory, "findOne", (filter: any) => {
        filters.push(filter);
        const result = resolve(filter);
        const query: any = Promise.resolve(result);
        query.sort = () => Promise.resolve(result);
        return query;
    });
    return filters;
}

async function deliver(t: any, session: any) {
    reset();
    webhookEvent = { id: `evt_${Math.random()}`, type: "checkout.session.completed", data: { object: session } };
    t.mock.method(StripeWebhookEvent, "create", async () => ({ _id: "claim" }));
    t.mock.method(AppState, "findOne", async () => ({ stripeMode: "test" }));
    t.mock.method(PaymentHistory, "findById", async () => original);
    const res = makeRes();
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: "{}" }, res);
    return res;
}

const retrySession = (over: any = {}) => ({
    id: "cs_test_1",
    amount_total: 4000,
    currency: "usd",
    payment_intent: "pi_paid",
    customer_details: { email: "student@example.com" },
    metadata: {
        paymentType: "retry", originalPaymentHistoryId: "ph_original", stripeMode: "test",
        authorizedCustomerEmail: "student@example.com", originalAmount: "4000", customAmount: "4000",
        customDescription: "Seminar seat",
    },
    ...over,
});

test("paying a Checkout Session retry link completes the record it was sent with", async t => {
    const record: any = { status: "pending", save: async () => record };
    const filters = mockFindOne(t, (f) => (f.checkoutSessionId === "cs_test_1" ? record : null));
    const res = await deliver(t, retrySession());
    assert.equal(res.statusCode, 200);
    assert.equal(record.status, "completed");
    assert.equal(record.paymentIntent, "pi_paid");
    assert.deepEqual(filters[0], { paymentType: "retry", checkoutSessionId: "cs_test_1" });
    assert.equal(stripeCalls.linkRetrieve.length, 0);
});

test("a payment that lands just after the expiry sweep still completes its record", async t => {
    const record: any = { status: "failed", save: async () => record };
    mockFindOne(t, (f) => (f.checkoutSessionId === "cs_test_1" ? record : null));
    await deliver(t, retrySession());
    assert.equal(record.status, "completed");
});

test("a Checkout Session paying the wrong amount is rejected", async t => {
    const record: any = { status: "pending", save: async () => record };
    mockFindOne(t, () => record);
    const res = await deliver(t, retrySession({ amount_total: 100 }));
    assert.equal(res.statusCode, 400);
    assert.equal(record.status, "pending");
});

test("links sent before this change, as Payment Links, are still recorded when paid", async t => {
    linkMetadata = retrySession().metadata;
    const record: any = { status: "pending", save: async () => record };
    mockFindOne(t, (f) => (f.status === "pending" ? record : null));
    await deliver(t, retrySession({ id: "cs_from_link", payment_link: "plink_old", metadata: {} }));
    assert.deepEqual(stripeCalls.linkRetrieve, ["plink_old"]);
    assert.equal(record.status, "completed");
    linkMetadata = {};
});

test("a checkout session that is not a retry link is ignored", async t => {
    const filters = mockFindOne(t, () => null);
    const res = await deliver(t, { id: "cs_other", amount_total: 100, metadata: { purpose: "something-else" } });
    assert.equal(res.statusCode, 200);
    assert.equal(filters.length, 0);
});


test("the sweep marks only expired, still-pending retry links failed", async t => {
    const calls: any[] = [];
    t.mock.method(PaymentHistory, "updateMany", async (filter: any, update: any) => {
        calls.push({ filter, update });
        return { modifiedCount: 2 };
    });
    const now = Date.parse("2026-10-12T12:00:00Z");
    assert.equal(await sweepExpiredRetryPaymentLinks(now), 2);
    assert.deepEqual(calls[0].filter, { paymentType: "retry", status: "pending", linkExpiresAt: { $lte: new Date(now) } });
    assert.deepEqual(calls[0].update, { $set: { status: "failed" } });
});
