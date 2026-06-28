import { Request, Response } from 'express';
import { wlDisplayName } from '../utils/wlDisplayName';
const mongoose = require("mongoose");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const Keyword = require("../models/Keyword");
const Service = require("../models/Service");
const MeetingThread = require("../models/MeetingThread");
const PaymentHistory = require("../models/PaymentHistory");
// Socket notifications removed — Rocket.Chat handles real-time updates now
const { checkPaymentIntentSucceeded, refundPaymentIntent, sendBookingReceiptAndConfirmation } = require("./stripe.controller");
const { appendPaymentHistory } = require("./payment.controller");
const { getFullUserData } = require("../middlewares/requireAuth");

// keywords/services arrive from the client as plain label strings (or legacy { value }
// objects), but GroupChat stores them as ObjectId refs. Resolve each label to an existing
// Keyword/Service (case-insensitive) or create it — mirrors the expert-profile flow and
// prevents Mongoose CastErrors. Keywords match exactly; services match by prefix because the
// client may send "Study abroad" while the DB stores "Study abroad consultation".
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveKeywordIds = async (keywords: any): Promise<any[]> => {
    const ids: any[] = [];
    if (!Array.isArray(keywords)) return ids;
    for (const k of keywords) {
        const value = typeof k === 'string' ? k : k?.value;
        if (!value) continue;
        const existing = await Keyword.findOne({ value: { $regex: new RegExp(`^${escapeRegex(value)}$`, 'i') } });
        ids.push(existing ? existing._id : (await Keyword.create({ value, label: value }))._id);
    }
    return ids;
};

const resolveServiceIds = async (services: any): Promise<any[]> => {
    const ids: any[] = [];
    if (!Array.isArray(services)) return ids;
    for (const s of services) {
        const value = typeof s === 'string' ? s : s?.value;
        if (!value) continue;
        const existing = await Service.findOne({ value: { $regex: new RegExp(`^${escapeRegex(value)}`, 'i') } });
        ids.push(existing ? existing._id : (await Service.create({ value, label: value }))._id);
    }
    return ids;
};
const Conversation = require("../models/Conversation");
const {
    getOrCreateDMChannel,
    toRocketChatUsername,
    ensureBothWlUsersSyncedToRocketChat,
    sendMessageToRC,
    kickUserFromGroupChannel,
    syncRocketGroupChannelMembers,
} = require("../services/rocketchat.service");
import { safeErrorMessage, safeHttp500Message } from '../utils/httpUserFacingCopy';
import { computeBookingPriceCents, extractHourlyRate, dollarsToCents, assertPaymentMatchesExpected } from '../utils/bookingPrice';

/** Stored in RC; FE shows as centered pill (see ChatSystemNotice). */
const WL_COMMUNITY_SYS_PREFIX = '__WL_COMMUNITY_SYS__::';

const isCommunityModerator = (groupChat: any, userId: string): boolean => {
    const me = String(userId || "");
    if (!groupChat || !me) return false;
    const adminId = String(groupChat?.admin?._id ?? groupChat?.admin ?? "");
    if (adminId === me) return true;
    const coMods = Array.isArray(groupChat?.coModerators) ? groupChat.coModerators : [];
    return coMods.some((id: any) => String(id?._id ?? id) === me);
};

const normalizeId = (v: any): string => String(v?._id ?? v?.id ?? v ?? "").trim();

const groupMemberIds = (groupChat: any): string[] => [
    normalizeId(groupChat?.admin),
    ...(Array.isArray(groupChat?.participants) ? groupChat.participants.map((p: any) => normalizeId(p)) : []),
    ...(Array.isArray(groupChat?.coModerators) ? groupChat.coModerators.map((p: any) => normalizeId(p)) : []),
].filter(Boolean);

// Enrolled students = participants minus the host (the admin is always a
// participant of their own seminar). Used for both the full-capacity check and
// the "students already enrolled" delete guard.
const enrolledStudentIds = (groupChat: any): string[] => {
    const adminId = normalizeId(groupChat?.admin);
    return (Array.isArray(groupChat?.participants) ? groupChat.participants : [])
        .map((p: any) => normalizeId(p))
        .filter((id: string) => id && id !== adminId);
};

// A seminar is full once its capacity (maxAttendees) is set and reached.
const seminarIsFull = (groupChat: any): boolean => {
    const cap = typeof groupChat?.maxAttendees === 'number' ? groupChat.maxAttendees : null;
    if (cap == null || cap <= 0) return false;
    return enrolledStudentIds(groupChat).length >= cap;
};

const userCanAccessGroupChat = (groupChat: any, userId: string, opts: { allowOpenCommunity?: boolean } = {}): boolean => {
    if (!groupChat || !userId) return false;
    if (groupMemberIds(groupChat).includes(String(userId))) return true;
    return Boolean(opts.allowOpenCommunity && groupChat.type === "community" && groupChat.isOpenToAll === true);
};

async function syncGroupRocketChannel(groupChatId: string) {
    try {
        const reloaded = await GroupChat.findById(String(groupChatId))
            .populate('participants', 'email username rocketChatUsername image role status')
            .populate('admin', 'email username rocketChatUsername image role status');
        if (!reloaded) return null;

        const channelKeyId = reloaded.seriesId ? String(reloaded.seriesId) : String(reloaded._id);

        const emails: string[] = [];
        if (reloaded.seriesId) {
            const seriesDocs = await GroupChat.find({ seriesId: reloaded.seriesId })
                .populate('participants', 'email')
                .populate('admin', 'email');
            for (const d of seriesDocs) {
                for (const p of d.participants || []) {
                    if (p?.email) emails.push(String(p.email).toLowerCase());
                }
                const a = d.admin as any;
                if (a?.email) emails.push(String(a.email).toLowerCase());
            }
        } else {
            for (const p of reloaded.participants || []) {
                if (p?.email) emails.push(String(p.email).toLowerCase());
            }
            const adm = reloaded.admin as any;
            if (adm?.email) emails.push(String(adm.email).toLowerCase());
        }

        const rcId = await syncRocketGroupChannelMembers(channelKeyId, emails);
        if (rcId) {
            if (reloaded.seriesId) {
                await GroupChat.updateMany(
                    { seriesId: reloaded.seriesId },
                    { $set: { rcChannelId: rcId } },
                    { timestamps: false },
                ).exec();
            } else {
                await GroupChat.updateOne(
                    { _id: reloaded._id },
                    { $set: { rcChannelId: rcId } },
                    { timestamps: false },
                ).exec();
            }
        }
        return rcId;
    } catch (e) {
        console.warn('[syncGroupRocketChannel]', e);
        return null;
    }
}
const { checkTitleNameInvalid } = require('../services/global')
const { scheduleEmailReminder, sendEmailMeetingRequestToCustomer, sendEmailMeetingRequestToExpert, sendEmailMeetingAcceptance } = require('../services/notifications')
const { assertBookingLeadTime } = require("../utils/bookingLeadTime");
const { assertBookingSlotValid, assertDurationAllowed } = require("../utils/bookingValidation");
import { buildRemovedUserNotice, normalizeModerationReason } from '../utils/videoModerationNotice';

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

        /**
         * Open-to-all communities should appear for everyone in the list (handled by `getAllCommunityChats` query),
         * but we must NOT attempt to store every user id inside `participants` or update every user's `generalChats`
         * — that can exceed MongoDB document limits and fail for large user bases.
         */
        let finalParticipants: string[] = [];
        if (isOpenToAll === true) {
            finalParticipants = [String(userId)];
        } else {
            // Prepare participants array - always include the creator (admin)
            const participantsArray = Array.isArray(participants) ? participants : [];
            const uniqueParticipants = [...new Set([userId, ...participantsArray])];

            // Validate that all participant IDs exist
            const validParticipants = await User.find({
                _id: { $in: uniqueParticipants.map((p: any) => String(p)) }
            }).select('_id');

            const validParticipantIds = validParticipants.map(p => p._id.toString());
            finalParticipants = uniqueParticipants.filter(id => validParticipantIds.includes(id.toString()));
        }

        // Create community chat
        const now = new Date();
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
            lastMessageAt: now,
        });

        // Add chat to the creator and any explicitly invited participants (not to all users).
        const participantsToUpdate = finalParticipants;
        await User.updateMany(
            { _id: { $in: participantsToUpdate } },
            { $addToSet: { generalChats: communityChat._id } }
        );

        // For open-to-all we only need the RC channel created with the creator;
        // others will be invited when they join.
        await syncGroupRocketChannel(String(communityChat._id));

        // Update all participants' chat lists via socket
        participantsToUpdate.forEach(participantId => {
            // [REMOVED] updateUsersGroupChatList(participantId.toString());
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
            error: safeErrorMessage(err)
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
            _id: String(communityChatId),
            type: 'community'
        });

        if (!communityChat) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'Community chat not found'
            });
        }

        // Community moderators can add participants
        if (!isCommunityModerator(communityChat, userId)) {
            return res.status(403).json({
                status: 'FAIL',
                error: 'Only community moderators can add participants to this community chat'
            });
        }

        // Validate that all participant IDs exist
        const validParticipants = await User.find({
            _id: { $in: participantIds.map((p: any) => String(p)) }
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

        await syncGroupRocketChannel(String(communityChat._id));

        // Add chat to new participants' generalChats arrays
        await User.updateMany(
            { _id: { $in: newParticipantIds } },
            { $addToSet: { generalChats: communityChat._id } }
        );

        // Update all participants' chat lists via socket
        newParticipantIds.forEach(participantId => {
            // [REMOVED] updateUsersGroupChatList(participantId.toString());
        });

        // Also update the admin's list
        // [REMOVED] updateUsersGroupChatList(userId.toString());

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
            error: safeErrorMessage(err)
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
            _id: String(communityChatId),
            type: 'community'
        });

        if (!communityChat) {
            return res.status(404).json({
                status: 'FAIL',
                error: 'Community chat not found'
            });
        }
        if (!communityChat.isOpenToAll && !userCanAccessGroupChat(communityChat, String(userId))) {
            return res.status(403).json({
                status: 'FAIL',
                error: 'This community is invite-only'
            });
        }

        // Add user to participants if not already present
        if (!communityChat.participants.some((p: any) => normalizeId(p) === String(userId))) {
            communityChat.participants.push(userId);
            await communityChat.save();
        }

        // Add to user's generalChats array
        const currentUser = await User.findById(userId);
        if (!currentUser.generalChats.includes(communityChat._id)) {
            currentUser.generalChats.push(communityChat._id);
            await currentUser.save();
        }

        await syncGroupRocketChannel(String(communityChat._id));

        // Update user's chat list via socket
        // [REMOVED] updateUsersGroupChatList(userId.toString());

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
            error: safeErrorMessage(err)
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
            .populate('coModerators', '_id email username role image')
            .populate('createdBy', '_id email username')
            .lean();

        communityChats.sort((a: any, b: any) => {
            const ta = new Date(a.lastMessageAt || a.updatedAt).getTime();
            const tb = new Date(b.lastMessageAt || b.updatedAt).getTime();
            return tb - ta;
        });

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
            error: safeErrorMessage(err) || 'Internal server error'
        });
    }
}

const joinGeneralChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { adminId } = req.body;

        // check if groupChat exists
        const generalChat = await GroupChat.findOne({ admin: String(adminId), name: { $ne: 'Global Chat' } });
        console.log('[joinGeneralChat]', generalChat)
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
            .send(safeErrorMessage(err));
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
        const otherUser = await User.findById(String(personId)).select("username email image role").exec();
        if (!otherUser) return res.status(404).send("User not found");

        // 1:1 DM = Mongo Conversation + Rocket.Chat IM — not a GroupChat / wl-group-* channel.
        let conversation = await Conversation.findOne({
            $and: [
                { participants: userId },
                { participants: String(personId) },
                { participants: { $size: 2 } },
            ],
        }).exec();

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [userId, personId],
                messages: [],
            });
        }

        const me = await User.findById(userId).select("email username").exec();
        if (me?.email && otherUser?.email) {
            try {
                await ensureBothWlUsersSyncedToRocketChat(me, otherUser);
                await getOrCreateDMChannel(
                    toRocketChatUsername(me.email),
                    toRocketChatUsername(otherUser.email)
                );
            } catch (e: any) {
                console.warn("[joinPrivateChat] getOrCreateDMChannel:", e?.message || e);
            }
        }

        await User.updateOne({ _id: userId }, { $addToSet: { directConversations: conversation._id } }).exec();
        await User.updateOne({ _id: String(personId) }, { $addToSet: { directConversations: conversation._id } }).exec();

        const userDoc = await User.findById(userId).select("email").exec();
        const fullUser = await getFullUserData(userDoc.email);
        if (fullUser) {
            fullUser.token = null;
            fullUser.password = null;
        }

        return res.status(200).json({
            user: fullUser,
            conversationId: conversation._id,
            otherUserId: personId,
            otherUser: {
                _id: otherUser._id,
                username: otherUser.username,
                email: otherUser.email,
                image: otherUser.image,
                role: otherUser.role,
            },
        });
    } catch (err) {
        console.error("joinPrivateChat error:", err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const createGroupChatByUser = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, services, keywords, start, end, duration, expert, payment_intent } = req.body;


        if (checkTitleNameInvalid('Name', name)) {
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const expertUser = await User.findById(String(expert));
        if (!expertUser) {
            throw new Error("Expert not found");
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
        await assertBookingSlotValid(expertUser, start, end);

        const _services = await resolveServiceIds(services);
        const _keywords = await resolveKeywordIds(keywords);

        // create group
        const chat = await GroupChat.create({
            name: name,
            description: description,
            services: _services,
            keywords: _keywords,
            start: start,
            end: end,
            duration: duration,
            price: expectedCents / 100,
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

        // [REMOVED] updateUsersGroupChatList(userId.toString());

        expertUser.groupChats.push(chat._id);
        await expertUser.save();
        expertUser.populate(['events', 'keywords', 'services', 'groupChats'])

        // [REMOVED] updateUsersGroupChatList(expert.toString());

        if (charge) {
            await appendPaymentHistory({
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description: chat.name,
                paymentIntent: payment_intent,
                receiptUrl: charge.receiptUrl,
                receiptNumber: charge.receiptNumber,
                customer: userId.toString(),
                expert: expert.toString(),
                groupChat: chat._id.toString(),
            });

            await sendBookingReceiptAndConfirmation({
                payment_intent,
                charge,
                sessionType: '1:1 Session',
                sessionName: chat.name,
                expertName: expertUser.username,
                studentName: currentUser.username,
                studentEmail: currentUser.email,
                start: chat.start,
                duration,
                timeZone: currentUser.timeZone,
            });
        }

        sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, name, chat.start, duration, expectedCents / 100, true, expertUser.timeZone)

        return res.status(200).json({
            result: currentUser,
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(safeHttp500Message(err));
    }
};

const proposeIndividualAppointment = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, start, end, duration, price, customer } = req.body;

        if (checkTitleNameInvalid('Name', name)) {
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const expertUser = await User.findById(userId);
        if (!expertUser) {
            throw new Error("Expert not found");
        }

        const customerUser = await User.findOne({ email: String(customer) });
        if (!customerUser) {
            return res.status(404).send("Sorry, the student you are trying to invite doesn't exist. Please check the email address");
        }

        await assertBookingSlotValid(expertUser, start, end);

        const finalPrice = Math.max(0, Math.round(Number(price) * 100) / 100);

        const chat = await GroupChat.create({
            name,
            description,
            start,
            end,
            duration,
            price: finalPrice,
            participants: [customerUser._id, expertUser._id],
            admin: expertUser._id,
            type: 'individual',
            status: 'pending',
            createdBy: expertUser._id,
        });

        expertUser.groupChats.push(chat._id);
        await expertUser.save();

        customerUser.groupChats.push(chat._id);
        await customerUser.save();

        sendEmailMeetingRequestToCustomer(customerUser.email, name, customerUser.username, chat.start, duration, finalPrice, customerUser.timeZone);

        let userDetails = await getFullUserData(expertUser.email);
        userDetails.token = null;
        userDetails.password = null;

        return res.status(200).json({
            result: userDetails,
            userDetails,
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(safeHttp500Message(err));
    }
};

const RECURRENCE_FREQUENCIES = ['weekly', 'biweekly', 'monthly'];

const buildRecurrenceStartDates = (start, frequency) => {
    const base = new Date(start);
    if (Number.isNaN(base.getTime())) return [base];
    const horizon = new Date(base);
    horizon.setFullYear(horizon.getFullYear() + 1);
    const out = [];
    if (frequency === 'monthly') {
        for (let i = 0; ; i += 1) {
            const d = new Date(base);
            d.setMonth(base.getMonth() + i);
            if (d >= horizon) break;
            out.push(d);
        }
    } else {
        const stepDays = frequency === 'biweekly' ? 14 : 7;
        for (let i = 0; ; i += 1) {
            const d = new Date(base.getTime() + i * stepDays * 24 * 60 * 60 * 1000);
            if (d >= horizon) break;
            out.push(d);
        }
    }
    return out;
};

const createGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, description, image, services, keywords, start, end, duration, price, type, status, customerId, maxAttendees, currency, timezone, isRecurring, recurrenceFrequency } = req.body;

        if (checkTitleNameInvalid('Name', name)) {
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const _services = await resolveServiceIds(services);
        const _keywords = await resolveKeywordIds(keywords);

        const sharedFields = {
            name: name,
            description: description,
            image: image,
            services: _services,
            keywords: _keywords,
            duration: duration,
            price: price,
            participants: type === 'individual' ? [customerId, userId] : [userId],
            admin: userId,
            type: type,
            status: status,
            createdBy: userId,
            maxAttendees: typeof maxAttendees === 'number' ? maxAttendees : undefined,
            currency: typeof currency === 'string' ? currency : undefined,
            timezone: typeof timezone === 'string' ? timezone : undefined,
        };

        const recurring =
            type === 'seminar' &&
            status === 'active' &&
            isRecurring === true &&
            RECURRENCE_FREQUENCIES.includes(recurrenceFrequency) &&
            !!start &&
            !!end;

        const currentUser = await User.findById(userId);

        if (recurring) {
            const startDates = buildRecurrenceStartDates(start, recurrenceFrequency);
            const durationMs = new Date(end).getTime() - new Date(start).getTime();
            const created = [];
            for (const occurrenceStart of startDates) {
                const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
                const occurrence = await GroupChat.create({
                    ...sharedFields,
                    start: occurrenceStart,
                    end: occurrenceEnd,
                    isRecurring: true,
                    recurrenceFrequency,
                });
                created.push(occurrence);
            }
            const seriesId = created[0]._id;
            await GroupChat.updateMany(
                { _id: { $in: created.map((c) => c._id) } },
                { seriesId },
            );
            currentUser.groupChats.push(...created.map((c) => c._id));
            await currentUser.save();

            if (status === 'active') {
                await syncGroupRocketChannel(String(created[0]._id));
            }

            const recurringUserDetails = await getFullUserData(currentUser.email);
            recurringUserDetails.token = null;
            recurringUserDetails.password = null;
            return res.status(200).json({ result: recurringUserDetails });
        }

        // create group
        const chat = await GroupChat.create({
            ...sharedFields,
            start: start,
            end: end,
            isRecurring: type === 'seminar' && isRecurring === true,
            recurrenceFrequency:
                type === 'seminar' && RECURRENCE_FREQUENCIES.includes(recurrenceFrequency)
                    ? recurrenceFrequency
                    : undefined,
        });

        currentUser.groupChats.push(chat._id);
        await currentUser.save();

        // [REMOVED] updateUsersGroupChatList(userId.toString());

        if (type === 'individual' && customerId) {
            const customer = await User.findById(String(customerId));
            if (!customer) {
                throw new Error("Customer not found");
            }
            customer.groupChats.push(chat._id);
            await customer.save();

            // [REMOVED] updateUsersGroupChatList(customerId.toString());

            sendEmailMeetingRequestToCustomer(customer.email, name, customer.username, start, duration, price, customer.timeZone)

        }

        // A published seminar gets its group chat (Rocket.Chat channel) created up
        // front so the host — and later, joining students — can chat in it.
        if (type === 'seminar' && status === 'active') {
            await syncGroupRocketChannel(String(chat._id));
        }

        const userDetails = await getFullUserData(currentUser.email);
        userDetails.token = null;
        userDetails.password = null;

        return res.status(200).json({
            result: userDetails,
        });
    } catch (err) {
        return res
            .status(500)
            .send(safeErrorMessage(err));
    }
};

const getGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.params;

        //check if groupchatID is i in porper format 
        if (!groupChatId || groupChatId.length !== 24) {
            return res.status(400).send("Sorry, Invalid meeting ID");
        }

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) })

        if (!groupChat) {
            return res.status(404).send("Sorry, Invalid meeting ID");
        }
        if (!userCanAccessGroupChat(groupChat, String(userId), { allowOpenCommunity: true })) {
            return res.status(403).send("Forbidden");
        }

        return res.status(200).json(groupChat);
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(safeErrorMessage(err));
    }
};

/**
 * Resolve a Rocket.Chat email-slug to a WisdomLinked user for the active group/community.
 * Realtime subscription lines use `msg: "local_domain"` with `u` = RC bot; Redux participants can lag.
 */
const resolveGroupMemberByRcSlug = async (req: any, res: any) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.params;
        const slug = String(req.query.slug || "").trim();
        if (!groupChatId || groupChatId.length !== 24) {
            return res.status(400).json({ error: "Invalid group chat id" });
        }
        if (!slug) {
            return res.status(400).json({ error: "slug query is required" });
        }

        const groupChat = await GroupChat.findById(String(groupChatId))
            .populate("participants", "email username rocketChatUsername image role status")
            .populate("admin", "email username rocketChatUsername image role status")
            .populate("coModerators", "email username rocketChatUsername image role status");
        if (!groupChat) {
            return res.status(404).json({ error: "Group chat not found" });
        }

        if (!userCanAccessGroupChat(groupChat, String(userId))) {
            return res.status(403).json({ error: "Not a participant" });
        }

        const lower = slug.toLowerCase();
        const pool: any[] = [...((groupChat.participants as any[]) || []), ...((groupChat.coModerators as any[]) || [])];
        const adm = groupChat.admin as any;
        if (adm && adm._id && !pool.some((p: any) => String(p?._id) === String(adm._id))) {
            pool.push(adm);
        }

        let match =
            pool.find(
                (p: any) =>
                    p?.email &&
                    toRocketChatUsername(String(p.email)).toLowerCase() === lower
            ) || null;

        if (!match) {
            return res.status(200).json({ user: null });
        }

        return res.status(200).json({
            user: {
                _id: match._id,
                username: match.username,
                email: match.email,
                image: match.image,
                role: match.role,
                status: match.status,
            },
        });
    } catch (err: any) {
        console.error("[resolveGroupMemberByRcSlug]", err);
        return res.status(500).json({ error: safeErrorMessage(err) });
    }
};

const joinGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;
        if (!groupChatId || groupChatId.length !== 24) {
            return res.status(400).send("Sorry, Invalid meeting ID");
        }

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });
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

        if (groupMemberIds(groupChat).includes(String(userId))) {
            return res.status(400).send("You are already a participant of this meeting");
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) return res.status(404).send("User not found");

        if (currentUser.role === 'customer') {
            const expectedCents = dollarsToCents(groupChat.price);
            let paymentIntentSucceeded_test: any = false;
            let paymentIntentSucceeded_live: any = false;
            if (expectedCents > 0) {
                paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
                paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
            }
            const charge = assertPaymentMatchesExpected(expectedCents, payment_intent, paymentIntentSucceeded_test, paymentIntentSucceeded_live);

            if (charge) {
                await appendPaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: groupChat.name,
                    paymentIntent: payment_intent,
                    customer: userId.toString(),
                    expert: groupChat.admin.toString(),
                    groupChat: groupChatId.toString(),
                })
            }
        }

        currentUser.groupChats.push(groupChatId);
        await currentUser.save();
        currentUser.populate(['events', 'keywords', 'services', 'groupChats'])

        // [REMOVED] updateUsersGroupChatList(userId.toString());

        groupChat.participants = [...groupChat.participants, userId]
        await groupChat.save();

        // update the chat list of all participants
        groupChat.participants.map(participantId => {
            // [REMOVED] updateUsersGroupChatList(participantId.toString());
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
            .send(safeErrorMessage(err));
    }

}


const updateGroupChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupId, name, description, image, services, keywords, start, end, duration, price, totalTimeSpent, type, status, maxAttendees, currency, timezone, isRecurring, recurrenceFrequency } = req.body;

        if (!groupId) {
            throw new Error("Group ID is required");
        }

        const groupChat = await GroupChat.findById(String(groupId));

        if (!groupChat) {
            throw new Error("Group chat not found");
        }
        const canUpdate = groupChat.type === 'community'
            ? isCommunityModerator(groupChat, String(userId))
            : normalizeId(groupChat.admin) === String(userId);
        if (!canUpdate) {
            return res.status(403).send("Forbidden");
        }

        // Construct dynamic update object. Each field is accepted only when it is a
        // primitive (string/number) via an inline typeof check, so a query object
        // (e.g. { $gt: '' }) can never be injected into findByIdAndUpdate.
        const updateFields: Record<string, any> = {};
        if (typeof name === 'string') updateFields.name = name;
        if (typeof description === 'string') updateFields.description = description;
        if (typeof image === 'string') updateFields.image = image;
        // Allow flipping a draft to a published seminar (or saving back as draft).
        if (typeof status === 'string' && ['draft', 'active', 'pending'].includes(status)) {
            updateFields.status = status;
        }
        if (services !== undefined) updateFields.services = await resolveServiceIds(services);
        if (keywords !== undefined) updateFields.keywords = await resolveKeywordIds(keywords);
        if (typeof start === 'string' || typeof start === 'number') updateFields.start = new Date(start);
        if (typeof end === 'string' || typeof end === 'number') updateFields.end = new Date(end);
        if (typeof duration === 'string' || typeof duration === 'number') updateFields.duration = Number(duration);
        if (typeof price === 'string' || typeof price === 'number') updateFields.price = Number(price);
        if (typeof maxAttendees === 'number') updateFields.maxAttendees = maxAttendees;
        if (typeof currency === 'string') updateFields.currency = currency;
        if (typeof timezone === 'string') updateFields.timezone = timezone;
        if (typeof isRecurring === 'boolean') updateFields.isRecurring = isRecurring;
        if (isRecurring === true && RECURRENCE_FREQUENCIES.includes(recurrenceFrequency)) {
            updateFields.recurrenceFrequency = recurrenceFrequency;
        }
        if (typeof type === 'string' && normalizeId(groupChat.admin) === String(userId)) updateFields.type = type;
        if (typeof totalTimeSpent === 'string' || typeof totalTimeSpent === 'number') {
            const existingTotalTimeSpent = groupChat.totalTimeSpent || 0;
            updateFields.totalTimeSpent = existingTotalTimeSpent + Number(totalTimeSpent);
        }

        // Update group chat with only provided fields
        await GroupChat.findByIdAndUpdate(String(groupId), updateFields, { new: true });

        // [REMOVED] updateUsersGroupChatList(userId.toString());

        const anchor = await GroupChat.findById(String(groupId));

        const becomesRecurring =
            anchor &&
            anchor.type === 'seminar' &&
            anchor.status === 'active' &&
            isRecurring === true &&
            RECURRENCE_FREQUENCIES.includes(recurrenceFrequency) &&
            !anchor.seriesId &&
            anchor.start &&
            anchor.end;

        if (becomesRecurring) {
            await GroupChat.findByIdAndUpdate(String(groupId), { seriesId: anchor._id });
            const startDates = buildRecurrenceStartDates(anchor.start, recurrenceFrequency);
            const durationMs = new Date(anchor.end).getTime() - new Date(anchor.start).getTime();
            const created = [];
            for (let i = 1; i < startDates.length; i += 1) {
                const occurrenceStart = startDates[i];
                const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
                const occurrence = await GroupChat.create({
                    name: anchor.name,
                    description: anchor.description,
                    image: anchor.image,
                    services: anchor.services,
                    keywords: anchor.keywords,
                    duration: anchor.duration,
                    price: anchor.price,
                    participants: [anchor.admin],
                    admin: anchor.admin,
                    type: 'seminar',
                    status: 'active',
                    createdBy: anchor.createdBy,
                    maxAttendees: anchor.maxAttendees,
                    currency: anchor.currency,
                    timezone: anchor.timezone,
                    start: occurrenceStart,
                    end: occurrenceEnd,
                    isRecurring: true,
                    recurrenceFrequency,
                    seriesId: anchor._id,
                });
                created.push(occurrence._id);
            }
            if (created.length) {
                const host = await User.findById(anchor.admin);
                if (host) {
                    host.groupChats.push(...created);
                    await host.save();
                }
            }
        }

        // Publishing a seminar (draft -> active) should ensure its group chat exists.
        if (groupChat.type === 'seminar' && updateFields.status === 'active' && !groupChat.rcChannelId) {
            await syncGroupRocketChannel(String(groupId));
        }

        const userDetails = await getFullUserData(req.user.email);
        userDetails.token = null;
        userDetails.password = null;

        return res.status(200).json({
            result: userDetails,
        });
    } catch (err) {
        return res.status(500).send(safeErrorMessage(err));
    }
};


// Direct seminar registration — no host approval. Enrolling in one occurrence
// enrolls the student across the whole recurring series. Full seminars are
// rejected. (1:1 appointments keep their approval flow elsewhere.)
const registerForSeminar = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        if (groupChat.type !== 'seminar') {
            return res.status(400).send("This group is not a seminar");
        }

        if (groupChat.admin.toString() === userId) {
            return res
                .status(403)
                .send("Forbidden. Group admin can't register for their own seminar.");
        }

        if (groupChat.status !== 'active') {
            return res.status(400).send("Sorry, the seminar is not active");
        }

        // Series enrollment is shared, so any occurrence the student already sits
        // in means they're registered for the whole series.
        const alreadyParticipant = (groupChat.participants || []).some(
            (p: any) => p.toString() === userId,
        );
        if (alreadyParticipant) {
            return res.status(409).send("You are already registered for this seminar.");
        }

        // Capacity guard — a full seminar can't take more students.
        if (seminarIsFull(groupChat)) {
            return res.status(409).send("Sorry, this seminar is full.");
        }

        // Verify payment against the seminar price stored on the group, not the client.
        const expectedCents = dollarsToCents(groupChat.price);
        let paymentIntentSucceeded_test: any = false;
        let paymentIntentSucceeded_live: any = false;
        if (expectedCents > 0) {
            paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
            paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
        }
        const charge = assertPaymentMatchesExpected(expectedCents, payment_intent, paymentIntentSucceeded_test, paymentIntentSucceeded_live);

        const expert = await User.findById(groupChat.admin.toString());
        if (!expert) {
            return res.status(404).send("Expert not found for this seminar");
        }
        assertBookingLeadTime(
            expert,
            groupChat.start,
            "Seminar registrations"
        );

        const customer = await User.findById(userId);
        if (!customer) {
            return res.status(404).send("User not found");
        }

        // Enroll in the target occurrence plus every future sibling in the series.
        const occurrences = [groupChat];
        if (groupChat.seriesId) {
            const now = Date.now();
            const siblings = await GroupChat.find({
                seriesId: groupChat.seriesId,
                type: 'seminar',
                _id: { $ne: groupChat._id },
            });
            for (const sib of siblings) {
                const sibStart = sib.start ? new Date(sib.start).getTime() : 0;
                if (sibStart && sibStart >= now) occurrences.push(sib);
            }
        }

        for (const occ of occurrences) {
            if (!occ.participants.map(String).includes(String(userId))) {
                occ.participants = [...occ.participants, userId];
                await occ.save();
                customer.groupChats.push(occ._id);
            }
        }
        await customer.save();

        // Pull the newly-enrolled student into the seminar's chat channel. The
        // channel is keyed by seriesId, so one sync covers the whole series.
        await syncGroupRocketChannel(String(groupChat._id));

        if (charge) {
            await appendPaymentHistory({
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description: groupChat.name,
                paymentIntent: payment_intent,
                customer: customer._id.toString(),
                expert: expert._id.toString(),
                groupChat: groupChat._id.toString(),
            })

            await sendBookingReceiptAndConfirmation({
                payment_intent,
                charge,
                sessionType: 'Seminar',
                sessionName: groupChat.name,
                expertName: expert.username,
                studentName: customer.username,
                studentEmail: customer.email,
                start: groupChat.start,
                duration: groupChat.duration,
                timeZone: customer.timeZone,
            });
        }

        scheduleEmailReminder(customer.email, customer.username, groupChat.name, groupChat.start, groupChat.duration, customer.timeZone);

        const userDetails = await getFullUserData(customer.email);
        userDetails.token = null;
        userDetails.password = null;

        return res.status(200).json({
            success: true,
            result: userDetails,
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(safeErrorMessage(err));
    }
};

const acceptIndividualAppointment = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { groupChatId, payment_intent } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        if (role === 'customer') {
            const expectedCents = dollarsToCents(groupChat.price);
            let paymentIntentSucceeded_test: any = false;
            let paymentIntentSucceeded_live: any = false;
            if (expectedCents > 0) {
                paymentIntentSucceeded_test = await checkPaymentIntentSucceeded(payment_intent, 'test')
                paymentIntentSucceeded_live = await checkPaymentIntentSucceeded(payment_intent, 'live')
            }
            const charge = assertPaymentMatchesExpected(expectedCents, payment_intent, paymentIntentSucceeded_test, paymentIntentSucceeded_live);

            if (charge) {
                await appendPaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: groupChat.name,
                    paymentIntent: payment_intent,
                    customer: String(userId),
                    expert: groupChat.admin.toString(),
                    groupChat: groupChatId,
                })

                const payer = await User.findById(userId);
                const expertUser = await User.findById(groupChat.admin.toString());
                await sendBookingReceiptAndConfirmation({
                    payment_intent,
                    charge,
                    sessionType: '1:1 Session',
                    sessionName: groupChat.name,
                    expertName: expertUser?.username,
                    studentName: payer?.username,
                    studentEmail: payer?.email,
                    start: groupChat.start,
                    duration: groupChat.duration,
                    timeZone: payer?.timeZone,
                });
            }
        }

        groupChat.status = 'active';
        await groupChat.save();

        res.status(200).send("Group chat accepted successfully!");

        void (async () => {
            try {
                const expertUser = await User.findById(userId);
                const customerUser = await User.findById(groupChat.createdBy);
                if (customerUser?.email) {
                    await sendEmailMeetingAcceptance(
                        customerUser.email,
                        customerUser.username,
                        groupChat.name,
                        groupChat.start,
                        groupChat.duration,
                        customerUser.timeZone,
                    );
                }
                if (expertUser?.email) {
                    await scheduleEmailReminder(
                        expertUser.email,
                        expertUser.username,
                        groupChat.name,
                        groupChat.start,
                        groupChat.duration,
                        expertUser.timeZone,
                    );
                }
                if (customerUser?.email) {
                    await scheduleEmailReminder(
                        customerUser.email,
                        customerUser.username,
                        groupChat.name,
                        groupChat.start,
                        groupChat.duration,
                        customerUser.timeZone,
                    );
                }
            } catch (notifyErr) {
                console.error('[acceptIndividualAppointment] notification failed:', notifyErr?.message || notifyErr);
            }
        })();
        return;

    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
}

const leaveGroup = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        const currentUser = await User.findById(userId);

        if (!currentUser) {
            return res.status(404).send("User not found");
        }
        if (!userCanAccessGroupChat(groupChat, String(userId))) {
            return res.status(403).send("You are not a member of this group");
        }

        const isCommunity = groupChat.type === 'community';
        const wasAdmin = groupChat.admin && groupChat.admin.toString() === currentUser._id.toString();
        const remainingParticipants = groupChat.participants.filter(
            (participant) => participant.toString() !== currentUser._id.toString(),
        );

        /** Last member leaves a community → remove the room for everyone (no orphan admin). */
        if (isCommunity && remainingParticipants.length === 0) {
            await User.updateMany(
                {
                    $or: [{ generalChats: groupChat._id }, { groupChats: groupChat._id }],
                },
                {
                    $pull: {
                        generalChats: groupChat._id,
                        groupChats: groupChat._id,
                    },
                },
            );
            if (groupChat.rcChannelId && currentUser.email) {
                try {
                    await kickUserFromGroupChannel(String(groupChat.rcChannelId), String(currentUser.email));
                } catch (e) {
                    console.warn('[leaveGroup] RC kick (orphan)', e);
                }
            }
            await GroupChat.deleteOne({ _id: groupChat._id });
            return res
                .status(200)
                .send(
                    'The community was removed because you were the only member. Create a new community to start again.',
                );
        }

        /** Community admin leaves but others remain → promote a new admin so the room stays controlled. */
        if (isCommunity && wasAdmin && remainingParticipants.length > 0) {
            groupChat.admin = remainingParticipants[0];
        }

        groupChat.participants = remainingParticipants;
        await groupChat.save();

        currentUser.groupChats = currentUser.groupChats.filter((chat) => {
            return chat.toString() !== groupChat._id.toString();
        });

        if (isCommunity && Array.isArray(currentUser.generalChats)) {
            currentUser.generalChats = currentUser.generalChats.filter(
                (chat: any) => chat.toString() !== groupChat._id.toString(),
            );
        }

        await currentUser.save();

        if (isCommunity && groupChat.rcChannelId && currentUser.email) {
            const rid = String(groupChat.rcChannelId);
            const displayName = wlDisplayName(currentUser);
            try {
                await kickUserFromGroupChannel(rid, String(currentUser.email));
            } catch (e) {
                console.warn('[leaveGroup] RC kick', e);
            }
            try {
                await sendMessageToRC(
                    rid,
                    `${WL_COMMUNITY_SYS_PREFIX}${displayName} has left the community.`,
                    'Community',
                );
            } catch (e) {
                console.warn('[leaveGroup] RC leave message', e);
            }
        }

        return res.status(200).send("You have left the group!");
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .send(safeErrorMessage(err));
    }
};

const removeMemberFromCommunityChat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, memberUserId, reason } = req.body || {};

        if (!groupChatId || !memberUserId) {
            return res.status(400).json({ error: 'groupChatId and memberUserId are required' });
        }

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId), type: 'community' });
        if (!groupChat) {
            return res.status(404).json({ error: 'Community chat not found' });
        }

        if (!isCommunityModerator(groupChat, userId)) {
            return res.status(403).json({ error: 'Only community moderators can remove members' });
        }

        if (String(memberUserId) === String(userId)) {
            return res.status(400).json({ error: 'Use Leave community to leave yourself' });
        }

        const member = await User.findById(String(memberUserId));
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        const wasParticipant = groupChat.participants.some(
            (p) => p.toString() === memberUserId.toString(),
        );
        if (!wasParticipant) {
            return res.status(400).json({ error: 'User is not in this community' });
        }

        const normalizedReason = normalizeModerationReason(reason);

        groupChat.participants = groupChat.participants.filter(
            (p) => p.toString() !== memberUserId.toString(),
        );
        groupChat.moderationNotes = Array.isArray(groupChat.moderationNotes)
            ? groupChat.moderationNotes
            : [];
        groupChat.moderationNotes.push({
            action: 'remove_member',
            by: userId,
            target: memberUserId,
            reason: normalizedReason,
            createdAt: new Date(),
        });
        await groupChat.save();

        await MeetingThread.updateMany(
            { groupChatId: groupChat._id, status: 'active' },
            {
                $addToSet: {
                    removedParticipants: {
                        userId: memberUserId,
                        removedBy: userId,
                        reason: normalizedReason,
                        removedAt: new Date(),
                    },
                },
            },
        );

        if (Array.isArray(member.generalChats)) {
            member.generalChats = member.generalChats.filter(
                (c) => c.toString() !== groupChat._id.toString(),
            );
        }
        member.groupChats = (member.groupChats || []).filter(
            (c) => c.toString() !== groupChat._id.toString(),
        );
        await member.save();

        const adminUser = await User.findById(userId);

        if (groupChat.rcChannelId && member.email) {
            try {
                await kickUserFromGroupChannel(String(groupChat.rcChannelId), String(member.email));
            } catch (e) {
                console.warn('[removeMemberFromCommunityChat] RC kick', e);
            }
            const adminName = wlDisplayName(adminUser);
            const memberName = wlDisplayName(member);
            const userFacingNotice = buildRemovedUserNotice(normalizedReason);
            try {
                await sendMessageToRC(
                    String(groupChat.rcChannelId),
                    `${WL_COMMUNITY_SYS_PREFIX}${memberName} has been removed from the community by ${adminName}. Reason: ${normalizedReason}.`,
                    'Community',
                );
                await sendMessageToRC(
                    String(groupChat.rcChannelId),
                    `${WL_COMMUNITY_SYS_PREFIX}${memberName}: ${userFacingNotice}`,
                    'Community',
                );
            } catch (e) {
                console.warn('[removeMemberFromCommunityChat] RC message', e);
            }
        }

        return res.status(200).json({
            success: true,
            notice: buildRemovedUserNotice(normalizedReason),
        });
    } catch (err) {
        console.error('[removeMemberFromCommunityChat]', err);
        return res.status(500).json({ error: safeErrorMessage(err) });
    }
};

const deleteGroup = async (req, res) => {
    try {
        const { userId } = req.user;
        // scope: 'series' removes every occurrence sharing the seriesId,
        // 'occurrence' removes only the targeted session. Ignored for
        // non-recurring groups (always a single doc).
        const { groupChatId, scope } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            throw new Error("Sorry, the group chat doesn't exist");
        }

        if (String(groupChat.admin) !== String(userId)) {
            throw new Error("Forbidden. Only group admins can delete a group.");
        }

        // Recurring seminars span multiple docs sharing a seriesId. Enrolling in
        // one occurrence enrolls a student across the whole series, so a seminar
        // with students enrolled can't be self-deleted regardless of scope —
        // the host must contact an admin.
        const seriesDocs =
            groupChat.type === 'seminar' && groupChat.seriesId
                ? await GroupChat.find({ seriesId: groupChat.seriesId })
                : [groupChat];

        if (groupChat.type === 'seminar') {
            const enrolled = new Set<string>();
            for (const g of seriesDocs) {
                enrolledStudentIds(g).forEach((id) => enrolled.add(id));
            }
            if (enrolled.size > 0) {
                return res.status(409).json({
                    status: 'FAIL',
                    error:
                        'You cannot delete this seminar right now since students are already enrolled in it. If you still want to delete it, please contact admin.',
                });
            }
        }

        // No students enrolled: honour the host's scope choice. 'occurrence'
        // deletes just this session; anything else (incl. non-recurring) removes
        // the whole series so no orphan occurrences remain.
        const groupChats =
            scope === 'occurrence' ? [groupChat] : seriesDocs;

        const deleteIds = groupChats.map((g: any) => g._id.toString());

        // Pull the deleted group(s) from every participant's chat lists so they
        // disappear from calendars, upcoming lists, and seminar hubs on refresh.
        const participantIds = new Set<string>();
        for (const g of groupChats) {
            (Array.isArray(g.participants) ? g.participants : []).forEach((p: any) =>
                participantIds.add(p.toString()),
            );
        }
        for (const friendId of participantIds) {
            const participant = await User.findById(String(friendId));
            if (!participant) continue;

            participant.groupChats = (participant.groupChats || []).filter(
                (chat: any) => !deleteIds.includes(chat.toString()),
            );

            if (groupChat.type === 'community' && Array.isArray(participant.generalChats)) {
                participant.generalChats = participant.generalChats.filter(
                    (chat: any) => !deleteIds.includes(chat.toString()),
                );
            }

            await participant.save();
        }

        await GroupChat.deleteMany({ _id: { $in: groupChats.map((g: any) => g._id) } });

        return res.status(200).send("Group deleted successfully!");
    } catch (err: any) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const cancelIndividualAppointment = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.body;

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });
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
            const participant = await User.findById(String(participantId));
            if (participant) {
                participant.groupChats = participant.groupChats.filter((chat) => chat.toString() !== groupChatId);
                await participant.save();
            }
            // update the users group chat list
            // [REMOVED] updateUsersGroupChatList(participantId.toString());
        });

        if (groupChat.admin.toString() !== userId) {

            const payment = await PaymentHistory.findOne({ groupChat: String(groupChatId), customer: userId });

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
            .send(safeErrorMessage(err));
    }
}

const leftSeminar = async (req, res) => {
    try {
        const { userId } = req.user;
        const { seminarId } = req.body;

        const groupChat = await GroupChat.findById(String(seminarId));
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
        // [REMOVED] updateUsersGroupChatList(userId);

        groupChat.participants.forEach((participant) => {
            // update the participants chat list
            // [REMOVED] updateUsersGroupChatList(participant.toString());
        });

        // Seminar charges are recorded against the groupChat (direct enroll), so
        // refund the matching charge for this student.
        const payment = await PaymentHistory.findOne({ groupChat: String(seminarId), customer: userId, paymentType: 'charge' })
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
            .send(safeErrorMessage(err));
    }
}

const setCommunityCoModerator = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, memberUserId, isCoModerator } = req.body || {};
        if (!groupChatId || !memberUserId) {
            return res.status(400).json({ error: "groupChatId and memberUserId are required" });
        }

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId), type: "community" });
        if (!groupChat) return res.status(404).json({ error: "Community chat not found" });

        const adminId = String(groupChat?.admin?._id ?? groupChat?.admin ?? "");
        if (String(userId) !== adminId) {
            return res.status(403).json({ error: "Only the community admin can manage co-moderators" });
        }
        if (String(memberUserId) === adminId) {
            return res.status(400).json({ error: "Community admin is already a moderator" });
        }

        const isParticipant = (groupChat.participants || []).some(
            (p: any) => String(p?._id ?? p) === String(memberUserId),
        );
        if (!isParticipant) {
            return res.status(400).json({ error: "Selected user is not a participant in this community" });
        }

        groupChat.coModerators = Array.isArray(groupChat.coModerators) ? groupChat.coModerators : [];
        if (Boolean(isCoModerator)) {
            if (!groupChat.coModerators.some((id: any) => String(id) === String(memberUserId))) {
                groupChat.coModerators.push(memberUserId);
            }
        } else {
            groupChat.coModerators = groupChat.coModerators.filter(
                (id: any) => String(id) !== String(memberUserId),
            );
        }
        await groupChat.save();
        await groupChat.populate("coModerators", "_id username email image");

        return res.status(200).json({
            success: true,
            coModerators: groupChat.coModerators || [],
        });
    } catch (err) {
        return res.status(500).json({ error: safeErrorMessage(err) });
    }
};

/**
 * Lazily ensure a seminar's Rocket.Chat group channel exists (back-fills seminars
 * created before auto-provisioning). Any seminar member may trigger it; returns the
 * channel id so the client can open the chat.
 */
const ensureSeminarChannel = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId } = req.body;

        if (!groupChatId || String(groupChatId).length !== 24) {
            return res.status(400).json({ status: 'FAIL', error: 'Invalid seminar id' });
        }

        const groupChat = await GroupChat.findById(String(groupChatId));
        if (!groupChat || groupChat.type !== 'seminar') {
            return res.status(404).json({ status: 'FAIL', error: 'Seminar not found' });
        }
        if (!userCanAccessGroupChat(groupChat, String(userId))) {
            return res.status(403).json({ status: 'FAIL', error: 'Forbidden' });
        }

        let rcChannelId = groupChat.rcChannelId ? String(groupChat.rcChannelId) : null;
        if (!rcChannelId) {
            rcChannelId = await syncGroupRocketChannel(String(groupChat._id));
        }

        return res.status(200).json({ status: 'SUCCESS', rcChannelId });
    } catch (err) {
        return res.status(500).json({ status: 'FAIL', error: safeErrorMessage(err) });
    }
};

module.exports = {
    createGroupChat,
    createGroupChatByUser,
    proposeIndividualAppointment,
    ensureSeminarChannel,
    getGroupChat,
    resolveGroupMemberByRcSlug,
    joinGroupChat,
    updateGroupChat,
    registerForSeminar,
    acceptIndividualAppointment,
    leaveGroup,
    deleteGroup,
    createGeneralChatAndJoinGlobalChat,
    joinGeneralChat,
    joinPrivateChat,
    cancelIndividualAppointment,
    createCommunityChat,
    joinCommunityChat,
    addParticipantsToCommunityChat,
    getAllCommunityChats,
    leftSeminar,
    removeMemberFromCommunityChat,
    setCommunityCoModerator,
};
