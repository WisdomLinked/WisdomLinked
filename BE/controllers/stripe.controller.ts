import { Request, Response } from 'express';
import { BOOKING_PAYMENT_AMOUNT_INVALID } from '../utils/bookingUserFacingCopy';
import { HTTP_GENERIC_ERROR, safeErrorMessage } from '../utils/httpUserFacingCopy';
import { expectedBookingIntentCents, extractHourlyRate } from '../utils/bookingPrice';
import { seminarIsFull, firstFullFutureOccurrence, seatRequestUnavailableMessage } from '../utils/seminarCapacity';

const stripeTest = require('stripe')(process.env.STRIPE_SECRET_KEY_TEST);
const stripeLive = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);
const AppState = require("../models/AppState");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const PaymentHistory = require("../models/PaymentHistory");
const { assertBookingLeadTime } = require("../utils/bookingLeadTime");

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
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }

};

const createStripePaymentIntent = async (req, res) => {
    try {
        const { groupChatId, expertId, duration } = req.body
        const payerId = req.user?.userId ? String(req.user.userId) : '';
        const appState = await AppState.findOne();
        const stripeMode = appState?.stripeMode === 'live' ? 'live' : 'test';

        let expectedCents: number;
        let metadata: Record<string, string>;
        let manualCapture = false;
        let requiresApproval = false;
        if (groupChatId) {
            const groupChat = await GroupChat.findById(String(groupChatId));
            if (!groupChat) {
                return res.status(404).send(BOOKING_PAYMENT_AMOUNT_INVALID);
            }
            expectedCents = expectedBookingIntentCents({ kind: 'groupChat', priceDollars: groupChat.price });
            metadata = { bookingType: 'groupChat', groupChatId: String(groupChat._id), userId: payerId };

            if (groupChat.type !== 'seminar') {
                const onSession = (groupChat.participants || []).some(
                    (p) => p.toString() === String(payerId),
                );
                if (!onSession) {
                    return res.status(403).send({ error: 'This session is not yours to pay for.' });
                }
                if (groupChat.status === 'cancelled') {
                    return res.status(400).send({ error: 'This session is no longer available.' });
                }
                const alreadyPaid = await PaymentHistory.exists({
                    groupChat: String(groupChat._id),
                    paymentType: 'charge',
                    status: { $in: ['completed', 'pending'] },
                });
                if (groupChat.status === 'active' || alreadyPaid) {
                    return res.status(409).send({ error: 'This session has already been paid for.' });
                }
                const startMs = groupChat.start ? new Date(groupChat.start).getTime() : 0;
                if (startMs && startMs <= Date.now()) {
                    return res.status(400).send({ error: "This session's start time has already passed." });
                }
                // Hold the funds; they are captured only once the session is active.
                manualCapture = true;
            }

            if (groupChat.type === 'seminar') {
                const userId = req.user?.userId;

                if (userId && groupChat.admin && groupChat.admin.toString() === String(userId)) {
                    return res.status(403).send({ error: "Hosts can't register for their own seminar." });
                }
                if (groupChat.status !== 'active') {
                    return res.status(400).send({ error: 'This seminar is not open for registration.' });
                }
                const alreadyParticipant = (groupChat.participants || []).some(
                    (p) => p.toString() === String(userId),
                );
                if (alreadyParticipant) {
                    return res.status(409).send({ error: "You're already registered for this seminar." });
                }

                if (seminarIsFull(groupChat)) {
                    const startMs = groupChat.start ? new Date(groupChat.start).getTime() : 0;
                    const unavailable = seatRequestUnavailableMessage(startMs);
                    if (unavailable) {
                        return res.status(400).send({ error: unavailable });
                    }
                    manualCapture = true;
                    requiresApproval = true;
                    metadata.seatRequest = 'true';
                } else {
                    if (groupChat.seriesId) {
                        const siblings = await GroupChat.find({
                            seriesId: groupChat.seriesId,
                            type: 'seminar',
                            _id: { $ne: groupChat._id },
                        });
                        if (firstFullFutureOccurrence(siblings)) {
                            return res.status(400).send({ error: 'A later session in this seminar series is full, so registration is closed.' });
                        }
                    }
                    const expert = await User.findById(groupChat.admin.toString());
                    try {
                        assertBookingLeadTime(expert, groupChat.start, 'Seminar registrations');
                    } catch (leadErr) {
                        return res.status(400).send({ error: leadErr.message || 'This seminar can no longer be booked.' });
                    }
                    manualCapture = true;
                }
            }
        } else {
            const expertUser = await User.findById(String(expertId));
            if (!expertUser) {
                return res.status(404).send(BOOKING_PAYMENT_AMOUNT_INVALID);
            }
            expectedCents = expectedBookingIntentCents({ kind: 'oneToOne', durationMinutes: Number(duration), hourlyRateDollars: extractHourlyRate(expertUser.price) });
            metadata = { bookingType: 'oneToOne', expertId: String(expertUser._id), duration: String(duration), userId: payerId };
            manualCapture = true;
        }

        if (!(expectedCents > 0)) {
            return res.status(400).send(BOOKING_PAYMENT_AMOUNT_INVALID);
        }

        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: expectedCents,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            ...(manualCapture ? { capture_method: 'manual' } : {}),
            metadata,
        });
        res.send({
            client_secret: paymentIntent.client_secret,
            requiresApproval,
            holdsFunds: manualCapture,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
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
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const getStripeMode = async (req, res) => {
    try {
        let appState = await AppState.findOne()
        if (!appState) {
            appState = await AppState.create({
                stripeMode: "test"
            })
        }
        res.send({
            stripeMode: appState.stripeMode,
            seminarApprovalDeadlineHours: appState.seminarApprovalDeadlineHours ?? 24,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const setSeminarApprovalDeadline = async (req, res) => {
    try {
        const hours = Number(req.body.seminarApprovalDeadlineHours);
        if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
            return res.status(400).send({ error: 'Deadline must be between 0 and 168 hours.' });
        }
        let appState = await AppState.findOne();
        if (!appState) {
            appState = await AppState.create({ seminarApprovalDeadlineHours: hours });
        } else {
            appState.seminarApprovalDeadlineHours = hours;
            await appState.save();
        }
        res.send({ result: 'SUCCESS', seminarApprovalDeadlineHours: appState.seminarApprovalDeadlineHours });
    } catch (err) {
        console.log(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const checkPaymentIntentSucceeded = async (payment_intent, stripeMode) => {
    // Checking The Payment Intent In Test Mode
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent, { expand: ['latest_charge'] });
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

const checkPaymentIntentAuthorized = async (payment_intent, stripeMode) => {
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent, { expand: ['latest_charge'] });
        if (paymentIntent?.status === 'requires_capture') {
            return paymentIntent;
        }
        return false;
    } catch (err) {
        console.log('[checkPaymentIntentAuthorized]', err.message);
        return false;
    }
};

const capturePaymentIntent = async (payment_intent, stripeMode, amountToCaptureCents?: number) => {
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const options: Record<string, any> = { expand: ['latest_charge'] };
        if (typeof amountToCaptureCents === 'number' && amountToCaptureCents > 0) {
            options.amount_to_capture = Math.round(amountToCaptureCents);
        }
        const captured = await stripe.paymentIntents.capture(payment_intent, options);
        return captured?.status === 'succeeded' ? captured : false;
    } catch (err) {
        console.log('[capturePaymentIntent]', err.message);
        return false;
    }
};

const cancelPaymentIntent = async (payment_intent, stripeMode) => {
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const cancelled = await stripe.paymentIntents.cancel(payment_intent);
        return cancelled?.status === 'canceled' ? cancelled : false;
    } catch (err) {
        console.log('[cancelPaymentIntent]', err.message);
        return false;
    }
};

const refundPaymentIntent = async (payment_intent, amountCents, stripeMode) => {
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);

        const refundData: Record<string, any> = {
            payment_intent: payment_intent,
        };

        // Add amount if specified (for partial refunds)
        if (amountCents) {
            refundData.amount = Math.round(Math.abs(Number(amountCents)));
        }

        const refund = await stripe.refunds.create(refundData);
        console.log('Refund succeeded', refund);
        return refund
    } catch (err) {
        console.log('[refundPaymentIntent]', err.message)
        return false
    }
}

const listReconcilableBookingIntents = async (
    stripeMode: string,
    { sinceMs, untilMs, maxPages = 20 }: { sinceMs: number; untilMs: number; maxPages?: number },
): Promise<Array<{ id: string; status: string; amount: number; currency: string; createdMs: number; metadata: Record<string, any> }>> => {
    try {
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        const created = { gte: Math.floor(sinceMs / 1000), lte: Math.floor(untilMs / 1000) };
        const out: Array<{ id: string; status: string; amount: number; currency: string; createdMs: number; metadata: Record<string, any> }> = [];
        let startingAfter: string | undefined;
        for (let page = 0; page < maxPages; page += 1) {
            const batch = await stripe.paymentIntents.list({
                limit: 100,
                created,
                ...(startingAfter ? { starting_after: startingAfter } : {}),
            });
            const data = batch?.data || [];
            for (const pi of data) {
                const bt = pi.metadata?.bookingType;
                if (bt !== 'groupChat' && bt !== 'oneToOne') continue;
                if (pi.status !== 'requires_capture' && pi.status !== 'succeeded') continue;
                out.push({ id: pi.id, status: pi.status, amount: pi.amount, currency: pi.currency, createdMs: Number(pi.created || 0) * 1000, metadata: pi.metadata || {} });
            }
            if (!batch?.has_more || !data.length) break;
            startingAfter = data[data.length - 1].id;
        }
        return out;
    } catch (err: any) {
        console.log('[listReconcilableBookingIntents]', err.message);
        return [];
    }
};

const enrichPaymentIntentReceipt = async ({ payment_intent, stripeMode, description, metadata, receiptEmail }) => {
    try {
        if (!payment_intent) return;
        const stripe = require('stripe')(stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
        await stripe.paymentIntents.update(payment_intent, {
            description,
            metadata,
            receipt_email: receiptEmail,
        });
    } catch (err) {
        console.error('[enrichPaymentIntentReceipt]', err.message);
    }
};

const sendBookingReceiptAndConfirmation = async ({ payment_intent, charge, sessionType, sessionName, expertName, studentName, studentEmail, start, duration, timeZone }) => {
    try {
        if (!charge || !studentEmail) return;
        const { sendPaymentConfirmationEmail } = require("../services/notifications");
        const dateStr = new Date(start).toLocaleString("en-US", { timeZone: timeZone || "UTC" });
        const description = `WisdomLinked ${sessionType} — "${sessionName}" with ${expertName} · ${dateStr}`;
        const metadata = {
            sessionType: String(sessionType),
            sessionName: String(sessionName),
            expert: String(expertName),
            student: String(studentName),
            start: new Date(start).toISOString(),
            durationMin: String(duration),
        };
        await enrichPaymentIntentReceipt({
            payment_intent,
            stripeMode: charge.paidBy,
            description,
            metadata,
            receiptEmail: studentEmail,
        });
        await sendPaymentConfirmationEmail({
            to: studentEmail,
            sessionType,
            sessionName,
            expertName,
            studentName,
            start,
            duration,
            amount: charge.amount,
            currency: charge.currency,
            receiptUrl: charge.receiptUrl,
            timeZone,
        });
    } catch (err) {
        console.error('[sendBookingReceiptAndConfirmation]', err.message);
    }
};

const sendPaymentLinkToUser = async (req, res) => {
    try {
        const { paymentHistoryId, customerEmail, customAmount, customDescription } = req.body;

        if (!paymentHistoryId || !customerEmail) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Payment history ID and customer email are required.'
            });
        }

        const PaymentHistory = require("../models/PaymentHistory");
        const sgMail = require("@sendgrid/mail");
        const adminEmail = "noreply@wisdomlinked.com";
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const paymentHistory = await PaymentHistory.findById(String(paymentHistoryId));
        if (!paymentHistory) {
            return res.status(404).json({
                status: 'FAILED',
                message: 'Payment history not found.'
            });
        }

        const appState = await AppState.findOne();
        const currentStripeMode = appState?.stripeMode || 'test';

        const stripe = require('stripe')(currentStripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);

        const finalAmount = customAmount || paymentHistory.amount;
        const finalDescription = customDescription || paymentHistory.description || 'Service Payment';

        const paymentLink = await stripe.paymentLinks.create({
            line_items: [
                {
                    price_data: {
                        currency: paymentHistory.currency || 'usd',
                        product_data: {
                            name: finalDescription,
                        },
                        unit_amount: finalAmount,
                    },
                    quantity: 1,
                },
            ],
            allow_promotion_codes: false,
            billing_address_collection: 'required',
            phone_number_collection: {
                enabled: true,
            },
            after_completion: {
                type: 'hosted_confirmation',
                hosted_confirmation: {
                    custom_message: 'Thank you for your payment! You will receive a confirmation email and receipt shortly.',
                },
            },
            metadata: {
                originalPaymentHistoryId: paymentHistoryId,
                paymentType: 'retry',
                stripeMode: currentStripeMode,
                authorizedCustomerEmail: customerEmail,
                originalAmount: paymentHistory.amount.toString(),
                customAmount: finalAmount.toString(),
                customDescription: finalDescription,
                createdAt: new Date().toISOString()
            }
        });

        // Create immediate payment record with pending status
        const immediatePaymentHistory = new PaymentHistory({
            stripeMode: currentStripeMode,
            paymentType: 'retry',
            amount: finalAmount,
            currency: paymentHistory.currency || 'usd',
            description: finalDescription,
            status: 'pending',
            customer: paymentHistory.customer,
            expert: paymentHistory.expert,
            pendingAppointmentToGroup: paymentHistory.pendingAppointmentToGroup,
            groupChat: paymentHistory.groupChat,
            event: paymentHistory.event,
        });

        await immediatePaymentHistory.save();
        console.log('Created pending payment record:', immediatePaymentHistory._id);

        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
                <h2 style="color: #007bff; margin-top: 0;">Pending Payment Request</h2>
                <p>Hello,</p>
                
                <p>You have a pending payment for our services. Please use the link below to complete your payment:</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #333;">Payment Details</h3>
                    <p><strong>Amount:</strong> $${(finalAmount / 100).toFixed(2)} USD</p>
                    <p><strong>Description:</strong> ${finalDescription}</p>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${paymentLink.url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Complete Payment</a>
                </div>
                
                <p><strong>Payment Process:</strong></p>
                <ul>
                    <li>Click the "Complete Payment" button above</li>
                    <li>Enter your payment details securely through Stripe</li>
                    <li>You will receive a confirmation email once payment is processed</li>
                </ul>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="color: #666; font-size: 14px;">
                    If you have any questions about this payment request, please contact our support team.<br><br>
                    Best regards,<br>
                    <strong>WisdomLinked Team</strong>
                </p>
            </div>
        </div>
        `;


        const msg = {
            to: customerEmail,
            from: {
                name: "WisdomLinked",
                email: adminEmail,
            },
            subject: "Pending Payment - WisdomLinked",
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

const handleStripeWebhook = async (req, res) => {
    const stripe = require('stripe');
    const PaymentHistory = require("../models/PaymentHistory");
    const StripeWebhookEvent = require("../models/StripeWebhookEvent");
    // Released whenever processing fails, so Stripe's retry is not swallowed as a duplicate.
    let claimId: any = null;

    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.log(`Webhook signature verification failed.`, err.message);
            return res.status(400).send('Webhook signature verification failed');
        }

        console.log('Received Stripe webhook event:', event.type);

        try {
            const claim = await StripeWebhookEvent.create({ eventId: String(event.id), type: String(event.type) });
            claimId = claim._id;
        } catch (claimErr: any) {
            if (claimErr?.code === 11000) {
                console.log('[handleStripeWebhook] duplicate event ignored', event.id);
                return res.json({ received: true, duplicate: true });
            }
            console.log('[handleStripeWebhook] could not claim event', claimErr?.message);
        }

        try {
            if (
                event.type === 'payment_intent.succeeded' ||
                event.type === 'payment_intent.payment_failed' ||
                event.type === 'payment_intent.canceled'
            ) {
                // Deferred require: groupChat.controller depends on this module.
                const { handleBookingPaymentIntentEvent } = require("./groupChat.controller");
                const outcome = await handleBookingPaymentIntentEvent(event);
                console.log('[handleStripeWebhook]', event.type, event.id, outcome);
                return res.json({ received: true, outcome });
            }
        } catch (bookingErr: any) {
            console.error('[handleStripeWebhook] booking event failed', event.id, bookingErr?.message);
            if (claimId) await StripeWebhookEvent.deleteOne({ _id: claimId }).catch(() => null);
            return res.status(500).json({ status: 'FAILED', message: safeErrorMessage(bookingErr) });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            if (session.payment_link) {
                const appState = await AppState.findOne();
                const currentStripeMode = appState?.stripeMode || 'test';
                const stripeInstance = require('stripe')(currentStripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);

                const paymentLink = await stripeInstance.paymentLinks.retrieve(session.payment_link);

                if (paymentLink.metadata && paymentLink.metadata.originalPaymentHistoryId) {
                    // Security validations
                    const authorizedEmail = paymentLink.metadata.authorizedCustomerEmail;
                    const originalAmount = parseInt(paymentLink.metadata.originalAmount);

                    // Validate payment amount matches expected (original or custom)
                    const expectedAmount = parseInt(paymentLink.metadata.customAmount) || originalAmount;
                    if (session.amount_total !== expectedAmount) {
                        console.error('Security Alert: Payment amount mismatch!', {
                            expected: expectedAmount,
                            received: session.amount_total,
                            sessionId: session.id
                        });
                        return res.status(400).json({ error: BOOKING_PAYMENT_AMOUNT_INVALID });
                    }

                    // Validate customer email matches (if available in session)
                    if (session.customer_details && session.customer_details.email) {
                        if (session.customer_details.email.toLowerCase() !== authorizedEmail.toLowerCase()) {
                            console.error('Security Alert: Unauthorized email used for payment!', {
                                authorized: authorizedEmail,
                                used: session.customer_details.email,
                                sessionId: session.id
                            });
                        }
                    }

                    //Log the payment attempt
                    console.log('Processing retry payment:', {
                        sessionId: session.id,
                        authorizedEmail: authorizedEmail,
                        amount: session.amount_total,
                        paymentHistoryId: paymentLink.metadata.originalPaymentHistoryId
                    });

                    const originalPaymentHistory = await PaymentHistory.findById(String(paymentLink.metadata.originalPaymentHistoryId));

                    if (originalPaymentHistory) {
                        // Find the pending payment record we created when the link was sent
                        const pendingPayment = await PaymentHistory.findOne({
                            customer: originalPaymentHistory.customer,
                            expert: originalPaymentHistory.expert,
                            paymentType: 'retry',
                            status: 'pending',
                            amount: session.amount_total,
                            description: paymentLink.metadata.customDescription || `Retry payment for: ${originalPaymentHistory.description}`
                        }).sort({ createdAt: -1 });

                        if (pendingPayment) {
                            // Update the existing pending payment record
                            pendingPayment.status = 'completed';
                            pendingPayment.paymentIntent = session.payment_intent;
                            await pendingPayment.save();
                            console.log('Updated pending payment to completed:', pendingPayment._id);

                            // Update payment intent to send receipt
                            try {
                                const stripe = require('stripe')(paymentLink.metadata.stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
                                await stripe.paymentIntents.update(session.payment_intent, {
                                    receipt_email: authorizedEmail,
                                });
                                console.log('Updated payment intent with receipt email:', authorizedEmail);
                            } catch (receiptError) {
                                console.error('Failed to update payment intent with receipt email:', receiptError);
                                // Don't fail the payment if receipt email update fails
                            }
                        } else {
                            // Fallback: create new payment record if pending not found
                            const newPaymentHistory = new PaymentHistory({
                                stripeMode: paymentLink.metadata.stripeMode || currentStripeMode,
                                paymentType: 'retry',
                                amount: session.amount_total,
                                currency: session.currency,
                                description: paymentLink.metadata.customDescription || `Retry payment for: ${originalPaymentHistory.description}`,
                                paymentIntent: session.payment_intent,
                                status: 'completed',
                                customer: originalPaymentHistory.customer,
                                expert: originalPaymentHistory.expert,
                                pendingAppointmentToGroup: originalPaymentHistory.pendingAppointmentToGroup,
                                groupChat: originalPaymentHistory.groupChat,
                                event: originalPaymentHistory.event,
                            });

                            await newPaymentHistory.save();
                            console.log('Created retry payment history (fallback):', newPaymentHistory._id);

                            // Update payment intent to send receipt
                            try {
                                const stripe = require('stripe')(paymentLink.metadata.stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
                                await stripe.paymentIntents.update(session.payment_intent, {
                                    receipt_email: authorizedEmail,
                                });
                                console.log('Updated payment intent with receipt email (fallback):', authorizedEmail);
                            } catch (receiptError) {
                                console.error('Failed to update payment intent with receipt email (fallback):', receiptError);
                                // Don't fail the payment if receipt email update fails
                            }

                            // Log successful security validation
                            console.log('Payment security validation passed:', {
                                paymentHistoryId: newPaymentHistory._id,
                                sessionId: session.id,
                                authorizedEmail: authorizedEmail,
                                amount: session.amount_total
                            });
                        }

                        // Log successful security validation (if pending payment was found)
                        if (pendingPayment) {
                            console.log('Payment security validation passed:', {
                                paymentHistoryId: pendingPayment._id,
                                sessionId: session.id,
                                authorizedEmail: authorizedEmail,
                                amount: session.amount_total
                            });
                        }
                    }
                } else if (paymentLink.metadata.paymentType === 'adhoc') {
                    // Handle ad-hoc payment completion
                    console.log('Processing ad-hoc payment completion');

                    // Find the pending ad-hoc payment record
                    const pendingAdHocPayment = await PaymentHistory.findOne({
                        customer: paymentLink.metadata.customerId,
                        paymentType: 'adhoc',
                        status: 'pending',
                        amount: session.amount_total,
                        description: paymentLink.metadata.customDescription
                    }).sort({ createdAt: -1 });

                    if (pendingAdHocPayment) {
                        // Update the existing pending payment record
                        pendingAdHocPayment.status = 'completed';
                        pendingAdHocPayment.paymentIntent = session.payment_intent;
                        await pendingAdHocPayment.save();
                        console.log('Updated pending ad-hoc payment to completed:', pendingAdHocPayment._id);

                        // Update payment intent to send receipt
                        try {
                            const stripe = require('stripe')(paymentLink.metadata.stripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);
                            await stripe.paymentIntents.update(session.payment_intent, {
                                receipt_email: paymentLink.metadata.authorizedCustomerEmail,
                            });
                            console.log('Updated ad-hoc payment intent with receipt email:', paymentLink.metadata.authorizedCustomerEmail);
                        } catch (receiptError) {
                            console.error('Failed to update ad-hoc payment intent with receipt email:', receiptError);
                        }

                        // Log successful validation
                        console.log('Ad-hoc payment security validation passed:', {
                            paymentHistoryId: pendingAdHocPayment._id,
                            sessionId: session.id,
                            authorizedEmail: paymentLink.metadata.authorizedCustomerEmail,
                            amount: session.amount_total
                        });
                    }
                }
            }
        }

        res.json({ received: true });

    } catch (err) {
        console.log('[handleStripeWebhook]', err);
        if (claimId) await StripeWebhookEvent.deleteOne({ _id: claimId }).catch(() => null);
        return res.status(500).json({
            status: 'FAILED',
            message: safeErrorMessage(err)
        });
    }
};

const processRefund = async (req, res) => {
    try {
        const { paymentHistoryId, refundReason } = req.body;
        const refundAmount = Number(req.body.refundAmount);

        if (!paymentHistoryId) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Payment history ID is required.'
            });
        }

        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Valid refund amount is required.'
            });
        }

        if (!refundReason || !refundReason.trim()) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Refund reason is required.'
            });
        }

        const PaymentHistory = require("../models/PaymentHistory");
        const AppState = require("../models/AppState");

        // Get the payment history record
        const paymentHistory = await PaymentHistory.findById(String(paymentHistoryId)).populate(['customer', 'expert']);
        if (!paymentHistory) {
            return res.status(404).json({
                status: 'FAILED',
                message: 'Payment history not found.'
            });
        }

        // Check if payment can be refunded
        if (paymentHistory.status === 'refunded') {
            return res.status(400).json({
                status: 'FAILED',
                message: 'This payment has already been refunded.'
            });
        }

        if (paymentHistory.status === 'pending') {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Cannot refund a pending payment.'
            });
        }

        if (!paymentHistory.paymentIntent) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'No payment intent found for this payment.'
            });
        }

        // Validate refund amount doesn't exceed original payment
        const maxRefundAmount = paymentHistory.amount / 100;
        if (refundAmount > maxRefundAmount) {
            return res.status(400).json({
                status: 'FAILED',
                message: `Refund amount cannot exceed original payment amount of $${maxRefundAmount.toFixed(2)}`
            });
        }

        // Get current stripe mode
        const appState = await AppState.findOne();
        const currentStripeMode = paymentHistory.stripeMode || appState?.stripeMode || 'test';

        // Process the refund with Stripe
        const refundResult = await refundPaymentIntent(
            paymentHistory.paymentIntent,
            Math.round(refundAmount * 100),
            currentStripeMode
        );

        if (!refundResult) {
            return res.status(500).json({
                status: 'FAILED',
                message: 'Failed to process refund with Stripe.'
            });
        }

        const isFullRefund = refundAmount === maxRefundAmount;

        // Create a refund record
        const refundHistory = new PaymentHistory({
            stripeMode: currentStripeMode,
            paymentType: 'refund',
            amount: Math.round(refundAmount * 100),
            currency: paymentHistory.currency,
            description: `Refund: ${refundReason}`,
            paymentIntent: refundResult.payment_intent,
            status: isFullRefund ? 'refunded' : 'completed',
            customer: paymentHistory.customer,
            expert: paymentHistory.expert,
            pendingAppointmentToGroup: paymentHistory.pendingAppointmentToGroup,
            groupChat: paymentHistory.groupChat,
            event: paymentHistory.event,
        });

        await refundHistory.save();

        // Update the original payment status if it's a full refund
        if (isFullRefund) {
            paymentHistory.status = 'refunded';
            await paymentHistory.save();
        }

        // Send refund notification email to customer
        if (paymentHistory.customer?.email) {
            const sgMail = require("@sendgrid/mail");
            const adminEmail = "noreply@wisdomlinked.com";
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const refundType = isFullRefund ? 'Full Refund' : 'Partial Refund';

            const refundEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                    <h2 style="color: #28a745; margin-top: 0;">${refundType} Processed - WisdomLinked</h2>
                    <p>Dear Valued Customer,</p>
                    
                    <p>We have processed a refund for your payment. Here are the details:</p>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #333;">Refund Details</h3>
                        <p><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)} ${(paymentHistory.currency || 'USD').toUpperCase()}</p>
                        <p><strong>Original Payment Amount:</strong> $${maxRefundAmount.toFixed(2)} ${(paymentHistory.currency || 'USD').toUpperCase()}</p>
                        <p><strong>Refund Type:</strong> ${refundType}</p>
                        <p><strong>Reason:</strong> ${refundReason}</p>
                        <p><strong>Original Description:</strong> ${paymentHistory.description || 'N/A'}</p>
                        <p><strong>Refund Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <p><strong>What happens next?</strong></p>
                    <ul>
                        <li>The refund will appear on your original payment method within 5-10 business days</li>
                        <li>You will receive a separate notification from your bank/card provider when the refund is processed</li>
                        ${!isFullRefund ? '<li>The remaining balance on your original payment remains valid</li>' : ''}
                    </ul>
                    
                    <p>If you have any questions about this refund, please don't hesitate to contact our support team.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    
                    <p style="color: #666; font-size: 14px;">
                        Thank you for your understanding.<br>
                        Best regards,<br>
                        <strong>WisdomLinked Support Team</strong>
                    </p>
                </div>
            </div>
            `;

            const refundEmailMsg = {
                to: paymentHistory.customer.email,
                from: {
                    name: "WisdomLinked",
                    email: adminEmail,
                },
                subject: `${refundType} Confirmation - WisdomLinked`,
                html: refundEmailHtml,
            };

            try {
                await sgMail.send(refundEmailMsg);
                console.log('Refund notification email sent to:', paymentHistory.customer.email);
            } catch (emailError) {
                console.error('Failed to send refund notification email:', emailError);
                // Don't fail the refund if email fails
            }
        }

        console.log('Refund processed successfully:', {
            refundId: refundResult.id,
            paymentHistoryId: refundHistory._id,
            amount: refundAmount
        });

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Refund processed successfully.',
            refund: {
                id: refundResult.id,
                amount: refundAmount,
                currency: paymentHistory.currency,
                reason: refundReason
            }
        });

    } catch (err) {
        console.log('[processRefund]', err);
        return res.status(500).json({
            status: 'FAILED',
            message: 'Failed to process refund: ' + err.message
        });
    }
};

const sendAdHocPaymentLink = async (req, res) => {
    try {
        const { amount, description, customerEmail, customerName } = req.body;

        // Validation
        if (!amount || amount <= 0) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Valid payment amount is required.'
            });
        }

        if (!description || !description.trim()) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Payment description is required.'
            });
        }

        if (!customerEmail || !customerEmail.trim()) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Customer email is required.'
            });
        }

        // Basic email validation (length-capped to avoid ReDoS on the regex)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmedEmail = customerEmail.trim();
        if (trimmedEmail.length > 254 || !emailRegex.test(trimmedEmail)) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Valid customer email is required.'
            });
        }

        const PaymentHistory = require("../models/PaymentHistory");
        const User = require("../models/User");
        const AppState = require("../models/AppState");

        // Get current stripe mode
        const appState = await AppState.findOne();
        const currentStripeMode = appState?.stripeMode || 'test';

        // Check if customer exists, create if needed
        let customer = await User.findOne({ email: customerEmail.trim() });
        if (!customer) {
            // Create basic customer record for payment tracking
            customer = new User({
                email: customerEmail.trim(),
                name: customerName?.trim() || 'Ad-hoc Customer',
                role: 'customer',
                isActive: false, // Mark as inactive since it's just for payment
                isAdHocCustomer: true, // Flag to identify ad-hoc customers
            });
            await customer.save();
            console.log('Created ad-hoc customer record:', customer._id);
        }

        // Create Stripe payment link
        const stripe = require('stripe')(currentStripeMode === 'test' ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE);

        const finalAmount = Math.round(amount * 100); // Convert to cents
        const finalDescription = description.trim();

        const paymentLink = await stripe.paymentLinks.create({
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: finalDescription,
                        },
                        unit_amount: finalAmount,
                    },
                    quantity: 1,
                },
            ],
            allow_promotion_codes: false,
            billing_address_collection: 'required',
            phone_number_collection: {
                enabled: true,
            },
            after_completion: {
                type: 'hosted_confirmation',
                hosted_confirmation: {
                    custom_message: 'Thank you for your payment! You will receive a confirmation email and receipt shortly.',
                },
            },
            metadata: {
                paymentType: 'adhoc',
                stripeMode: currentStripeMode,
                authorizedCustomerEmail: customerEmail.trim(),
                customAmount: finalAmount.toString(),
                customDescription: finalDescription,
                createdAt: new Date().toISOString(),
                customerId: customer._id.toString(),
            }
        });

        // Create immediate payment record with pending status
        const immediatePaymentHistory = new PaymentHistory({
            stripeMode: currentStripeMode,
            paymentType: 'adhoc',
            amount: finalAmount,
            currency: 'usd',
            description: finalDescription,
            status: 'pending',
            customer: customer._id,
        });

        await immediatePaymentHistory.save();
        console.log('Created pending ad-hoc payment record:', immediatePaymentHistory._id);

        // Send payment link email
        const sgMail = require("@sendgrid/mail");
        const adminEmail = "noreply@wisdomlinked.com";
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
                <h2 style="color: #007bff; margin-top: 0;">Payment Request - WisdomLinked</h2>
                <p>Hello${customerName ? ` ${customerName}` : ''},</p>
                
                <p>You have received a payment request from WisdomLinked. Please use the link below to complete your payment:</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #333;">Payment Details</h3>
                    <p><strong>Amount:</strong> $${(finalAmount / 100).toFixed(2)} USD</p>
                    <p><strong>Description:</strong> ${finalDescription}</p>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${paymentLink.url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Complete Payment</a>
                </div>
                
                <p><strong>Payment Process:</strong></p>
                <ul>
                    <li>Click the "Complete Payment" button above</li>
                    <li>Enter your payment details securely through Stripe</li>
                    <li>You will receive a confirmation email once payment is processed</li>
                </ul>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="color: #666; font-size: 14px;">
                    If you have any questions about this payment request, please contact our support team.<br><br>
                    Best regards,<br>
                    <strong>WisdomLinked Team</strong>
                </p>
            </div>
        </div>
        `;

        const emailMsg = {
            to: customerEmail.trim(),
            from: {
                name: "WisdomLinked",
                email: adminEmail,
            },
            subject: `Payment Request - $${(finalAmount / 100).toFixed(2)} - WisdomLinked`,
            html: html,
        };

        await sgMail.send(emailMsg);
        console.log('Ad-hoc payment link email sent to:', customerEmail.trim());

        res.status(200).json({
            status: 'SUCCESS',
            message: 'Payment link sent successfully.',
            paymentHistory: {
                id: immediatePaymentHistory._id,
                amount: finalAmount,
                description: finalDescription,
                customerEmail: customerEmail.trim(),
                status: 'pending'
            }
        });

    } catch (err) {
        console.log('[sendAdHocPaymentLink]', err);
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
    checkPaymentIntentAuthorized,
    capturePaymentIntent,
    cancelPaymentIntent,
    setStripeMode,
    setSeminarApprovalDeadline,
    refundPaymentIntent,
    listReconcilableBookingIntents,
    sendPaymentLinkToUser,
    handleStripeWebhook,
    processRefund,
    sendAdHocPaymentLink,
    sendBookingReceiptAndConfirmation
}