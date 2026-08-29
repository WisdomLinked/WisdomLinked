import { Request, Response } from 'express';
import { HTTP_GENERIC_ERROR, safeHttp500Message } from '../utils/httpUserFacingCopy';
import { computeBookingPriceCents, extractHourlyRate, assertPaymentMatchesExpected, assertIntentMatchesBooking } from '../utils/bookingPrice';
const AppState = require("../models/AppState");
const Event = require("../models/Event");
const User = require("../models/User");
const FriendInvitation = require("../models/FriendInvitation");
const PaymentHistory = require("../models/PaymentHistory");
const { getFullUserData } = require("../middlewares/requireAuth");
const { checkPaymentIntentSucceeded, refundPaymentIntent, sendBookingReceiptAndConfirmation } = require("./stripe.controller");
const { appendPaymentHistory } = require("./payment.controller");
const { checkTitleNameInvalid } = require('../services/global')
const { sendEmailMeetingRequestToExpert, sendEmailMeetingRequestToCustomer, scheduleEmailReminder, sendEmailMeetingAcceptance, sendNotificationEmail } = require('../services/notifications')
const {
    renderEmail: renderEventEmail,
    moneyFromCents: eventMoneyFromCents,
    formatWhen: eventWhen,
    paragraph: eventParagraph,
    facts: eventFacts,
    callout: eventCallout,
    escapeHtml: eventEscape,
} = require('../services/emailTemplate')
const { assertBookingLeadTime } = require("../utils/bookingLeadTime");
const { assertBookingSlotValid, assertDurationAllowed } = require("../utils/bookingValidation");

const createEventByExpert = async (req, res) => {
    try {
        const { title, start, end, duration, price, expert, customer, createdBy } = req.body

        if (checkTitleNameInvalid('Title', title)) {
            throw new Error(checkTitleNameInvalid('Title', title))
        }

        // check if the invited user exists in the database
        const expertUser = await User.findOne({ email: String(expert) });
        const customerUser = await User.findOne({ email: String(customer) })
        if (!expertUser || !customerUser) {
            return res
                .status(404)
                .send(
                    "Sorry, the user you are trying to invite doesn't exist. Please check the email address"
                );
        }

        const newEvent = new Event({
            title: title,
            start: start,
            end: end,
            duration: duration,
            price: price,
            paidBy: 'none',
            expert: expertUser._id,
            customer: customerUser._id,
            status: 'pending',
            createdBy: createdBy
        })

        const event = await newEvent.save()

        let userDetails = await User.findByIdAndUpdate(expertUser._id, { events: [...expertUser.events, event._id] }, { new: true })
        let newCustomer = await User.findByIdAndUpdate(customerUser._id, { events: [...customerUser.events, event._id] }, { new: true })
        userDetails = await getFullUserData(userDetails.email)
        userDetails.token = null
        userDetails.password = null

        sendEmailMeetingRequestToCustomer(customerUser.email, expertUser.username, customerUser.username, start, duration, price, customerUser.timeZone)

        // check if invitation has already been sent
        const invitationAlreadyExists = await FriendInvitation.findOne({
            senderId: customerUser._id,
            receiverId: expertUser._id,
        });

        if (invitationAlreadyExists) {
            await FriendInvitation.findByIdAndUpdate(invitationAlreadyExists._id, { events: [...invitationAlreadyExists.events, event._id] }, { new: true })
            return res.status(200).json({
                result: 'Appended new event to the invitation, customer and user',
                userDetails: userDetails,
                newEventId: event._id
            });
        }

        // check if the invited user is already a friend of the sender
        const isAlreadyFriend = expertUser.friends.some(
            (friend) => friend.toString() === customerUser._id.toString()
        );

        if (isAlreadyFriend) {
            return res.status(200).json({
                result: 'Appended new event to the customer and expert',
                userDetails: userDetails,
                newEventId: event._id
            });
        }

        // create invitation

        await FriendInvitation.create({
            senderId: customerUser._id,
            receiverId: expertUser._id,
            events: [event._id]
        });



        return res.status(200).json({
            result: 'Created new invitation',
            userDetails: userDetails,
            newEventId: event._id
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const appendEvent = async (req, res) => {
    try {
        const { title, start, end, duration, paidBy, expert, customer, payment_intent, eventId, createdBy } = req.body


        console.log("append event ", createdBy)
        if (checkTitleNameInvalid('Title', title)) {
            throw new Error(checkTitleNameInvalid('Title', title))
        }

        if (typeof expert !== 'string' || typeof customer !== 'string') {
            return res.status(400).send('Invalid expert/customer email');
        }

        const expertUser = await User.findOne({ email: String(expert) });
        const customerUser = await User.findOne({ email: String(customer) });
        if (!expertUser || !customerUser) {
            return res
                .status(404)
                .send("Sorry, the user you are trying to invite doesn't exist. Please check the email address");
        }
        
        const expectedCents = computeBookingPriceCents(Number(duration), extractHourlyRate(expertUser.price));

        let paymentIntentSucceeded_test: any = false;
        let paymentIntentSucceeded_live: any = false;
        if (expectedCents > 0) {
            // One intent, one booking — without this the same payment could be replayed
            // to accept any number of events.
            const alreadyUsed = await PaymentHistory.exists({
                paymentIntent: String(payment_intent),
                paymentType: 'charge',
            });
            if (alreadyUsed) {
                return res.status(409).send("This payment has already been used for a booking.");
            }
            // Pinned to the configured mode, so a test-mode intent can never satisfy a
            // live booking (or the reverse).
            const appState = await AppState.findOne();
            const serverMode = appState?.stripeMode === 'live' ? 'live' : 'test';
            const succeeded = await checkPaymentIntentSucceeded(payment_intent, serverMode);
            paymentIntentSucceeded_test = serverMode === 'test' ? succeeded : false;
            paymentIntentSucceeded_live = serverMode === 'live' ? succeeded : false;

            if (succeeded) {
                // The intent must name this payer and this expert.
                assertIntentMatchesBooking(succeeded, {
                    userId: String(req.user?.userId ?? customerUser._id),
                    expertId: String(expertUser._id),
                });
            }
        }
        const charge = assertPaymentMatchesExpected(expectedCents, payment_intent, paymentIntentSucceeded_test, paymentIntentSucceeded_live);

        assertBookingLeadTime(expertUser, start);
        assertDurationAllowed(expertUser, duration);

        let eventExists
        if (eventId) {
            eventExists = await Event.findById(String(eventId))
            if (!eventExists) {
                return res.status(404).send("Sorry, the invitation you are trying to accept doesn't exist")
            }
        }

        await assertBookingSlotValid(expertUser, start, end, {
            excludeEventId: eventExists?._id?.toString(),
        });

        console.log('[checkEvent]', eventId, eventExists)
        if (eventExists) {
            if (charge) {
                eventExists.paidBy = charge.paidBy;
            }
            eventExists.status = 'accepted'
            eventExists.start = start
            eventExists.end = end
            eventExists.duration = duration
            await eventExists.save()

            sendEmailMeetingAcceptance(expertUser.email, expertUser.username, customerUser.username, start, duration, expertUser.timeZone);

            if (charge) {
                await appendPaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: title,
                    paymentIntent: payment_intent,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                    balanceTransaction: charge.balanceTransaction ?? null,
                    customer: customerUser._id.toString(),
                    expert: expertUser._id.toString(),
                    event: eventExists._id.toString(),
                });

                await sendBookingReceiptAndConfirmation({
                    payment_intent,
                    charge,
                    sessionType: '1:1 Session',
                    sessionName: title,
                    expertName: expertUser.username,
                    studentName: customerUser.username,
                    studentEmail: customerUser.email,
                    start,
                    duration,
                    timeZone: customerUser.timeZone,
                });
            }

            const invitationExists = await FriendInvitation.findOne({
                senderId: customerUser._id,
                receiverId: expertUser._id,
            });

            if (invitationExists) {
                await FriendInvitation.findByIdAndDelete(
                    invitationExists._id
                );

                // update friends list of both users in the database
                const sender = await User.findById(customerUser._id);
                const receiver = await User.findById(expertUser._id);

                sender.friends.push(receiver._id);
                receiver.friends.push(sender._id);

                await sender.save();
                await receiver.save();

            }
            const userDetails = await getFullUserData(customer)
            return res.status(200).json({
                result: 'Created new invitation',
                userDetails: userDetails,
                newEvent: eventExists
            });
        } else {
            sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, title, start, duration, expectedCents / 100, true, expertUser.timeZone, charge ? 'paid' : undefined, { studentName: customerUser.username })
            const newEvent = new Event({
                title: title,
                start: start,
                end: end,
                duration: duration,
                price: expectedCents / 100,
                paidBy: charge ? charge.paidBy : undefined,
                expert: expertUser._id,
                customer: customerUser._id,
                status: 'pending',
                createdBy: createdBy
            })
            console.log("append event inside else", newEvent, createdBy)

            const event = await newEvent.save()

            if (charge) {
                await appendPaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: title,
                    paymentIntent: payment_intent,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                    balanceTransaction: charge.balanceTransaction ?? null,
                    customer: customerUser._id.toString(),
                    expert: expertUser._id.toString(),
                    event: event._id.toString(),
                });

                await sendBookingReceiptAndConfirmation({
                    payment_intent,
                    charge,
                    sessionType: '1:1 Session',
                    sessionName: title,
                    expertName: expertUser.username,
                    studentName: customerUser.username,
                    studentEmail: customerUser.email,
                    start,
                    duration,
                    timeZone: customerUser.timeZone,
                });
            }

            const newExpert = await User.findByIdAndUpdate(expertUser._id, { events: [...expertUser.events, event._id] }, { new: true })
            let userDetails = await User.findByIdAndUpdate(customerUser._id, { events: [...customerUser.events, event._id] }, { new: true })
            userDetails = await getFullUserData(userDetails.email)
            userDetails.token = null
            userDetails.password = null

            // check if invitation has already been sent
            const invitationAlreadyExists = await FriendInvitation.findOne({
                senderId: customerUser._id,
                receiverId: expertUser._id,
            });

            if (invitationAlreadyExists) {
                await FriendInvitation.findByIdAndUpdate(invitationAlreadyExists._id, { events: [...invitationAlreadyExists.events, event._id] }, { new: true })
                return res.status(200).json({
                    result: 'Appended new event to the invitation, customer and user',
                    userDetails: userDetails,
                    newEventId: event._id
                });
            }

            // check if the invited user is already a friend of the sender
            const isAlreadyFriend = expertUser.friends.some(
                (friend) => friend.toString() === customerUser._id.toString()
            );

            if (isAlreadyFriend) {
                return res.status(200).json({
                    result: 'Appended new event to the customer and user',
                    userDetails: userDetails,
                    newEventId: event._id
                });
            }

            // create invitation

            await FriendInvitation.create({
                senderId: customerUser._id,
                receiverId: expertUser._id,
                events: [event._id]
            });


            return res.status(200).json({
                result: 'Created new invitation',
                userDetails: userDetails,
                newEvent: event
            });
        }
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeHttp500Message(err));
    }
}

const updateEvent = async (req, res) => {
    try {
        const { updates } = req.body;
        const eventId = String(req.body.eventId);

        // Find the event by ID
        const event = await Event.findById(eventId);

        if (!event) {
            throw new Error("Event not found");
        }

        // A finished event is a record of what happened, so its details are frozen
        // whatever its status — only the post-meeting time tally may still be added.
        const onlyTimeTally = Object.keys(updates || {}).every((key) => key === 'totalTimeSpent');
        if (!onlyTimeTally && new Date(event.end).getTime() <= new Date().getTime()) {
            return res.status(409).send("This appointment has already finished and can no longer be edited.");
        }

        if (updates.title && checkTitleNameInvalid('Title', updates.title)) {
            throw new Error(checkTitleNameInvalid('Title', updates.title));
        }

        // Prepare the updated data
        const newEventData: Record<string, any> = {};

        if (updates.title) {
            newEventData.title = updates.title;
        }

        if (updates.start) {
            newEventData.start = updates.start;
        }

        if (updates.end) {
            newEventData.end = updates.end;
        }

        if (updates.status) {
            newEventData.status = updates.status;
            const expert = await User.findById(event.expert);
            const customer = await User.findById(event.customer);
            sendEmailMeetingRequestToExpert(expert.email, expert.username, event.title, updates.start, event.duration, event.price, false, expert.timeZone, undefined, { studentName: customer.username });
        }

        if (updates.totalTimeSpent) {
            // Append new totalTimeSpent to the existing value
            const existingTotalTimeSpent = event.totalTimeSpent || 0; // Default to 0 if not set
            newEventData.totalTimeSpent = existingTotalTimeSpent + updates.totalTimeSpent;
        }

        // Update the event and return the updated document
        const updatedEvent = await Event.findByIdAndUpdate(eventId, newEventData, { new: true });

        res.status(200).json({
            result: updatedEvent,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};


const acceptEvent = async (req, res) => {
    try {
        const eventId = String(req.body.eventId)
        const event = await Event.findById(eventId)
        if (!event)
            throw new Error("No event found with provided id")

        if (new Date(event.end).getTime() <= new Date().getTime()) {
            throw new Error("Unable to accept past or ongoing event")
        }

        const updatedEvent = await Event.findByIdAndUpdate(eventId, { status: 'accepted' }, { new: true })

        const invitationExists = await FriendInvitation.findOne({
            senderId: event.customer,
            receiverId: event.expert,
        });

        const sender = await User.findById(event.customer);
        const receiver = await User.findById(event.expert);

        //
        sendEmailMeetingAcceptance(sender.email, sender.username, receiver.username, updatedEvent.start, updatedEvent.duration, sender.timeZone);

        // Sending email reminders to both users
        scheduleEmailReminder(sender.email, sender.username, receiver.username, updatedEvent.start, updatedEvent.duration, sender.timeZone);
        scheduleEmailReminder(receiver.email, receiver.username, sender.username, updatedEvent.start, updatedEvent.duration, receiver.timeZone);

        if (invitationExists) {
            await FriendInvitation.findByIdAndDelete(
                invitationExists._id
            );

            // update friends list of both users in the database

            sender.friends.push(receiver._id);
            receiver.friends.push(sender._id);

            await sender.save();
            await receiver.save();

        }

        res.status(200).json({
            result: updatedEvent
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const declineEvent = async (req, res) => {
    try {
        const eventId = String(req.body.eventId)
        const event = await Event.findById(eventId)
        if (!event)
            throw new Error("No event found with provided id")
        const updatedEvent = await Event.findByIdAndUpdate(eventId, { status: 'declined' }, { new: true })
        const invitationExists = await FriendInvitation.findOne({
            senderId: event.customer,
            receiverId: event.expert,
        });

        if (invitationExists) {
            // reject the invitation
            await FriendInvitation.findByIdAndDelete(invitationExists._id);

        }
        res.status(200).json({
            result: updatedEvent
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const cancelInvitation = async (req, res) => {
    try {
        const eventId = String(req.body.eventId)
        const event = await Event.findById(eventId)
        if (!event)
            throw new Error("No event found with provided id")

        const expert = await User.findById(event.expert)
        expert.events = expert.events.filter(x => x.toString() !== eventId)
        await expert.save()

        const customer = await User.findById(event.customer)
        customer.events = customer.events.filter(x => x.toString() !== eventId)
        await customer.save()

        const invitationExists = await FriendInvitation.findOne({
            senderId: event.customer,
            receiverId: event.expert,
        });

        await event.deleteOne()

        if (invitationExists) {
            // reject the invitation
            await FriendInvitation.findByIdAndDelete(invitationExists._id);

        }

        res.status(200).json({
            result: 'SUCCESS'
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const notifyCancelledEventRefund = async ({ event, expert, customer, payment, transactionId }) => {
    const amount = eventMoneyFromCents(payment.amount, payment.currency)
    const when = eventWhen(event.start, customer?.timeZone)
    const expertWhen = eventWhen(event.start, expert?.timeZone)
    try {
        if (customer?.email) {
            await sendNotificationEmail(
                customer.email,
                `Session cancelled — ${amount} refunded`,
                renderEventEmail({
                    heading: 'Your session has been cancelled',
                    previewText: 'Your payment has been refunded in full.',
                    blocks: [
                        eventParagraph(`Your session${event.title ? ` <strong>${eventEscape(event.title)}</strong>` : ''} has been cancelled.`),
                        eventFacts([
                            ['Session', event.title],
                            ['Expert', expert?.username],
                            ['Date & time', when],
                            ['Refunded', amount],
                            ['Transaction ID', transactionId || payment?.paymentIntent],
                        ]),
                        eventCallout(`Your payment of <strong>${amount}</strong> has been refunded in full. It will be credited to your original payment method and may take 5–10 business days to appear, depending on your bank. No action is required from you.`, 'bad'),
                        eventParagraph('If the refund has not reached you within 10 business days, contact the administrator through WisdomLinked quoting the transaction ID above.', { muted: true }),
                    ],
                }),
            )
        }
        if (expert?.email) {
            await sendNotificationEmail(
                expert.email,
                `Session cancelled — ${event.title || '1:1 session'}`,
                renderEventEmail({
                    heading: 'Your session has been cancelled',
                    blocks: [
                        eventParagraph(`Your session with ${eventEscape(customer?.username || 'the student')} has been cancelled.`),
                        eventFacts([
                            ['Session', event.title],
                            ['Student', customer?.username],
                            ['Date & time', expertWhen],
                            ['Transaction ID', transactionId || payment?.paymentIntent],
                        ]),
                        eventCallout(`The student's payment of ${amount} has been refunded in full. No action is required from you.`),
                    ],
                }),
            )
        }
    } catch (emailErr) {
        console.log('[cancelEvent] cancellation email failed', emailErr?.message || emailErr)
    }
}

const cancelEvent = async (req, res) => {
    try {
        const eventId = String(req.body.eventId)
        const event = await Event.findById(eventId)
        if (!event)
            throw new Error("No event found with provided id")

        if (event.status === 'accepted' && new Date(event.start).getTime() <= new Date().getTime()) {
            throw new Error("Unable to cancel past or ongoing event")
        }

        const expert = await User.findById(event.expert)
        expert.events = expert.events.filter(x => x.toString() !== eventId)
        await expert.save()

        const customer = await User.findById(event.customer)
        customer.events = customer.events.filter(x => x.toString() !== eventId)
        await customer.save()

        const payment = await PaymentHistory.findOne({ event: eventId })
        if (payment) {
            const refund = await refundPaymentIntent(payment.paymentIntent, payment.amount, payment.stripeMode)
            if (refund) {
                appendPaymentHistory({
                    stripeMode: payment.stripeMode,
                    amount: payment.amount,
                    currency: payment.currency,
                    description: payment.description,
                    customer: payment.customer,
                    expert: payment.expert,
                    pendingAppointmentToGroup: payment.pendingAppointmentToGroup,
                    groupChat: payment.groupChat,
                    event: payment.event,
                    paymentType: 'refund',
                    paymentIntent: refund.payment_intent,
                })

                await notifyCancelledEventRefund({ event, expert, customer, payment, transactionId: refund.payment_intent })
            } else {
                console.error('[cancelEvent] refund failed — reconcile manually', payment.paymentIntent)
            }
        }

        res.status(200).json({
            result: 'SUCCESS'
        })
    } catch (err) {
        console.log(err.message)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const getMyEvents = async (req, res) => {
    try {
        const { email } = req.user

        const user = await getFullUserData(email)
        user.token = null
        user.password = null
        res.status(200).json({
            result: user,
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const getEventsBetweenCustomerAndExpert = async (req, res) => {
    try {
        const { isOngoing } = req.body
        const expertId = String(req.body.expertId)
        const customerId = String(req.body.customerId)

        const query: Record<string, any> = { expert: expertId, customer: customerId }
        if (isOngoing) {
            query.start = { $lte: new Date() }
            query.end = { $gt: new Date() }
        }
        const result = await Event.find(query)

        res.status(200).json({
            result: result,
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const checkIfTheEventOngoing = async (participants, eventId) => {
    try {
        console.log('[checkIfTheEventOngoing]', participants, eventId)
        const event = await Event.find({
            $or: [
                { expert: participants[0], customer: participants[1], _id: eventId, start: { $lte: new Date() }, end: { $gt: new Date() } },
                { expert: participants[1], customer: participants[0], _id: eventId, start: { $lte: new Date() }, end: { $gt: new Date() } }
            ]
        })
        if (!event) {
            throw new Error('No Event Found')
        }
        return true
    } catch (err) {
        console.log(err)
        return false
    }
}

const createFeedback = async (req, res) => {
    try {
        const { updateData } = req.body;
        const _id = String(req.body._id);

        if (!_id || !updateData) {
            return res.status(400).json({ error: "Event ID and feedback details are required." });
        }

        // Find the event by ID
        const event = await Event.findById(_id);

        if (!event) {
            return res.status(404).json({ error: "Event not found." });
        }

        // Check if feedback from the same user already exists
        const existingFeedbackIndex = event.feedback.findIndex(
            (feedback) => feedback.userId === updateData.userId
        );

        console.log("existing feedback:", existingFeedbackIndex);

        if (existingFeedbackIndex !== -1) {
            // Update the existing feedback
            event.feedback[existingFeedbackIndex] = updateData;
        } else {
            // Add new feedback if no existing feedback is found
            event.feedback.push(updateData);
        }

        // Save the updated event
        await event.save();

        res.status(200).json({
            message: "Feedback processed successfully.",
            feedback: updateData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while processing feedback." });
    }
};


// Get Feedback
const getFeedback = async (req, res) => {
    try {
        const _id = String(req.body._id);

        if (!_id) {
            return res.status(400).json({ error: "Event ID is required." });
        }

        // Find the event by ID and populate feedback if needed
        const event = await Event.findById(_id).select("feedback");

        if (!event) {
            return res.status(404).json({ error: "Event not found." });
        }

        res.status(200).json({ feedback: event.feedback });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while retrieving feedback." });
    }
};

module.exports = {
    appendEvent,
    updateEvent,
    getMyEvents,
    acceptEvent,
    declineEvent,
    getEventsBetweenCustomerAndExpert,
    checkIfTheEventOngoing,
    createEventByExpert,
    cancelInvitation,
    cancelEvent,
    createFeedback,
    getFeedback
}
