const stripeTest = require('stripe')(process.env.STRIPE_SECRET_KEY_TEST);
const stripeLive = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);
const AppState = require("../models/AppState");

const stripePay = async (req, res) => {
    try {
        const charge = await stripeTest.charges.create({
            amount: req.body.amount,
            source: `${req.body.token}`,
            currency: 'USD',
            description: "First Test Charge"
        });
        console.log(charge);
        if (charge.status == "succeeded") {
            return res.status(200).send({
                Message: "Successfully Purchased",
            });
        } else {
            throw new Error("Failed to purchase")
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }

};

const createStripePaymentIntent = async (req, res) => {
    try {
        const { stripeMode, amount } = req.body
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: 'usd',
        });
        res.send({
            client_secret: paymentIntent.client_secret,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }

};

const setStripeMode = async (req, res) => {
    try {
        const { stripeMode } = req.body
        const appState = await AppState.findOne()
        if (!appState) {
            await AppState.create({
                stripeMode: stripeMode
            })
        } else {
            appState.stripeMode = stripeMode
            await appState.save()
        }
        res.send({
            result: 'SUCCESS',
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

const getStripeMode = async (req, res) => {
    try {
        const appState = await AppState.findOne()
        let stripeMode = appState.stripeMode
        if (!appState) {
            await AppState.create({
                stripeMode: "test"
            })
            stripeMode = "test"
        }
        res.send({
            stripeMode: stripeMode,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

const checkPaymentIntentSucceeded = async (payment_intent, stripeMode) => {
    // Checking The Payment Intent In Test Mode
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
        if (paymentIntent?.status === 'succeeded') {
            console.log('Test Payment succeeded');
            return paymentIntent
        } else {
            console.log('Test Payment not succeeded');
            return false
        }
    } catch (err) {
        console.log('[checkPaymentIntentSucceeded]', err.message)
        return false
    }
}

const refundPaymentIntent = async (payment_intent, amount, stripeMode) => {
    try {
        const stripe = require('stripe')(stripeMode === 'test'
            ? process.env.STRIPE_SECRET_KEY_TEST
            : process.env.STRIPE_SECRET_KEY_LIVE);
        const body = { payment_intent };
        // amount in USD because Stripe wants cents
        if (typeof amount === 'number' && amount > 0) body.amount = Math.round(amount * 100);
        const refund = await stripe.refunds.create(body);
        console.log('Refund succeeded', refund);
        return refund
    } catch (err) {
        console.log('[refundPaymentIntent]', err.message)
        return false
    }
}

module.exports = {
    stripePay,
    createStripePaymentIntent,
    getStripeMode,
    checkPaymentIntentSucceeded,
    setStripeMode,
    refundPaymentIntent
}