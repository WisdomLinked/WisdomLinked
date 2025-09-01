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
        
        const refundData = {
            payment_intent: payment_intent,
        };
        
        // Add amount if specified (for partial refunds)
        if (amount) {
            refundData.amount = Math.round(amount * 100); // Convert to cents
        }
        
        const refund = await stripe.refunds.create(refundData);
        console.log('Refund succeeded', refund);
        return refund
    } catch (err) {
        console.log('[refundPaymentIntent]', err.message)
        return false
    }
}

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
        console.log("PAYMENT LINK ->", paymentLink.url)
        
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
        console.log('Created immediate pending payment record:', immediatePaymentHistory._id);
        
        const html = `
        <p>Hello,</p>
        <p>You have a pending payment for our services. Please use the link below to complete your payment:</p>
        <p><strong>Amount:</strong> $${(finalAmount / 100).toFixed(2)} ${(paymentHistory.currency || 'USD').toUpperCase()}</p>
        <p><strong>Description:</strong> ${finalDescription}</p>
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

const handleStripeWebhook = async (req, res) => {
    const stripe = require('stripe');
    const PaymentHistory = require("../models/PaymentHistory");
    
    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        let event;
        
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.log(`Webhook signature verification failed.`, err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        
        console.log('Received Stripe webhook event:', event.type);
        
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
                        return res.status(400).json({ error: 'Payment amount validation failed' });
                    }
                    
                    // Validate customer email matches (if available in session)
                    if (session.customer_details && session.customer_details.email) {
                        if (session.customer_details.email.toLowerCase() !== authorizedEmail.toLowerCase()) {
                            console.error('Security Alert: Unauthorized email used for payment!', {
                                authorized: authorizedEmail,
                                used: session.customer_details.email,
                                sessionId: session.id
                            });
                            // Note: We could choose to reject this, but since payment was made, 
                            // we'll log it and proceed, but flag for admin review
                        }
                    }
                    
                    // Additional security: Log the payment attempt
                    console.log('Processing retry payment:', {
                        sessionId: session.id,
                        authorizedEmail: authorizedEmail,
                        amount: session.amount_total,
                        paymentHistoryId: paymentLink.metadata.originalPaymentHistoryId
                    });
                    
                    const originalPaymentHistory = await PaymentHistory.findById(paymentLink.metadata.originalPaymentHistoryId);
                    
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
                        }
                        
                        // Send payment confirmation email for retry payments
                        if (paymentLink.metadata.paymentType === 'retry' && authorizedEmail) {
                            const sgMail = require("@sendgrid/mail");
                            const adminEmail = "admin@wisdomlinked.com";
                            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                            
                            const confirmationEmailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #31B099;">
                                    <h2 style="color: #31B099; margin-top: 0;">✅ Payment Confirmation</h2>
                                    <p>Dear Valued Customer,</p>
                                    
                                    <p>Thank you! Your payment has been successfully processed.</p>
                                    
                                    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                        <h3 style="margin-top: 0; color: #333;">Payment Details</h3>
                                        <p><strong>Amount:</strong> $${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}</p>
                                        <p><strong>Description:</strong> ${paymentLink.metadata.customDescription || 'Service Payment'}</p>
                                        <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
                                        <p><strong>Payment ID:</strong> ${session.payment_intent}</p>
                                    </div>
                                    
                                    <p><strong>What's next?</strong></p>
                                    <ul>
                                        <li>You will receive a separate receipt from Stripe with detailed payment information</li>
                                        <li>This payment confirms your service access as described</li>
                                        <li>If you have any questions, please contact our support team</li>
                                    </ul>
                                    
                                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                                    
                                    <p style="color: #666; font-size: 14px;">
                                        Thank you for choosing WisdomLinked!<br>
                                        Best regards,<br>
                                        <strong>WisdomLinked Team</strong>
                                    </p>
                                </div>
                            </div>
                            `;
                            
                            const confirmationEmailMsg = {
                                to: authorizedEmail,
                                from: {
                                    name: "WisdomLinked",
                                    email: adminEmail,
                                },
                                subject: `Payment Confirmation - $${(session.amount_total / 100).toFixed(2)} - WisdomLinked`,
                                html: confirmationEmailHtml,
                            };
                            
                            try {
                                await sgMail.send(confirmationEmailMsg);
                                console.log('Payment confirmation email sent to:', authorizedEmail);
                            } catch (emailError) {
                                console.error('Failed to send payment confirmation email:', emailError);
                                // Don't fail the webhook if email fails
                            }
                        }
                        
                        // Log successful security validation
                        const paymentRecordId = pendingPayment ? pendingPayment._id : newPaymentHistory._id;
                        console.log('Payment security validation passed:', {
                            paymentHistoryId: paymentRecordId,
                            sessionId: session.id,
                            authorizedEmail: authorizedEmail,
                            amount: session.amount_total
                        });
                    }
                }
            }
        }
        
        res.json({received: true});
        
    } catch (err) {
        console.log('[handleStripeWebhook]', err);
        return res.status(500).json({
            status: 'FAILED',
            message: 'Webhook processing failed: ' + err.message
        });
    }
};

const processRefund = async (req, res) => {
    try {
        const { paymentHistoryId, refundAmount, refundReason } = req.body;
        
        if (!paymentHistoryId) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Payment history ID is required.'
            });
        }
        
        if (!refundAmount || refundAmount <= 0) {
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
        const paymentHistory = await PaymentHistory.findById(paymentHistoryId).populate(['customer', 'expert']);
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
            refundAmount,
            currentStripeMode
        );
        
        if (!refundResult) {
            return res.status(500).json({
                status: 'FAILED',
                message: 'Failed to process refund with Stripe.'
            });
        }
        
        // Create a refund record
        const refundHistory = new PaymentHistory({
            stripeMode: currentStripeMode,
            paymentType: 'refund',
            amount: -Math.round(refundAmount * 100), // Negative amount for refunds
            currency: paymentHistory.currency,
            description: `Refund: ${refundReason}`,
            paymentIntent: refundResult.payment_intent,
            status: 'completed',
            customer: paymentHistory.customer,
            expert: paymentHistory.expert,
            pendingAppointmentToGroup: paymentHistory.pendingAppointmentToGroup,
            groupChat: paymentHistory.groupChat,
            event: paymentHistory.event,
        });
        
        await refundHistory.save();
        
        // Update the original payment status if it's a full refund
        if (refundAmount === maxRefundAmount) {
            paymentHistory.status = 'refunded';
            await paymentHistory.save();
        }
        
        // Send refund notification email to customer
        if (paymentHistory.customer?.email) {
            const sgMail = require("@sendgrid/mail");
            const adminEmail = "admin@wisdomlinked.com";
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            
            const isFullRefund = refundAmount === maxRefundAmount;
            const refundType = isFullRefund ? 'Full Refund' : 'Partial Refund';
            
            const refundEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                    <h2 style="color: #28a745; margin-top: 0;">✅ ${refundType} Processed</h2>
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

module.exports = {
    stripePay,
    createStripePaymentIntent,
    getStripeMode,
    checkPaymentIntentSucceeded,
    setStripeMode,
    refundPaymentIntent,
    sendPaymentLinkToUser,
    handleStripeWebhook,
    processRefund
}