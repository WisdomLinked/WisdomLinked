import { Request, Response } from 'express';
import { wlDisplayName } from '../utils/wlDisplayName';
const mongoose = require("mongoose");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const Service = require("../models/Service");
const MeetingThread = require("../models/MeetingThread");
const PaymentHistory = require("../models/PaymentHistory");
// Socket notifications removed — Rocket.Chat handles real-time updates now
const { checkPaymentIntentSucceeded, checkPaymentIntentAuthorized, capturePaymentIntent, cancelPaymentIntent, refundPaymentIntent, sendBookingReceiptAndConfirmation } = require("./stripe.controller");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");
const AppState = require("../models/AppState");
const { appendPaymentHistory } = require("./payment.controller");
const { getFullUserData } = require("../middlewares/requireAuth");
const { classifyMajors } = require("../utils/majorClassification");

// Services match by prefix (client may send "Study abroad" while the DB stores "Study abroad
// consultation"); unknown services are created. Majors instead go through classifyMajors.
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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


const sanitizeTags = (tags: any): string[] => {
    if (!Array.isArray(tags)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tags) {
        if (typeof t !== 'string') continue;
        const value = t.trim().slice(0, 40);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
        if (out.length >= 5) break;
    }
    return out;
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

import { enrolledStudentIds, seminarIsFull, computeSeatRequestDeadline, seatRequestWindowOpen } from '../utils/seminarCapacity';

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
const { scheduleEmailReminder, sendEmailMeetingRequestToCustomer, sendEmailMeetingRequestToExpert, sendEmailMeetingAcceptance, sendNotificationEmail } = require('../services/notifications')
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
        const { name, description, services, keywords, start, end, duration, expert, payment_intent, purposeOther } = req.body;


        if (checkTitleNameInvalid('Name', name)) {
            await refundOrphanBookingCharge(payment_intent, userId, "Invalid session name");
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const titleLength = typeof name === 'string' ? name.trim().length : 0;
        if (titleLength < 10 || titleLength > 60) {
            await refundOrphanBookingCharge(payment_intent, userId, "Invalid session title");
            throw new Error("Session title must be between 10 and 60 characters");
        }

        const noteLength = typeof description === 'string' ? description.trim().length : 0;
        if (noteLength > 0 && (noteLength < 50 || noteLength > 500)) {
            await refundOrphanBookingCharge(payment_intent, userId, "Invalid session note");
            throw new Error("Session note must be between 50 and 500 characters");
        }

        const expertUser = await User.findById(String(expert));
        if (!expertUser) {
            await refundOrphanBookingCharge(payment_intent, userId, "Expert not found");
            throw new Error("Expert not found");
        }

        const currentUser = await User.findById(userId);
        const expectedCents = computeBookingPriceCents(Number(duration), extractHourlyRate(expertUser.price));

        // A captured-but-mismatched amount is refunded inside the helper before it throws.
        const charge = await verifyBookingChargeOrRefund({
            payment_intent,
            expectedCents,
            name,
            customer: currentUser,
            expert: expertUser,
            groupChatId: undefined,
        });

        // Money is captured — refund + notify if we can't create the session below.
        const refundAndFail = async (err: any) => {
            await refundBookingCharge({
                payment_intent,
                charge,
                name,
                customer: currentUser,
                expert: expertUser,
                groupChatId: undefined,
                reason: err?.message || 'Could not create the session after payment',
            });
            return res.status(500).send(safeHttp500Message(err));
        };

        try {
            assertBookingLeadTime(expertUser, start);
            assertDurationAllowed(expertUser, duration);
            await assertBookingSlotValid(expertUser, start, end);
        } catch (validationErr) {
            return refundAndFail(validationErr);
        }

        let chat: any;
        try {
            const _services = await resolveServiceIds(services);
            const { officialIds: _keywords, customValues: _customKeywords } = await classifyMajors(keywords);

            // create group
            chat = await GroupChat.create({
                name: name,
                description: description,
                services: _services,
                keywords: _keywords,
                customKeywords: _customKeywords,
                purposeOther: typeof purposeOther === 'string' ? purposeOther.trim().slice(0, 100) : undefined,
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

            currentUser.groupChats.push(chat._id);
            await currentUser.save();
            currentUser.populate(['events', 'keywords', 'services', 'groupChats'])

            // [REMOVED] updateUsersGroupChatList(userId.toString());

            expertUser.groupChats.push(chat._id);
            await expertUser.save();
            expertUser.populate(['events', 'keywords', 'services', 'groupChats'])

            // [REMOVED] updateUsersGroupChatList(expert.toString());
        } catch (createErr) {
            console.log('[createGroupChatByUser] session creation failed after charge', createErr);
            return refundAndFail(createErr);
        }

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

            // The session is already created and charged — a failing email must
            // never surface as a failed booking (or crash the request).
            try {
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
            } catch (emailErr) {
                console.log('[createGroupChatByUser] booking receipt email failed', emailErr);
            }
        }

        Promise.resolve(
            sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, name, chat.start, duration, expectedCents / 100, true, expertUser.timeZone),
        ).catch((emailErr) => {
            console.log('[createGroupChatByUser] expert notification email failed', emailErr);
        });

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
        const { name, description, start, end, duration, price, customer, overrideAvailability } = req.body;

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

        await assertBookingSlotValid(expertUser, start, end, { allowOutsideAvailability: !!overrideAvailability });

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
        const { name, description, image, services, keywords, tags, start, end, duration, price, type, status, customerId, maxAttendees, currency, timezone, isRecurring, recurrenceFrequency, purposeOther } = req.body;

        if (checkTitleNameInvalid('Name', name)) {
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const _services = await resolveServiceIds(services);
        const { officialIds: _keywords, customValues: _customKeywords } = await classifyMajors(keywords);
        const _tags = sanitizeTags(tags);

        const sharedFields = {
            name: name,
            description: description,
            image: image,
            services: _services,
            keywords: _keywords,
            customKeywords: _customKeywords,
            tags: _tags,
            purposeOther: typeof purposeOther === 'string' ? purposeOther.trim().slice(0, 100) : undefined,
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
            createdGroupChatId: String(chat._id),
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
            // Refunds the charge if the captured amount doesn't match the expected price.
            const charge = await verifyBookingChargeOrRefund({
                payment_intent,
                expectedCents,
                name: groupChat.name,
                customer: currentUser,
                expert: null,
                groupChatId: groupChat._id.toString(),
            });

            if (charge) {
                await appendPaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: groupChat.name,
                    paymentIntent: payment_intent,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
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
        const { groupId, name, description, image, services, keywords, tags, start, end, duration, price, totalTimeSpent, type, status, maxAttendees, currency, timezone, isRecurring, recurrenceFrequency, purposeOther } = req.body;

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
        if (tags !== undefined) updateFields.tags = sanitizeTags(tags);
        if (typeof purposeOther === 'string') updateFields.purposeOther = purposeOther.trim().slice(0, 100);
        if (keywords !== undefined) {
            const { officialIds, customValues } = await classifyMajors(keywords);
            updateFields.keywords = officialIds;
            updateFields.customKeywords = customValues;
        }
        if (typeof start === 'string' || typeof start === 'number') updateFields.start = new Date(start);
        if (typeof end === 'string' || typeof end === 'number') updateFields.end = new Date(end);
        if (typeof duration === 'string' || typeof duration === 'number') updateFields.duration = Number(duration);
        if (typeof price === 'string' || typeof price === 'number') updateFields.price = Number(price);
        if (typeof maxAttendees === 'number') updateFields.maxAttendees = maxAttendees;
        else if (maxAttendees === null) updateFields.maxAttendees = null;
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
                    customKeywords: anchor.customKeywords,
                    tags: anchor.tags,
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
// Enrolls a student into a seminar (plus every future sibling in its series),
// syncs the chat channel, records the charge, and sends the receipt + reminder.
// Shared by direct registration and expert-approved overflow seat requests.
// recordPayment=false lets the seat-request approval path update its existing
// 'pending' PaymentHistory to 'completed' instead of appending a duplicate charge.
const enrollAndConfirmSeminar = async ({ groupChat, customer, expert, charge, payment_intent, recordPayment = true }: any) => {
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
        if (!occ.participants.map(String).includes(String(customer._id))) {
            occ.participants = [...occ.participants, customer._id];
            await occ.save();
            customer.groupChats.push(occ._id);
        }
    }
    await customer.save();

    // Pull the newly-enrolled student into the seminar's chat channel. The
    // channel is keyed by seriesId, so one sync covers the whole series.
    await syncGroupRocketChannel(String(groupChat._id));

    if (charge) {
        if (recordPayment) {
            await appendPaymentHistory({
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description: groupChat.name,
                paymentIntent: payment_intent,
                receiptUrl: charge.receiptUrl,
                receiptNumber: charge.receiptNumber,
                customer: customer._id.toString(),
                expert: expert._id.toString(),
                groupChat: groupChat._id.toString(),
            });
        }

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
};

const registerForSeminar = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        // The fee is captured on the client during confirmPayment, so once we know
        // a real charge landed, any failure to enroll from here must refund it.
        if (!groupChat) {
            await refundOrphanBookingCharge(payment_intent, userId, "Seminar no longer exists");
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }
        if (groupChat.type !== 'seminar') {
            await refundOrphanBookingCharge(payment_intent, userId, "Target is not a seminar");
            return res.status(400).send("This group is not a seminar");
        }

        const customer = await User.findById(userId);
        const expert = await User.findById(groupChat.admin.toString());

        // Verify payment against the seminar price stored on the group, not the client.
        // A captured-but-mismatched amount is refunded inside the helper before it throws.
        const expectedCents = dollarsToCents(groupChat.price);
        const charge = await verifyBookingChargeOrRefund({
            payment_intent,
            expectedCents,
            name: groupChat.name,
            customer,
            expert,
            groupChatId: groupChat._id.toString(),
        });

        // Money is captured at this point — refund + notify on every failure path.
        const refundAndFail = async (code: number, message: string, reason: string) => {
            await refundBookingCharge({ payment_intent, charge, name: groupChat.name, customer, expert, groupChatId: groupChat._id.toString(), reason });
            return res.status(code).send(message);
        };

        if (groupChat.admin.toString() === userId) {
            return refundAndFail(403, "Forbidden. Group admin can't register for their own seminar.", "Host cannot register for their own seminar");
        }
        if (groupChat.status !== 'active') {
            return refundAndFail(400, "Sorry, the seminar is not active", "Seminar is no longer active");
        }
        const alreadyParticipant = (groupChat.participants || []).some(
            (p: any) => p.toString() === userId,
        );
        if (alreadyParticipant) {
            return refundAndFail(409, "You are already registered for this seminar.", "Already registered (duplicate payment)");
        }
        // Capacity guard — a full seminar can't take more students. This can happen
        // when the last seat is claimed between intent creation and confirmation.
        if (seminarIsFull(groupChat)) {
            return refundAndFail(409, "Sorry, this seminar is full.", "Seminar reached capacity before registration completed");
        }
        if (!expert) {
            return refundAndFail(404, "Expert not found for this seminar", "Seminar host not found");
        }
        if (!customer) {
            return refundAndFail(404, "User not found", "Student account not found");
        }

        try {
            assertBookingLeadTime(expert, groupChat.start, "Seminar registrations");
        } catch (leadErr: any) {
            return refundAndFail(400, safeHttp500Message(leadErr), leadErr?.message || "Registration lead time not met");
        }

        try {
            await enrollAndConfirmSeminar({ groupChat, customer, expert, charge, payment_intent });
        } catch (enrollErr) {
            console.log('[registerForSeminar] enrollment failed after charge', enrollErr);
            return refundAndFail(500, "We couldn't complete your registration, so your payment has been refunded.", "Enrollment error after payment");
        }

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
            .send(safeHttp500Message(err));
    }
};

const sendSeminarEmail = async (to: string, subject: string, bodyHtml: string) => {
    if (!to) return;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            ${bodyHtml}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">Best regards,<br><strong>WisdomLinked Team</strong></p>
        </div>
    </div>`;
    try {
        await sendNotificationEmail(to, subject, html);
    } catch (err) {
        console.log('[sendSeminarEmail]', err.message);
    }
};

const buildBookingRefundEmail = (bookingName: string | null, amountCents: number, currency: string, reason: string) => `
    <h2 style="color:#28a745;margin-top:0;">Payment refunded</h2>
    <p>We were unable to complete your booking${bookingName ? ` for "<strong>${bookingName}</strong>"` : ''},
       so your payment has been fully refunded. You have not been enrolled.</p>
    <div style="background-color:#fff;padding:12px 15px;border-radius:6px;margin:12px 0;">
        <p style="margin:4px 0;"><strong>Amount:</strong> $${(amountCents / 100).toFixed(2)} ${String(currency || 'USD').toUpperCase()}</p>
        <p style="margin:4px 0;"><strong>Reason:</strong> ${reason}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    </div>
    <p>The refund will appear on your original payment method within 5–10 business days.
       Feel free to try again, or contact support if you need help.</p>`;

// Fully refunds a captured booking charge (seminar or 1:1) when the booking can't be
// completed, logs a refund PaymentHistory record, and emails the student the details.
// Passing no amount to refundPaymentIntent issues a full refund (avoids cents/dollars ambiguity).
const refundBookingCharge = async ({ payment_intent, charge, name, customer, expert, groupChatId, reason }: any) => {
    if (!charge || !payment_intent) return false;
    const refund = await refundPaymentIntent(payment_intent, null, charge.paidBy);
    if (!refund) {
        console.log('[refundBookingCharge] refund failed', payment_intent, reason);
        return false;
    }
    await appendPaymentHistory({
        stripeMode: charge.paidBy,
        paymentType: 'refund',
        amount: charge.amount,
        currency: charge.currency,
        description: `Refund: ${name || 'Booking'} — ${reason}`,
        paymentIntent: refund.payment_intent,
        customer: customer?._id?.toString(),
        expert: expert?._id?.toString(),
        groupChat: groupChatId,
    });
    if (customer?.email) {
        await sendSeminarEmail(
            customer.email,
            `Refund issued — ${name || 'Booking'}`,
            buildBookingRefundEmail(name || null, charge.amount, charge.currency, reason),
        );
    }
    return true;
};

// Best-effort refund for a captured payment when the target booking is missing or
// invalid (we don't yet know the Stripe mode, so probe both). Rare edge case.
const refundOrphanBookingCharge = async (payment_intent: string, userId: string, reason: string) => {
    if (!payment_intent) return;
    let mode: 'test' | 'live' | null = null;
    let intent: any = await checkPaymentIntentSucceeded(payment_intent, 'test');
    if (intent) mode = 'test';
    else {
        intent = await checkPaymentIntentSucceeded(payment_intent, 'live');
        if (intent) mode = 'live';
    }
    if (!mode || !intent) return;
    const customer = userId ? await User.findById(String(userId)) : null;
    await refundBookingCharge({
        payment_intent,
        charge: { paidBy: mode, amount: intent.amount, currency: intent.currency },
        name: null,
        customer,
        expert: null,
        groupChatId: undefined,
        reason,
    });
};

// Verifies a captured payment against the expected price. If the funds were captured
// but for the wrong amount, the charge is fully refunded before we reject — then the
// usual assertion throws so the caller still fails the request.
const verifyBookingChargeOrRefund = async ({ payment_intent, expectedCents, name, customer, expert, groupChatId }: any) => {
    let succeededTest: any = false;
    let succeededLive: any = false;
    if (expectedCents > 0) {
        succeededTest = await checkPaymentIntentSucceeded(payment_intent, 'test');
        succeededLive = await checkPaymentIntentSucceeded(payment_intent, 'live');
    }
    const captured = succeededTest || succeededLive;
    if (captured && captured.amount !== expectedCents) {
        await refundBookingCharge({
            payment_intent,
            charge: { paidBy: succeededTest ? 'test' : 'live', amount: captured.amount, currency: captured.currency },
            name,
            customer,
            expert,
            groupChatId,
            reason: 'Payment amount did not match the expected price',
        });
    }
    return assertPaymentMatchesExpected(expectedCents, payment_intent, succeededTest, succeededLive);
};

// Overflow: the seminar is at capacity but the student has authorized (held) the
// fee. Records a pending request for the expert to approve; funds are captured on
// approval and released on rejection/expiry. No enrollment happens here.
const requestSeminarSeat = async (req, res) => {
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
            return res.status(403).send("Forbidden. Group admin can't register for their own seminar.");
        }
        if (groupChat.status !== 'active') {
            return res.status(400).send("Sorry, the seminar is not active");
        }

        const expectedCents = dollarsToCents(groupChat.price);

        // Paid seminars hold the fee (authorized, not captured) before we record the
        // request. Free seminars have nothing to hold — the request just gates on the
        // host's approval — so we skip payment verification entirely.
        let charge: any = null;
        if (expectedCents > 0) {
            const authTest = await checkPaymentIntentAuthorized(payment_intent, 'test');
            const authLive = await checkPaymentIntentAuthorized(payment_intent, 'live');
            charge = assertPaymentMatchesExpected(expectedCents, payment_intent, authTest, authLive);
            if (!charge) {
                return res.status(400).send("Payment could not be verified.");
            }
        }

        // Best-effort release of the hold (paid seminars only) if we reject below.
        const releaseAndFail = async (code: number, msg: string) => {
            if (charge) await cancelPaymentIntent(payment_intent, charge.paidBy);
            return res.status(code).send(msg);
        };

        const alreadyParticipant = (groupChat.participants || []).some(
            (p: any) => p.toString() === userId,
        );
        if (alreadyParticipant) {
            return releaseAndFail(409, "You are already registered for this seminar.");
        }
        if (!seminarIsFull(groupChat)) {
            return releaseAndFail(409, "Seats are available — please register normally.");
        }
        const startMs = groupChat.start ? new Date(groupChat.start).getTime() : 0;
        if (!seatRequestWindowOpen(startMs)) {
            return releaseAndFail(400, "Seat requests are only open within 7 days of the seminar.");
        }

        const existing = await SeminarSeatRequest.findOne({
            customer: userId,
            groupChat: groupChat._id,
            status: 'pending',
        });
        if (existing) {
            return releaseAndFail(409, "You already have a pending request for this seminar.");
        }

        const appState = await AppState.findOne();
        const deadlineHours = typeof appState?.seminarApprovalDeadlineHours === 'number'
            ? appState.seminarApprovalDeadlineHours
            : 24;
        const decisionDeadline = computeSeatRequestDeadline(startMs, deadlineHours);

        // Record the hold as a 'pending' payment so the student sees it in their
        // history; it flips to 'completed' on approval or 'refunded' on release.
        let pendingPaymentId: any = undefined;
        if (charge) {
            const ph = new PaymentHistory({
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description: `Seat request (held, awaiting host approval): ${groupChat.name}`,
                paymentIntent: payment_intent,
                status: 'pending',
                customer: userId,
                expert: groupChat.admin,
                groupChat: groupChat._id,
            });
            await ph.save();
            pendingPaymentId = ph._id;
        }

        const request = await SeminarSeatRequest.create({
            customer: userId,
            groupChat: groupChat._id,
            expert: groupChat.admin,
            paymentIntent: charge ? payment_intent : undefined,
            paymentHistory: pendingPaymentId,
            stripeMode: charge ? charge.paidBy : undefined,
            amount: charge ? charge.amount : 0,
            currency: charge ? charge.currency : (groupChat.currency || 'usd'),
            decisionDeadline,
        });

        const expert = await User.findById(groupChat.admin.toString());
        const customer = await User.findById(userId);

        // Confirm to the student that their request (and hold, if paid) is in.
        if (customer?.email) {
            const holdLine = charge
                ? `Your card has been authorized for <strong>$${(charge.amount / 100).toFixed(2)} ${String(charge.currency || 'USD').toUpperCase()}</strong> but not charged. You'll only be charged if the host approves your seat; otherwise the hold is released.`
                : 'This is a free seminar, so no payment is involved.';
            await sendSeminarEmail(
                customer.email,
                `Seat request received — ${groupChat.name}`,
                `<h2 style="color:#007bff;margin-top:0;">Seat request received</h2>
                 <p>Thanks! Your request for a seat in the full seminar
                 "<strong>${groupChat.name}</strong>" has been sent to the host. ${holdLine}</p>
                 <p>The host has until <strong>${decisionDeadline.toLocaleString()}</strong> to decide.</p>`,
            );
        }

        if (expert?.email) {
            const holdNote = charge
                ? 'Their card is authorized but not charged.'
                : 'This is a free seminar, so no payment is involved.';
            const releaseNote = charge
                ? 'otherwise the hold is released automatically.'
                : 'otherwise the request expires automatically.';
            await sendSeminarEmail(
                expert.email,
                `New seat request — ${groupChat.name}`,
                `<h2 style="color:#007bff;margin-top:0;">New seat request</h2>
                 <p>${customer?.username || 'A student'} has requested a seat for your full seminar
                 "<strong>${groupChat.name}</strong>". ${holdNote}</p>
                 <p>Please approve or decline from your Seminar Hub before
                 <strong>${decisionDeadline.toLocaleString()}</strong>, ${releaseNote}</p>`,
            );
        }

        return res.status(200).json({ success: true, status: 'pending_approval', requestId: request._id });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const approveSeminarSeatRequest = async (req, res) => {
    try {
        const { userId } = req.user;
        const { requestId } = req.body;

        const request = await SeminarSeatRequest.findById(String(requestId));
        if (!request) {
            return res.status(404).send("Seat request not found.");
        }
        if (request.status !== 'pending') {
            return res.status(409).send(`This request is already ${request.status}.`);
        }

        const groupChat = await GroupChat.findById(request.groupChat.toString());
        if (!groupChat) {
            return res.status(404).send("Seminar not found.");
        }
        if (normalizeId(groupChat.admin) !== String(userId)) {
            return res.status(403).send("Only the seminar host can approve seat requests.");
        }

        // Paid requests capture the held funds now; free requests have no hold.
        let charge: any = null;
        if (request.paymentIntent) {
            const captured = await capturePaymentIntent(request.paymentIntent, request.stripeMode);
            if (!captured) {
                return res.status(502).send("Could not capture the authorized payment. The hold may have expired.");
            }
            const chargeObj = captured.latest_charge && typeof captured.latest_charge === 'object'
                ? captured.latest_charge
                : null;
            charge = {
                paidBy: request.stripeMode,
                amount: captured.amount,
                currency: captured.currency,
                receiptUrl: chargeObj?.receipt_url ?? null,
                receiptNumber: chargeObj?.receipt_number ?? null,
            };
        }

        const customer = await User.findById(request.customer.toString());
        const expert = await User.findById(groupChat.admin.toString());
        if (!customer || !expert) {
            return res.status(404).send("User not found for this request.");
        }

        // Approval intentionally admits the student beyond the capacity cap. For paid
        // requests we flip the existing 'pending' payment record to 'completed' rather
        // than appending a duplicate charge.
        await enrollAndConfirmSeminar({ groupChat, customer, expert, charge, payment_intent: request.paymentIntent, recordPayment: false });

        if (charge && request.paymentHistory) {
            await PaymentHistory.findByIdAndUpdate(request.paymentHistory, {
                status: 'completed',
                description: groupChat.name,
                receiptUrl: charge.receiptUrl,
                receiptNumber: charge.receiptNumber,
            });
        }

        request.status = 'approved';
        await request.save();

        await sendSeminarEmail(
            customer.email,
            `You're in — ${groupChat.name}`,
            `<h2 style="color:#28a745;margin-top:0;">Seat approved</h2>
             <p>${expert.username || 'The host'} approved your seat for
             "<strong>${groupChat.name}</strong>". ${charge ? 'Your card has now been charged and you\'re registered.' : 'You\'re now registered.'}</p>`,
        );

        return res.status(200).json({ success: true, status: 'approved' });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const rejectSeminarSeatRequest = async (req, res) => {
    try {
        const { userId } = req.user;
        const { requestId } = req.body;

        const request = await SeminarSeatRequest.findById(String(requestId));
        if (!request) {
            return res.status(404).send("Seat request not found.");
        }
        if (request.status !== 'pending') {
            return res.status(409).send(`This request is already ${request.status}.`);
        }

        const groupChat = await GroupChat.findById(request.groupChat.toString());
        if (!groupChat) {
            return res.status(404).send("Seminar not found.");
        }
        if (normalizeId(groupChat.admin) !== String(userId)) {
            return res.status(403).send("Only the seminar host can decline seat requests.");
        }

        if (request.paymentIntent) await cancelPaymentIntent(request.paymentIntent, request.stripeMode);
        if (request.paymentHistory) {
            await PaymentHistory.findByIdAndUpdate(request.paymentHistory, {
                status: 'refunded',
                description: `Hold released — seat request declined: ${groupChat.name}`,
            });
        }
        request.status = 'rejected';
        await request.save();

        const customer = await User.findById(request.customer.toString());
        if (customer?.email) {
            await sendSeminarEmail(
                customer.email,
                `Seat request update — ${groupChat.name}`,
                `<h2 style="color:#333;margin-top:0;">Seat request declined</h2>
                 <p>Unfortunately the host could not offer you a seat for
                 "<strong>${groupChat.name}</strong>".${request.paymentIntent ? ' Your payment hold has been released and you were not charged.' : ''}</p>`,
            );
        }

        return res.status(200).json({ success: true, status: 'rejected' });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const getSeminarSeatRequests = async (req, res) => {
    try {
        await sweepExpiredSeatRequests();
        const { userId } = req.user;
        const requests = await SeminarSeatRequest.find({ expert: userId, status: 'pending' })
            .populate('customer', 'username email image')
            .populate('groupChat', 'name start')
            .sort({ createdAt: 1 });
        return res.status(200).json({ success: true, result: requests });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const getMySeatRequests = async (req, res) => {
    try {
        await sweepExpiredSeatRequests();
        const { userId } = req.user;
        const requests = await SeminarSeatRequest.find({ customer: userId })
            .select('groupChat status decisionDeadline amount currency')
            .populate('groupChat', 'name start')
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, result: requests });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

// Releases holds for pending requests whose decision deadline has passed. Invoked
// on a timer from server.ts and opportunistically when requests are listed.
const sweepExpiredSeatRequests = async () => {
    try {
        const due = await SeminarSeatRequest.find({
            status: 'pending',
            decisionDeadline: { $lte: new Date() },
        }).populate('groupChat', 'name');
        for (const request of due) {
            if (request.paymentIntent) await cancelPaymentIntent(request.paymentIntent, request.stripeMode);
            if (request.paymentHistory) {
                await PaymentHistory.findByIdAndUpdate(request.paymentHistory, {
                    status: 'refunded',
                    description: `Hold released — seat request expired: ${request.groupChat?.name || 'Seminar'}`,
                });
            }
            request.status = 'expired';
            await request.save();
            const customer = await User.findById(request.customer.toString());
            if (customer?.email) {
                await sendSeminarEmail(
                    customer.email,
                    `Seat request expired — ${request.groupChat?.name || 'Seminar'}`,
                    `<h2 style="color:#333;margin-top:0;">Seat request expired</h2>
                     <p>The host didn't respond in time to your seat request for
                     "<strong>${request.groupChat?.name || 'the seminar'}</strong>".${request.paymentIntent ? ' Your payment hold has been released and you were not charged.' : ''}</p>`,
                );
            }
        }
        return due.length;
    } catch (err) {
        console.log('[sweepExpiredSeatRequests]', err.message);
        return 0;
    }
};

const acceptIndividualAppointment = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { groupChatId, payment_intent } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            await refundOrphanBookingCharge(payment_intent, userId, "Session no longer exists");
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        if (role !== 'customer' && String(groupChat.createdBy) === String(userId)) {
            return res.status(403).send("The student must accept and pay for a session you proposed.");
        }

        let charge: any = null;
        let payer: any = null;
        let expertUser: any = null;
        if (role === 'customer') {
            payer = await User.findById(userId);
            expertUser = await User.findById(groupChat.admin.toString());

            // A captured-but-mismatched amount is refunded inside the helper before it throws.
            const expectedCents = dollarsToCents(groupChat.price);
            charge = await verifyBookingChargeOrRefund({
                payment_intent,
                expectedCents,
                name: groupChat.name,
                customer: payer,
                expert: expertUser,
                groupChatId,
            });
        }

        // Activate the session; if this fails after a captured charge, refund it.
        try {
            groupChat.status = 'active';
            await groupChat.save();
        } catch (activateErr) {
            if (charge) {
                await refundBookingCharge({
                    payment_intent,
                    charge,
                    name: groupChat.name,
                    customer: payer,
                    expert: expertUser,
                    groupChatId,
                    reason: 'Could not activate the session after payment',
                });
            }
            throw activateErr;
        }

        // Record the charge + receipt only once the session is actually active.
        if (charge) {
            await appendPaymentHistory({
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description: groupChat.name,
                paymentIntent: payment_intent,
                receiptUrl: charge.receiptUrl,
                receiptNumber: charge.receiptNumber,
                customer: String(userId),
                expert: groupChat.admin.toString(),
                groupChat: groupChatId,
            })

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
    requestSeminarSeat,
    approveSeminarSeatRequest,
    rejectSeminarSeatRequest,
    getSeminarSeatRequests,
    getMySeatRequests,
    sweepExpiredSeatRequests,
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
