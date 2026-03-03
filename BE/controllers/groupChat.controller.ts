import { Request, Response } from 'express';
const mongoose = require("mongoose");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const PendingAppointmentToGroup = require("../models/PendingAppointmentToGroup");
const PaymentHistory = require("../models/PaymentHistory");
const {
    updateUsersGroupChatList, updateRooms,
} = require("../socketControllers/notifyConnectedSockets");
const { updateActiveRoomsOfUsers } = require("../socket/activeRooms");
const { checkPaymentIntentSucceeded, refundPaymentIntent } = require("./stripe.controller");
const { appendPaymentHistory } = require("./payment.controller");
const { getFullUserData } = require("../middlewares/requireAuth");
const { checkTitleNameInvalid } = require('../services/global')
const { scheduleEmailReminder, sendEmailMeetingRequestToCustomer, sendEmailMeetingRequestToExpert, sendEmailMeetingAcceptance } = require('../services/notifications')

const createGeneralChatAndJoinGlobalChat = async (expertId) => {
    try {
        const currentUser = await User.findById(expertId);

        // Join global chat (now replaced with community chat concept)
        // This function can be deprecated but kept for backward compatibility
        // New users should join community chats instead

        return true;
    } catch (err) {
        console.log('[createGeneralChatAndJoinGlobalChat]', err.message)
        return false;
    }
}

const createCommunityChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, participants, isOpenToAll } = req.body;

        // Validate name
        if (!name || !name.trim()) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Community chat name is required'
            });
        }

        if (checkTitleNameInvalid('Name', name)) {
            return res.status(400).json({
                status: 'FAIL',
                error: checkTitleNameInvalid('Name', name)
            });
        }

        // Check if community chat with same name already exists for this user
        const existingChat = await GroupChat.findOne({
            name: name.trim(),
            type: 'community',
            admin: userId
        });

        if (existingChat) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Community chat with this name already exists'
            });
        }

        // Prepare participants array - always include the creator (admin)
        const participantsArray = Array.isArray(participants) ? participants : [];
        const uniqueParticipants = [...new Set([userId, ...participantsArray])];

        // Validate that all participant IDs exist
        const validParticipants = await User.find({
            _id: { $in: uniqueParticipants }
        }).select('_id');

        const validParticipantIds = validParticipants.map(p => p._id.toString());
        const finalParticipants = uniqueParticipants.filter(id => validParticipantIds.includes(id.toString()));

        // Create community chat
        const communityChat = await GroupChat.create({
            name: name.trim(),
            description: description || '',
            type: 'community',
            status: 'active',
            start: 0,
            end: 0,
            duration: 0,
            price: 0,
            participants: finalParticipants,
            admin: userId,
            createdBy: userId,
            isOpenToAll: isOpenToAll === true,
        });

        // Add chat to all participants' generalChats arrays
        const participantsToUpdate = finalParticipants;
        await User.updateMany(
            { _id: { $in: participantsToUpdate } },
            { $addToSet: { generalChats: communityChat._id } }
        );

        // Update all participants' chat lists via socket
        participantsToUpdate.forEach(participantId => {
            updateUsersGroupChatList(participantId.toString());
        });

        // Get full user data
        const currentUser = await User.findById(userId);
        const fullUser = await getFullUserData(currentUser.email);
        fullUser.token = null;
        fullUser.password = null;

        return res.status(200).json({
            status: 'SUCCESS',
            chat: communityChat,
            user: fullUser
        });
    } catch (err) {
        console.log('[createCommunityChat]', err.message);
        return res.status(500).json({
            status: 'FAIL',
            error: err.message
        });
    }
}

const addParticipantsToCommunityChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { communityChatId, participantIds } = req.body;

        if (!communityChatId) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Community chat ID is required'
            });
        }

        if (!Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'At least one participant ID is required'
            });
        }

        // Find the community chat
        const communityChat = await GroupChat.findOne({
            _id: communityChatId,
            type: 'community'
        });

        if (!communityChat) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'Community chat not found'
            });
        }

        // Only admin can add participants
        if (communityChat.admin.toString() !== userId) {
            return res.status(403).json({
                status: 'FAIL',
                error: 'Only the admin can add participants to this community chat'
            });
        }

        // Validate that all participant IDs exist
        const validParticipants = await User.find({
            _id: { $in: participantIds }
        }).select('_id');

        const validParticipantIds = validParticipants.map(p => p._id.toString());
        const newParticipantIds = participantIds.filter(id =>
            validParticipantIds.includes(id.toString()) &&
            !communityChat.participants.map(p => p.toString()).includes(id.toString())
        );

        if (newParticipantIds.length === 0) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'No new valid participants to add'
            });
        }

        // Add new participants
        communityChat.participants = [...communityChat.participants, ...newParticipantIds];
        await communityChat.save();

        // Add chat to new participants' generalChats arrays
        await User.updateMany(
            { _id: { $in: newParticipantIds } },
            { $addToSet: { generalChats: communityChat._id } }
        );

        // Update all participants' chat lists via socket
        newParticipantIds.forEach(participantId => {
            updateUsersGroupChatList(participantId.toString());
        });

        // Also update the admin's list
        updateUsersGroupChatList(userId.toString());

        // Get full user data
        const currentUser = await User.findById(userId);
        const fullUser = await getFullUserData(currentUser.email);
        fullUser.token = null;
        fullUser.password = null;

        return res.status(200).json({
            status: 'SUCCESS',
            chat: communityChat,
            user: fullUser
        });
    } catch (err) {
        console.log('[addParticipantsToCommunityChat]', err.message);
        return res.status(500).json({
            status: 'FAIL',
            error: err.message
        });
    }
}

const joinCommunityChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { communityChatId } = req.body;

        if (!communityChatId) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'Community chat ID is required'
            });
        }

        // Find the community chat
        const communityChat = await GroupChat.findOne({
            _id: communityChatId,
            type: 'community'
        });

        if (!communityChat) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'Community chat not found'
            });
        }

        // Add user to participants if not already present
        if (!communityChat.participants.includes(userId)) {
            communityChat.participants.push(userId);
            await communityChat.save();
        }

        // Add to user's generalChats array
        const currentUser = await User.findById(userId);
        if (!currentUser.generalChats.includes(communityChat._id)) {
            currentUser.generalChats.push(communityChat._id);
            await currentUser.save();
        }

        // Update user's chat list via socket
        updateUsersGroupChatList(userId.toString());

        // Get full user data
        const fullUser = await getFullUserData(currentUser.email);
        fullUser.token = null;
        fullUser.password = null;

        return res.status(200).json({
            status: 'SUCCESS',
            chat: communityChat,
            user: fullUser
        });
    } catch (err) {
        console.log('[joinCommunityChat]', err.message);
        return res.status(500).json({
            status: 'FAIL',
            error: err.message
        });
    }
}

const getAllCommunityChats = async (req, res) => {
    try {
        const { userId } = req.user;

        if (!userId) {
            return res.status(400).json({
                status: 'FAIL',
                error: 'User ID is required'
            });
        }

        // Find community chats that are either open to all OR the user is a participant
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const communityChats = await GroupChat.find({
            type: 'community',
            status: 'active',
            $or: [
                { isOpenToAll: true },
                { participants: userObjectId }
            ]
        })
            .populate('admin', '_id email username role')
            .populate('participants', '_id email username')
            .populate('createdBy', '_id email username')
            .sort({ updatedAt: -1 })
            .lean();

        // Get current user to check which chats they're already in
        const currentUser = await User.findById(userId).select('generalChats').lean();
        if (!currentUser) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'User not found'
            });
        }

        const userChatIds = (currentUser.generalChats || []).map(id => id.toString());

        // Add isJoined flag to each chat
        const chatsWithJoinStatus = communityChats.map(chat => {
            const chatId = chat._id.toString();
            const participantIds = (chat.participants || []).map((p) => {
                if (typeof p === 'string') return p;
                if (p && p._id) return p._id.toString();
                return null;
            }).filter(Boolean);

            return {
                ...chat,
                isJoined: userChatIds.includes(chatId) || participantIds.includes(userId.toString()),
                participantCount: participantIds.length
            };
        });

        return res.status(200).json({
            status: 'SUCCESS',
            chats: chatsWithJoinStatus
        });
    } catch (err) {
        console.log('[getAllCommunityChats] Error:', err);
        return res.status(500).json({
            status: 'FAIL',
            error: err.message || 'Internal server error'
        });
    }
}

const joinGeneralChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { adminId } = req.body;

        // check if groupChat exists
        const generalChat = await GroupChat.findOne({ admin: adminId, name: { $ne: 'Global Chat' } });
        console.log(generalChat, '////')
        if (!generalChat.participants.includes(userId)) {
            generalChat.participants.push(userId);
            await generalChat.save()
        }

        let user = await User.findById(userId)
        if (!user.generalChats.includes(generalChat._id)) {
            user.generalChats.push(generalChat._id)
            await user.save()
        }

        user = await getFullUserData(user.email)
        user.token = null
        user.password = null

        return res.status(200).json({
            user: user
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
};

const joinPrivateChat = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { personId } = req.body; // <-- ID of the profile you clicked

        if (!userId) return res.status(401).send("Unauthorized");
        if (!personId) return res.status(400).send("personId is required");
        if (String(userId) === String(personId)) return res.status(400).send("Cannot open chat with yourself");

        // Ensure the clicked person exists
        const otherUser = await User.findById(personId).select("username email").exec();
        if (!otherUser) return res.status(404).send("User not found");

        // 1) Find existing individual chat shared by both users
        let chat = await GroupChat.findOne({
            type: "individual",
            participants: { $all: [personId, userId] },
        }).exec();

        if (chat) {
            // Defensive: ensure both participants present (no-op if already present)
            await GroupChat.updateOne(
                { _id: chat._id },
                { $addToSet: { participants: { $each: [personId, userId] } } }
            ).exec();

            // reload canonical chat
            chat = await GroupChat.findById(chat._id).exec();
        } else {
            // 2) Create a new individual chat between caller and clicked person
            const createDoc = {
                name: `Private Chat - ${otherUser.username || personId}`,
                description: "",
                participants: [personId, userId],
                admin: personId,       // set admin to the profile user clicked (matches other create flows)
                type: "individual",
                status: "active",
                createdBy: userId,     // the caller created the chat
            };

            chat = await GroupChat.create(createDoc);
        }

        // 3) Ensure both users reference this chat (no duplicates)
        await User.updateOne({ _id: userId }, { $addToSet: { generalChats: chat._id } }).exec();
        await User.updateOne({ _id: personId }, { $addToSet: { generalChats: chat._id } }).exec();

        // 4) Notify socket helpers so both users' chat lists update in real-time
        try { updateUsersGroupChatList(userId.toString()); } catch (e) { console.warn("updateUsersGroupChatList(user) failed:", e?.message || e); }
        try { updateUsersGroupChatList(personId.toString()); } catch (e) { console.warn("updateUsersGroupChatList(person) failed:", e?.message || e); }

        // 5) Return populated user and chat so frontend can open the conversation immediately
        const userDoc = await User.findById(userId).select("email").exec();
        const fullUser = await getFullUserData(userDoc.email);
        if (fullUser) {
            fullUser.token = null;
            fullUser.password = null;
        }

        return res.status(200).json({ user: fullUser, chat });
    } catch (err) {
        console.error("joinGeneralChat error:", err);
        return res.status(500).send(err.message || "Server error");
    }
};

const createGroupChatByUser = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, services, keywords, start, end, duration, price, expert, payment_intent } = req.body;


        if (checkTitleNameInvalid('Name', name)) {
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
        const paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
        if (price && !paymentIntentSucceeded_test && !paymentIntentSucceeded_live) {
            throw new Error("Payment intent not succeeded")
        }

        // create group
        const chat = await GroupChat.create({
            name: name,
            description: description,
            services: services,
            keywords: keywords,
            start: start,
            end: end,
            duration: duration,
            price: price,
            participants: [userId, expert],
            admin: expert,
            type: 'individual',
            status: 'pending',
            createdBy: userId,
        });

        const currentUser = await User.findById(userId);
        currentUser.groupChats.push(chat._id);
        await currentUser.save();
        currentUser.populate(['events', 'keywords', 'services', 'groupChats'])

        updateUsersGroupChatList(userId.toString());

        const expertUser = await User.findById(expert);
        expertUser.groupChats.push(chat._id);
        await expertUser.save();
        expertUser.populate(['events', 'keywords', 'services', 'groupChats'])

        updateUsersGroupChatList(expert.toString());

        await appendPaymentHistory({
            stripeMode: paymentIntentSucceeded_test ? 'test' : 'live',
            paymentType: 'charge',
            amount: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.amount : paymentIntentSucceeded_live.amount,
            currency: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.currency : paymentIntentSucceeded_live.currency,
            description: chat.name,
            paymentIntent: payment_intent,
            customer: userId.toString(),
            expert: expert.toString(),
            groupChat: chat._id.toString(),
            // pendingAppointmentToGroup: newPendingGroup._id
        })

        sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, name, chat.start, duration, price, true, expertUser.timeZone)

        return res.status(200).json({
            result: currentUser,
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
};

const createGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, services, keywords, start, end, duration, price, type, status, customerId } = req.body;

        if (checkTitleNameInvalid('Name', name)) {
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        // create group
        const chat = await GroupChat.create({
            name: name,
            description: description,
            services: services,
            keywords: keywords,
            start: start,
            end: end,
            duration: duration,
            price: price,
            participants: type === 'individual' ? [customerId, userId] : [userId],
            admin: userId,
            type: type,
            status: status,
            createdBy: userId,
        });

        const currentUser = await User.findById(userId);
        currentUser.groupChats.push(chat._id);
        await currentUser.save();
        currentUser.populate(['events', 'keywords', 'services', 'groupChats'])

        updateUsersGroupChatList(userId.toString());

        if (type === 'individual' && customerId) {
            const customer = await User.findById(customerId);
            if (!customer) {
                throw new Error("Customer not found");
            }
            customer.groupChats.push(chat._id);
            await customer.save();
            customer.populate(['events', 'keywords', 'services', 'groupChats'])

            updateUsersGroupChatList(customerId.toString());

            sendEmailMeetingRequestToCustomer(customer.email, name, customer.username, start, duration, price, customer.timeZone)

        }

        return res.status(200).json({
            result: currentUser,
        });
    } catch (err) {
        return res
            .status(500)
            .send(err.message);
    }
};

const getGroupChat = async (req, res) => {
    try {
        const { groupChatId } = req.params;

        //check if groupchatID is i in porper format 
        if (!groupChatId || groupChatId.length !== 24) {
            return res.status(400).send("Sorry, Invalid meeting ID");
        }

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId })

        if (!groupChat) {
            return res.status(404).send("Sorry, Invalid meeting ID");
        }

        return res.status(200).json(groupChat);
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
}

const joinGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;

        // check if groupChat exists    
        console.log('[joinGroupChat]', groupChatId, userId)
        const groupChat = await GroupChat.findOne({ _id: groupChatId });
        if (!groupChat) {
            return res.status(404).send("Sorry, Invalid meeting ID");
        }

        // if end < now cant join past chat
        const now = new Date().getTime();
        if (new Date(groupChat.end).getTime() < now) {
            return res.status(400).send("Cannot join a past meeting");
        }

        if (groupChat.status !== 'active') {
            return res.status(400).send("Sorry, the meeting is not active");
        }

        if (groupChat.participants.includes(userId)) {
            return res.status(400).send("You are already a participant of this meeting");
        }

        if (userId.role === 'customer') {
            const paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
            const paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
            if (groupChat.price && !paymentIntentSucceeded_test && !paymentIntentSucceeded_live) {
                throw new Error("Payment intent not succeeded")
            }

            await appendPaymentHistory({
                stripeMode: paymentIntentSucceeded_test ? 'test' : 'live',
                paymentType: 'charge',
                amount: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.amount : paymentIntentSucceeded_live.amount,
                currency: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.currency : paymentIntentSucceeded_live.currency,
                description: groupChat.name,
                paymentIntent: payment_intent,
                customer: userId.toString(),
                expert: groupChat.admin.toString(),
                groupChat: groupChatId.toString(),
            })

        }

        const currentUser = await User.findById(userId);
        currentUser.groupChats.push(groupChatId);
        await currentUser.save();
        currentUser.populate(['events', 'keywords', 'services', 'groupChats'])

        updateUsersGroupChatList(userId.toString());

        groupChat.participants = [...groupChat.participants, userId]
        await groupChat.save();

        // update the chat list of all participants
        groupChat.participants.map(participantId => {
            updateUsersGroupChatList(participantId.toString());
        })

        scheduleEmailReminder(currentUser.email, currentUser.username, groupChat.name, groupChat.start, groupChat.duration, currentUser.timeZone);

        return res.status(200).json({
            success: true,
            result: groupChat,
        });

    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }

}


const updateGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupId, name, description, services, keywords, start, end, duration, price, totalTimeSpent, type } = req.body;

        if (!groupId) {
            throw new Error("Group ID is required");
        }

        console.log(groupId, name, description, services, keywords, start, end, duration, price, type);

        const groupChat = await GroupChat.findById(groupId);

        if (!groupChat) {
            throw new Error("Group chat not found");
        }

        // Construct dynamic update object
        const updateFields: Record<string, any> = {};
        if (name !== undefined) updateFields.name = name;
        if (description !== undefined) updateFields.description = description;
        if (services !== undefined) updateFields.services = services;
        if (keywords !== undefined) updateFields.keywords = keywords;
        if (start !== undefined) updateFields.start = start;
        if (end !== undefined) updateFields.end = end;
        if (duration !== undefined) updateFields.duration = duration;
        if (price !== undefined) updateFields.price = price;
        if (type !== undefined) updateFields.type = type;
        if (totalTimeSpent !== undefined) {
            //updateFields.totalTimeSpend = totalTimeSpent;
            const existingTotalTimeSpent = groupChat.totalTimeSpent || 0;
            updateFields.totalTimeSpent = existingTotalTimeSpent + totalTimeSpent;
        }

        // Ensure admin is always updated
        updateFields.admin = userId;

        // Update group chat with only provided fields
        await GroupChat.findByIdAndUpdate(groupId, updateFields, { new: true });

        const currentUser = await User.findById(userId).populate(['events', 'keywords', 'services', 'groupChats']);
        updateUsersGroupChatList(userId.toString());

        return res.status(200).json({
            result: currentUser,
        });
    } catch (err) {
        return res.status(500).send(err.message);
    }
};


const addMemberToPendingGroup = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent, price } = req.body;

        const paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
        const paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
        if (price && !paymentIntentSucceeded_test && !paymentIntentSucceeded_live) {
            throw new Error("Payment intent not succeeded")
        }

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        if (groupChat.admin.toString() === userId) {
            return res
                .status(403)
                .send(
                    "Forbidden. Group admin can't add himself to the group."
                );
        }

        // add friends to the pending group

        const friendsToAdd = [];

        if (!groupChat.participants.includes(userId)) {
            friendsToAdd.push(userId);
        }

        const pendingGroup = new PendingAppointmentToGroup({
            customerId: userId,
            groupChatId: groupChatId,
            paidBy: paymentIntentSucceeded_test ? 'test' : 'live',
        })
        const newPendingGroup = await pendingGroup.save()

        const customer = await User.findById(userId)
        customer.pendingGroupChats.push(newPendingGroup._id)
        await customer.save()

        const expert = await User.findById(groupChat.admin.toString())
        expert.pendingGroupChats.push(newPendingGroup._id)
        await expert.save()

        await appendPaymentHistory({
            stripeMode: paymentIntentSucceeded_test ? 'test' : 'live',
            paymentType: 'charge',
            amount: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.amount : paymentIntentSucceeded_live.amount,
            currency: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.currency : paymentIntentSucceeded_live.currency,
            description: groupChat.name,
            paymentIntent: payment_intent,
            customer: customer._id.toString(),
            expert: expert._id.toString(),
            groupChat: groupChat._id.toString(),
            pendingAppointmentToGroup: newPendingGroup._id
        })

        const user = await User.findById(userId).populate([{
            path: 'pendingGroupChats',
            populate: [
                {
                    path: 'customerId',
                    select: 'email username image role status'
                },
                'groupChatId'
            ]
        }])

        return res.status(200).json({
            pendingGroupChats: user.pendingGroupChats
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
};

const acceptIndividualAppointment = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;

        const groupChat = await GroupChat.findOne({ _id: groupChatId });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        let customer, expert;

        if (userId.role === 'customer') {
            const paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
            const paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
            if (!paymentIntentSucceeded_test && !paymentIntentSucceeded_live) {
                throw new Error("Payment intent not succeeded")
            }

            await appendPaymentHistory({
                stripeMode: paymentIntentSucceeded_test ? 'test' : 'live',
                paymentType: 'charge',
                amount: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.amount : paymentIntentSucceeded_live.amount,
                currency: paymentIntentSucceeded_test ? paymentIntentSucceeded_test.currency : paymentIntentSucceeded_live.currency,
                description: groupChat.name,
                paymentIntent: payment_intent,
                customer: userId.toString(),
                expert: groupChat.admin.toString(),
                groupChat: groupChatId,
                // pendingAppointmentToGroup: newPendingGroup._id
            })
        }

        groupChat.status = 'active';
        await groupChat.save();

        let user1 = await User.findById(userId);
        let user2 = await User.findById(groupChat.createdBy);

        sendEmailMeetingAcceptance(user2.email, user2.username, groupChat.name, groupChat.start, groupChat.duration, user2.timeZone);


        scheduleEmailReminder(user1.email, user1.username, groupChat.name, groupChat.start, groupChat.duration, user1.timeZone);
        scheduleEmailReminder(user2.email, user2.username, groupChat.name, groupChat.start, groupChat.duration, user2.timeZone);

        return res.status(200).send("Group chat accepted successfully!");

    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
}

const addMemberToGroup = async (req, res) => {
    try {
        const { email, userId } = req.user;
        const { _id, friendId, groupChatId } = req.body;
        console.log('[addMemberToGroup]', _id, friendId, groupChatId)

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        if (groupChat.admin.toString() === friendId) {
            return res
                .status(403)
                .send(
                    "Forbidden. Group admin can't add himself to the group."
                );
        }

        const pendingGroupChat = await PendingAppointmentToGroup.findById(_id)
        if (!pendingGroupChat)
            throw new Error('No pending appointment found')

        const customer = await User.findById(friendId)
        if (!customer)
            throw new Error('No registered customer found')
        let index = customer.pendingGroupChats.findIndex(item => item.toString() === _id)
        if (index > -1)
            customer.pendingGroupChats.splice(index, 1)

        const expert = await User.findById(userId)
        index = expert.pendingGroupChats.findIndex(item => item.toString() === _id)
        if (index > -1)
            expert.pendingGroupChats.splice(index, 1)


        // add friend to the group
        if (!groupChat.participants.includes(friendId)) {
            groupChat.participants = [...groupChat.participants, friendId];
            customer.groupChats.push(groupChatId);

            // update the user's(user who has been added to the group) chat list
            updateUsersGroupChatList(friendId.toString());
        }

        await customer.save();
        await expert.save();
        await groupChat.save();

        // update the chat list of all participants
        groupChat.participants.map(userId => {
            updateUsersGroupChatList(userId.toString());
        })

        // Check if the room is enable in this group, if so, update active rooms of this user
        updateActiveRoomsOfUsers(friendId, [groupChat])

        return res.status(200).send("Members added successfully!");
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

const leaveGroup = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.body;

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        const currentUser = await User.findById(userId);

        if (!currentUser) {
            return res.status(404).send("User not found");
        }

        // remove user from the group
        groupChat.participants = groupChat.participants.filter(
            (participant) => {
                return participant.toString() !== currentUser._id.toString();
            }
        );
        await groupChat.save();

        // remove groupChat from the list of user's groupChats
        currentUser.groupChats = currentUser.groupChats.filter((chat) => {
            return chat.toString() !== groupChat._id.toString();
        });

        await currentUser.save();

        // update the chat list of user who left the chat.
        updateUsersGroupChatList(currentUser._id.toString());

        groupChat.participants.forEach((participant) => {
            // update the participants chat list
            updateUsersGroupChatList(participant.toString());
        });

        return res.status(200).send("You have left the group!");
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
};

const deleteGroup = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.body;

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId });

        if (!groupChat) {
            throw new Error("Sorry, the group chat doesn't exist");
        }

        if (groupChat.admin.toString() !== userId) {
            throw new Error("Forbidden. Only group admins can delete a group.");
        }

        // update groupChat list of all the participants
        groupChat.participants.forEach(async (friendId) => {
            const participant = await User.findById(friendId);

            if (participant) {
                // Remove from groupChats array
                participant.groupChats = participant.groupChats.filter(
                    (chat) => chat.toString() !== groupChat._id.toString()
                );

                // For community chats, also remove from generalChats array
                if (groupChat.type === 'community') {
                    participant.generalChats = participant.generalChats.filter(
                        (chat) => chat.toString() !== groupChat._id.toString()
                    );
                }

                await participant.save();

                // update the users group chat list
                updateUsersGroupChatList(friendId.toString());
            }
        });

        // lastly delete the groupChat
        groupChat.remove();

        return res.status(200).send("Group deleted successfully!");
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
};

const cancelIndividualAppointment = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.body;

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId });
        if (!groupChat) {
            throw new Error("Sorry, the group chat doesn't exist");
        }
        if (groupChat.status !== 'pending') {
            throw new Error("Sorry, the group chat is not in pending status");
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            throw new Error("User not found");
        }

        groupChat.participants.forEach(async (participantId) => {
            const participant = await User.findById(participantId);
            if (participant) {
                participant.groupChats = participant.groupChats.filter((chat) => chat.toString() !== groupChatId);
                await participant.save();
            }
            // update the users group chat list
            updateUsersGroupChatList(participantId.toString());
        });

        if (groupChat.admin.toString() !== userId) {

            const payment = await PaymentHistory.findOne({ groupChat: groupChatId, customer: userId });

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
                        // pendingAppointmentToGroup: PaymentHistory.pendingAppointmentToGroup,
                        groupChat: payment.groupChat,
                        event: payment.event,
                        paymentType: 'refund',
                        paymentIntent: refund.payment_intent,
                    })
                }
            }
        }

        groupChat.status = 'cancelled';
        await groupChat.save();

        return res.status(200).send("Your appointment has been canceled!");
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
}

const cancelPendingSeminar = async (req, res) => {
    try {
        const { userId } = req.user;
        const { pendingSeminarId } = req.body;

        // check if groupChat exists
        const pendingAppointment = await PendingAppointmentToGroup.findOne({ _id: pendingSeminarId });
        if (!pendingAppointment) {
            throw new Error("Sorry, the join request to seminar doesn't exist");
        }
        if (pendingAppointment.customerId.toString() !== userId) {
            throw new Error("Forbidden. Only the customer can cancel the request to join the seminar.");
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            throw new Error("User not found");
        }

        // remove groupChat from the list of user's groupChats
        currentUser.pendingGroupChats = currentUser.pendingGroupChats.filter((chat) => {
            return chat.toString() !== pendingSeminarId;
        });
        await currentUser.save();

        const groupChat = await GroupChat.findById(pendingAppointment.groupChatId);
        if (!groupChat) {
            throw new Error("Group chat not found");
        }

        const expert = await User.findById(groupChat.admin);
        if (!expert) {
            throw new Error("Expert not found");
        }

        // remove groupChat from the list of user's groupChats
        expert.pendingGroupChats = expert.pendingGroupChats.filter((chat) => {
            return chat.toString() !== pendingSeminarId;
        });
        await expert.save();

        // update the chat list of user who left the chat.
        updateUsersGroupChatList(currentUser._id.toString());
        updateUsersGroupChatList(expert._id.toString());

        const payment = await PaymentHistory.findOne({ pendingAppointmentToGroup: pendingSeminarId })
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
            }
        }

        return res.status(200).send("Your join request to a seminar has been canceled!");
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
}

const leftSeminar = async (req, res) => {
    try {
        const { userId } = req.user;
        const { seminarId } = req.body;

        const groupChat = await GroupChat.findById(seminarId);
        if (!groupChat) {
            throw new Error("Group chat not found");
        }

        if (new Date(groupChat.start).getTime() <= new Date().getTime()) {
            throw new Error("Unable to leave past or ongoing seminar")
        }

        groupChat.participants = groupChat.participants.filter((participant) => {
            return participant.toString() !== userId;
        })
        await groupChat.save();

        const currentUser = await User.findById(userId);

        // remove groupChat from the list of user's groupChats
        currentUser.groupChats = currentUser.groupChats.filter((chat) => {
            return chat.toString() !== seminarId;
        });
        await currentUser.save();

        // update the chat list of user who left the chat.
        updateUsersGroupChatList(userId);

        groupChat.participants.forEach((participant) => {
            // update the participants chat list
            updateUsersGroupChatList(participant.toString());
        });

        const pendingAppointmentToGroups = await PendingAppointmentToGroup.where({ groupChatId: seminarId, customerId: userId })
        const payment = await PaymentHistory.findOne({ pendingAppointmentToGroup: pendingAppointmentToGroups[0]?._id.toString() })
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
            }
        }

        return res.status(200).send("You have left the group!");
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(err.message);
    }
}

module.exports = {
    createGroupChat,
    createGroupChatByUser,
    getGroupChat,
    joinGroupChat,
    updateGroupChat,
    addMemberToPendingGroup,
    acceptIndividualAppointment,
    addMemberToGroup,
    leaveGroup,
    deleteGroup,
    createGeneralChatAndJoinGlobalChat,
    joinGeneralChat,
    joinPrivateChat,
    cancelPendingSeminar,
    cancelIndividualAppointment,
    createCommunityChat,
    joinCommunityChat,
    addParticipantsToCommunityChat,
    getAllCommunityChats,
    leftSeminar
};
