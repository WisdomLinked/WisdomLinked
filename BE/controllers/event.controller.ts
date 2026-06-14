import { Request, Response } from 'express';
import { HTTP_GENERIC_ERROR, safeHttp500Message } from '../utils/httpUserFacingCopy';
import { computeBookingPriceCents, extractHourlyRate, assertPaymentMatchesExpected } from '../utils/bookingPrice';
const Event = require("../models/Event");
const User = require("../models/User");
const FriendInvitation = require("../models/FriendInvitation");
const PaymentHistory = require("../models/PaymentHistory");
const { getFullUserData } = require("../middlewares/requireAuth");
const { checkPaymentIntentSucceeded, refundPaymentIntent } = require("./stripe.controller");
const { appendPaymentHistory } = require("./payment.controller");
const { checkTitleNameInvalid } = require('../services/global')
const { sendEmailMeetingRequestToExpert, sendEmailMeetingRequestToCustomer, scheduleEmailReminder, sendEmailMeetingAcceptance } = require('../services/notifications')
const { assertBookingLeadTime } = require("../utils/bookingLeadTime");
const { assertBookingSlotValid, assertDurationAllowed } = require("../utils/bookingValidation");

const createEventByExpert = async (req, res) => {
    try {
        const { title, start, end, duration, price, expert, customer, createdBy } = req.body

        if (checkTitleNameInvalid('Title', title)) {
            throw new Error(checkTitleNameInvalid('Title', title))
        }

        // check if the invited user exists in the database
        const expertUser = await User.findOne({ email: expert });
        const customerUser = await User.findOne({ email: customer })
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

        const expertUser = await User.findOne({ email: expert });
        const customerUser = await User.findOne({ email: customer });
        if (!expertUser || !customerUser) {
            return res
                .status(404)
                .send("Sorry, the user you are trying to invite doesn't exist. Please check the email address");
        }
        
        const expectedCents = computeBookingPriceCents(Number(duration), extractHourlyRate(expertUser.price));

        let paymentIntentSucceeded_test: any = false;
        let paymentIntentSucceeded_live: any = false;
        if (expectedCents > 0) {
            paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test');
            paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live');
        }
        const charge = assertPaymentMatchesExpected(expectedCents, payment_intent, paymentIntentSucceeded_test, paymentIntentSucceeded_live);

        assertBookingLeadTime(expertUser, start);
        assertDurationAllowed(expertUser, duration);

        let eventExists
        if (eventId) {
            eventExists = await Event.findById(eventId)
            if (!eventExists) {
                return res.status(404).send("Sorry, the invitation you are trying to accept doesn't exist")
            }
        }

        await assertBookingSlotValid(expertUser, start, end, {
            excludeEventId: eventExists?._id?.toString(),
        });

        console.log(eventId, eventExists)
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
                    customer: customerUser._id.toString(),
                    expert: expertUser._id.toString(),
                    event: eventExists._id.toString(),
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
            sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, customerUser.username, start, duration, expectedCents / 100, true, expert.timeZone)
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
                    customer: customerUser._id.toString(),
                    expert: expertUser._id.toString(),
                    event: event._id.toString(),
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
        const { eventId, updates } = req.body;

        // Find the event by ID
        const event = await Event.findById(eventId);

        if (!event) {
            throw new Error("Event not found");
        }

        // Check for invalid updates or constraints
        if (event.status === 'accepted' && new Date(event.end).getTime() <= new Date().getTime()) {
            throw new Error("Unable to update past or ongoing event");
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
            sendEmailMeetingRequestToExpert(expert.email, expert.username, customer.username, updates.start, event.duration, event.price, false, expert.timeZone);
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
        const { eventId } = req.body
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
        const { eventId } = req.body
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
        const { eventId } = req.body
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

const cancelEvent = async (req, res) => {
    try {
        const { eventId } = req.body
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
        console.log(payment, '///')
        if (payment) {
            const refund = await refundPaymentIntent(payment.paymentIntent, payment.amount, payment.stripeMode)
            console.log(refund, '///')
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
        const { expertId, customerId, isOngoing } = req.body

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
        console.log(participants, eventId)
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
        const { _id, updateData } = req.body;

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
        const { _id } = req.body;

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
