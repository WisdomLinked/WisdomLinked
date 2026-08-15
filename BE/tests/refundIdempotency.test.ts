import test from "node:test";
import assert from "node:assert/strict";

process.env.STRIPE_SECRET_KEY_TEST = process.env.STRIPE_SECRET_KEY_TEST || "sk_test_stub";
process.env.STRIPE_SECRET_KEY_LIVE = process.env.STRIPE_SECRET_KEY_LIVE || "sk_test_stub";

const Module = require("module");

// Stripe is swapped at require() time so no network call is ever made.
const stripeCalls: any = { create: [], list: [], retrieve: [] };
let createBehaviour: () => any = () => ({ id: "re_new", payment_intent: "pi_1" });
let listBehaviour: () => any = () => ({ data: [] });
// Default: a fully-paid, never-refunded charge.
let intentBehaviour: () => any = () => ({
    latest_charge: { amount_captured: 10000, amount_refunded: 0 },
});

const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
    if (request === "stripe") {
        return () => ({
            refunds: {
                create: async (data: any) => {
                    stripeCalls.create.push(data);
                    return createBehaviour();
                },
                list: async (data: any) => {
                    stripeCalls.list.push(data);
                    return listBehaviour();
                },
            },
            paymentIntents: {
                retrieve: async (id: any) => {
                    stripeCalls.retrieve.push(id);
                    return intentBehaviour();
                },
            },
        });
    }
    return originalLoad(request, parent, isMain);
};

// The stub stays installed for the whole file: refundPaymentIntent requires 'stripe'
// lazily on each call, so restoring here would let the real SDK make network calls.
const { refundPaymentIntent } = require("../controllers/stripe.controller");

const alreadyRefundedError = () => {
    const err: any = new Error("Charge ch_123 has already been refunded.");
    err.code = "charge_already_refunded";
    throw err;
};

const amountZeroError = () => {
    const err: any = new Error("You cannot refund a payment for amount=0. Please pass an amount greater than 0.");
    err.code = "parameter_invalid_integer";
    throw err;
};

const reset = () => {
    stripeCalls.create = [];
    stripeCalls.list = [];
    stripeCalls.retrieve = [];
    createBehaviour = () => ({ id: "re_new", payment_intent: "pi_1" });
    listBehaviour = () => ({ data: [] });
    intentBehaviour = () => ({ latest_charge: { amount_captured: 10000, amount_refunded: 0 } });
};

const fullyRefundedIntent = () => ({
    latest_charge: { amount_captured: 10000, amount_refunded: 10000 },
});

test("a normal refund passes the intent through and returns Stripe's refund", async () => {
    reset();
    const result: any = await refundPaymentIntent("pi_1", null, "test");
    assert.equal(result.id, "re_new");
    assert.deepEqual(stripeCalls.create[0], { payment_intent: "pi_1" });
});

test("a partial refund sends the rounded amount", async () => {
    reset();
    await refundPaymentIntent("pi_1", 1234.4, "test");
    assert.equal(stripeCalls.create[0].amount, 1234);
});

test("an already-refunded card charge returns the existing refund, not a failure", async () => {
    reset();
    createBehaviour = alreadyRefundedError;
    intentBehaviour = fullyRefundedIntent;
    listBehaviour = () => ({ data: [{ id: "re_existing", payment_intent: "pi_1" }] });

    const result: any = await refundPaymentIntent("pi_1", null, "test");

    // Callers gate their bookkeeping on this value. Returning false left the refund
    // unrecorded, so reconciliation retried the same charge on every sweep forever.
    assert.ok(result, "an already-refunded charge must not read as a failed refund");
    assert.equal(result.id, "re_existing");
    assert.equal(result.alreadyRefunded, true);
});

test("a fully-refunded non-card charge is recognised despite a different error", async () => {
    reset();
    // py_ charges report exhaustion as "cannot refund amount=0" rather than
    // charge_already_refunded, so matching on the error code alone missed them.
    createBehaviour = amountZeroError;
    intentBehaviour = fullyRefundedIntent;
    listBehaviour = () => ({ data: [{ id: "pyr_existing", payment_intent: "pi_1" }] });

    const result: any = await refundPaymentIntent("pi_1", null, "test");

    assert.ok(result, "a fully-refunded py_ charge must not loop forever either");
    assert.equal(result.id, "pyr_existing");
    assert.equal(result.alreadyRefunded, true);
});

test("a partly-refunded charge that errors still reads as a failure", async () => {
    reset();
    createBehaviour = amountZeroError;
    // Money is still refundable, so this is a real failure, not an idempotent repeat.
    intentBehaviour = () => ({ latest_charge: { amount_captured: 10000, amount_refunded: 4000 } });
    listBehaviour = () => ({ data: [{ id: "re_partial", payment_intent: "pi_1" }] });

    assert.equal(await refundPaymentIntent("pi_1", null, "test"), false);
});

test("an already-refunded charge with no retrievable refund still fails closed", async () => {
    reset();
    createBehaviour = alreadyRefundedError;
    intentBehaviour = fullyRefundedIntent;
    listBehaviour = () => ({ data: [] });

    assert.equal(await refundPaymentIntent("pi_1", null, "test"), false);
});

test("other Stripe errors remain failures", async () => {
    reset();
    createBehaviour = () => {
        const err: any = new Error("No such payment_intent");
        err.code = "resource_missing";
        throw err;
    };

    assert.equal(await refundPaymentIntent("pi_missing", null, "test"), false);
});

test("a never-refunded charge that errors is not mistaken for an idempotent repeat", async () => {
    reset();
    createBehaviour = () => {
        const err: any = new Error("Insufficient funds in your Stripe balance");
        err.code = "balance_insufficient";
        throw err;
    };
    listBehaviour = () => ({ data: [{ id: "re_unrelated", payment_intent: "pi_1" }] });

    assert.equal(await refundPaymentIntent("pi_1", null, "test"), false);
});

test("an amount below one cent is refused without calling Stripe", async () => {
    reset();
    // Stripe answers this with "cannot refund a payment for amount=0", which reads as a
    // broken integration rather than "there was nothing to refund".
    assert.equal(await refundPaymentIntent("pi_1", 0.4, "test"), false);
    assert.equal(stripeCalls.create.length, 0);
});

test("a zero amount is treated as nothing owed, not as a full refund", async () => {
    reset();
    assert.equal(await refundPaymentIntent("pi_1", 0, "test"), false);
    assert.equal(stripeCalls.create.length, 0, "a full refund must never be inferred from 0");
});

test("a non-numeric amount never reaches Stripe", async () => {
    reset();
    assert.equal(await refundPaymentIntent("pi_1", "abc", "test"), false);
    assert.equal(stripeCalls.create.length, 0);
});

test("an explicit null amount still means a full refund", async () => {
    reset();
    await refundPaymentIntent("pi_1", null, "test");
    assert.equal(stripeCalls.create[0].amount, undefined);
});
