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
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const refund = await stripe.refunds.create({
            payment_intent: payment_intent,
        });
        console.log('Refund succeeded', refund);
        return refund
    } catch (err) {
        console.log('[refundPaymentIntent]', err.message)
        return false
    }
}

const sendPaymentLinkToUser = async (req, res) => {
    try {
        const { paymentHistoryId, customerEmail } = req.body;
        
        if (!paymentHistoryId || !customerEmail) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Payment history ID and customer email are required.'
            });
        }
        
        const PaymentHistory = require("../models/PaymentHistory");
        const sgMail = require("@sendgrid/mail");
        const adminEmail = "admin@wisdomlinked.com";
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        const paymentHistory = await PaymentHistory.findById(paymentHistoryId);
        if (!paymentHistory) {
            return res.status(404).json({
                status: 'FAILED',
                message: 'Payment history not found.'
            });
        }
        
        const appState = await AppState.findOne();
        const currentStripeMode = appState?.stripeMode || 'test';
        
        const stripe = require('stripe')(currentStripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        
        const paymentLink = await stripe.paymentLinks.create({
            line_items: [
                {
                    price_data: {
                        currency: paymentHistory.currency || 'usd',
                        product_data: {
                            name: paymentHistory.description || 'Service Payment',
                        },
                        unit_amount: paymentHistory.amount,
                    },
                    quantity: 1,
                },
            ],
        });
        console.log("PAYMENT LINK ->", paymentLink.url)
        const html = `
        <p>Hello,</p>
        <p>You have a pending payment for our services. Please use the link below to complete your payment:</p>
        <p><strong>Amount:</strong> $${(paymentHistory.amount / 100).toFixed(2)} ${(paymentHistory.currency || 'USD').toUpperCase()}</p>
        <p><strong>Description:</strong> ${paymentHistory.description || 'Service Payment'}</p>
        <p><a href="${paymentLink.url}" style="background-color: #31B099; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment</a></p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best Regards,<br>Team WisdomLinked</p>
        `;

        const msg = {
            to: customerEmail,
            from: {
                name: "WisdomLinked",
                email: adminEmail,
            },
            subject: "Payment Link - WisdomLinked",
            html,
        };

        await sgMail.send(msg);

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Payment link sent successfully to the customer.',
            paymentLinkUrl: paymentLink.url
        });
        
    } catch (err) {
        console.log('[sendPaymentLinkToUser]', err);
        return res.status(500).json({
            status: 'FAILED',
            message: 'Failed to send payment link: ' + err.message
        });
    }
};

module.exports = {
    stripePay,
    createStripePaymentIntent,
    getStripeMode,
    checkPaymentIntentSucceeded,
    setStripeMode,
    refundPaymentIntent,
    sendPaymentLinkToUser
}