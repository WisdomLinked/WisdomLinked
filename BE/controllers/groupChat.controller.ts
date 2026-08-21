import { Request, Response } from 'express';
import { wlDisplayName } from '../utils/wlDisplayName';
const mongoose = require("mongoose");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const Service = require("../models/Service");
const MeetingThread = require("../models/MeetingThread");
const PaymentHistory = require("../models/PaymentHistory");
// Socket notifications removed — Rocket.Chat handles real-time updates now
const { checkPaymentIntentSucceeded, checkPaymentIntentAuthorized, checkPaymentIntentProcessing, capturePaymentIntent, cancelPaymentIntent, refundPaymentIntent, listReconcilableBookingIntents, sendBookingReceiptAndConfirmation } = require("./stripe.controller");
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
import { computeBookingPriceCents, extractHourlyRate, dollarsToCents, assertPaymentMatchesExpected, assertIntentMatchesBooking, voluntaryCancellationRefundCents, capturedAmountCents } from '../utils/bookingPrice';
import { resolvePendingPayment, resolveOrphanedIntent } from '../utils/pendingPayment';
import {
    BOOKING_PAYMENT_WRONG_BOOKING,
    BOOKING_PAYMENT_UNVERIFIED,
    BOOKING_CAPTURE_FAILED,
    BOOKING_CAPTURED_NOT_BOOKED,
    BOOKING_PAYMENT_ALREADY_USED,
    BOOKING_PAYMENT_AMOUNT_INVALID,
} from '../utils/bookingUserFacingCopy';

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

import { enrolledStudentIds, seminarIsFull, computeSeatRequestDeadline, seatRequestWindowOpen, seatRequestUnavailableMessage, resolveSeatApprovalBlock } from '../utils/seminarCapacity';
import { describeSeminarChanges } from '../utils/seminarChanges';
import {
    normalizePaymentMode,
    isWallet,
    paymentWindowHours,
    paymentWindowDeadline,
    paymentWindowLapsed,
    WALLET_NOT_YET_PAYABLE,
} from '../utils/walletPayment';

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
import { sanitizeDecisionNote, decisionNoteEmailBlock } from '../utils/decisionNote';
import { captureBeforeMs, decisionDeadlineFrom, holdHasLapsed } from '../utils/holdExpiry';
import { describePastEditRejection } from '../utils/pastEventEdit';
import {
    decisionNoticeCutoff,
    decisionNoticeIsVisible,
    resolveSessionDecisionOutcome,
    resolveSeatDecisionOutcome,
} from '../utils/decisionNotice';

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
            await releaseOrphanBookingIntent(payment_intent, userId, "Invalid session name");
            throw new Error(checkTitleNameInvalid('Name', name))
        }

        const titleLength = typeof name === 'string' ? name.trim().length : 0;
        if (titleLength < 10 || titleLength > 60) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Invalid session title");
            throw new Error("Session title must be between 10 and 60 characters");
        }

        const noteLength = typeof description === 'string' ? description.trim().length : 0;
        if (noteLength > 0 && (noteLength < 50 || noteLength > 500)) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Invalid session note");
            throw new Error("Session note must be between 50 and 500 characters");
        }

        const expertUser = await User.findById(String(expert));
        if (!expertUser) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Expert not found");
            throw new Error("Expert not found");
        }

        const currentUser = await User.findById(userId);
        const expectedCents = computeBookingPriceCents(Number(duration), extractHourlyRate(expertUser.price));
        const paymentMode = normalizePaymentMode(req.body.paymentMode);
        // Wallets can't authorize, so a wallet booking carries no money at this point:
        // it is a request the expert answers first, and only then does the student pay.
        const walletRequest = paymentMode === 'wallet' && expectedCents > 0;

        if (!walletRequest && expectedCents > 0 && await paymentIntentAlreadyConsumed(payment_intent)) {
            throw new Error("This payment has already been used for a booking");
        }

        // The intent must name this payer and this expert, and carry the server-computed
        // amount. Normally it is a hold, so a rejection below costs the student nothing.
        const payment = walletRequest
            ? { ok: true as const, charge: null, held: false }
            : await resolveBookingPayment({
                payment_intent,
                expectedCents,
                boundTo: { userId: String(userId), expertId: String(expertUser._id) },
                name,
                customer: currentUser,
                expert: expertUser,
                groupChatId: undefined,
            });
        if (!payment.ok) {
            return res.status(payment.code).send(payment.message);
        }
        let { charge, held } = payment;

        // Held funds are released (free); an already-captured charge must be refunded.
        const releaseAndFail = async (err: any) => {
            if (charge && held) {
                const cancelled = await cancelPaymentIntent(payment_intent, charge.paidBy);
                const message = safeHttp500Message(err);
                return res.status(500).send(cancelled
                    ? `${message} Your payment hold has been released and you were not charged.`
                    : `${message} Any hold on your card will be released automatically — please contact support if it does not clear.`);
            }
            if (charge) {
                await refundBookingCharge({
                    payment_intent,
                    charge,
                    name,
                    customer: currentUser,
                    expert: expertUser,
                    groupChatId: undefined,
                    reason: err?.message || 'Could not create the session after payment',
                });
            }
            return res.status(500).send(safeHttp500Message(err));
        };

        try {
            assertBookingLeadTime(expertUser, start);
            assertDurationAllowed(expertUser, duration);
            await assertBookingSlotValid(expertUser, start, end);
        } catch (validationErr) {
            return releaseAndFail(validationErr);
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
                paymentMode,
                ...(walletRequest ? { decisionDeadline: start ? new Date(start) : null } : {}),
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
            console.log('[createGroupChatByUser] session creation failed before capture', createErr);
            return releaseAndFail(createErr);
        }

        if (walletRequest) {
            Promise.resolve(
                sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, name, chat.start, duration, expectedCents / 100, true, expertUser.timeZone),
            ).catch((emailErr) => console.log('[createGroupChatByUser] expert notification failed', emailErr));

            if (currentUser?.email) {
                try {
                    await sendSeminarEmail(
                        currentUser.email,
                        `Session request sent — ${chat.name}`,
                        `<h2 style="color:#007bff;margin-top:0;">Your session request is with the expert</h2>
                         <p>Your request for "<strong>${chat.name}</strong>" has been sent.
                            <strong>Nothing has been charged yet.</strong> WeChat Pay and Alipay are paid in full at
                            the time of payment, so we ask the expert first and only collect
                            <strong>$${(expectedCents / 100).toFixed(2)}</strong> once they accept.</p>
                         <p>If they accept, we'll email you a payment link and you'll have a limited window to pay
                            and confirm the session.</p>`,
                    );
                } catch (emailErr) {
                    console.log('[createGroupChatByUser] wallet request email failed', emailErr);
                }
            }

            return res.status(200).json({
                success: true,
                paymentState: 'awaiting_expert',
                paymentMode: 'wallet',
                groupChatId: chat._id,
                result: currentUser,
            });
        }

        let pendingPaymentId: any = null;
        if (charge && held) {
            const parked = await parkBookingHold({
                payment_intent,
                charge,
                customer: currentUser,
                expert: expertUser,
                groupChat: chat,
                description: chat.name,
            });
            if (!parked.ok) {
                await rollbackIndividualSession(chat, userId, expertUser._id);
                return res.status(parked.duplicate ? 409 : 502).send(parked.message);
            }
            await GroupChat.updateOne(
                { _id: chat._id },
                { $set: { decisionDeadline: parked.decisionDeadline, holdCaptureBefore: parked.captureBefore } },
            );
            chat.decisionDeadline = parked.decisionDeadline;

            Promise.resolve(
                sendEmailMeetingRequestToExpert(expertUser.email, expertUser.username, name, chat.start, duration, expectedCents / 100, true, expertUser.timeZone),
            ).catch((emailErr) => console.log('[createGroupChatByUser] expert notification failed', emailErr));

            if (currentUser?.email) {
                try {
                    await sendSeminarEmail(
                        currentUser.email,
                        `Session request sent — ${chat.name}`,
                        `<h2 style="color:#007bff;margin-top:0;">Your session request is with the expert</h2>
                         <p>Your request for "<strong>${chat.name}</strong>" has been sent. Your card has been
                            authorized for <strong>$${(charge.amount / 100).toFixed(2)} ${String(charge.currency || 'USD').toUpperCase()}</strong>
                            but <strong>not charged</strong>. You are only charged if the expert accepts; otherwise the
                            authorization is released.</p>
                         <p>The expert has until <strong>${parked.decisionDeadline.toLocaleString()}</strong> to decide.</p>`,
                    );
                } catch (emailErr) {
                    console.log('[createGroupChatByUser] hold notice email failed', emailErr);
                }
            }

            return res.status(200).json({
                success: true,
                paymentState: 'withheld',
                decisionDeadline: parked.decisionDeadline,
                result: currentUser,
            });
        }

        if (charge) {
            const record = {
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
            };
            if (pendingPaymentId) {
                // Settle the row written before capture rather than adding a second one.
                try {
                    await PaymentHistory.findByIdAndUpdate(pendingPaymentId, {
                        status: 'completed',
                        description: chat.name,
                        amount: charge.amount,
                        currency: charge.currency,
                        receiptUrl: charge.receiptUrl,
                        receiptNumber: charge.receiptNumber,
                        groupChat: chat._id,
                    });
                } catch (historyErr) {
                    console.error('[createGroupChatByUser] captured payment left pending — reconcile manually', payment_intent, historyErr);
                }
            } else {
                let recorded = await appendPaymentHistory(record);
                if (!recorded) recorded = await appendPaymentHistory(record);
                if (!recorded) {
                    console.error('[createGroupChatByUser] UNRECORDED CAPTURED PAYMENT — reconcile manually', JSON.stringify(record));
                }
            }

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

        const appState = await AppState.findOne();
        const payBy = finalPrice > 0
            ? paymentWindowDeadline({
                sessionStartMs: start ? new Date(start).getTime() : 0,
                windowHours: paymentWindowHours(appState),
            })
            : null;

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
            paymentDeadline: payBy,
        });

        expertUser.groupChats.push(chat._id);
        await expertUser.save();

        customerUser.groupChats.push(chat._id);
        await customerUser.save();

        sendEmailMeetingRequestToCustomer(customerUser.email, name, customerUser.username, chat.start, duration, finalPrice, customerUser.timeZone, payBy);

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

        const _price = price === undefined || price === null || price === '' ? undefined : Number(price);
        if (_price !== undefined && (!Number.isFinite(_price) || _price < 0)) {
            throw new Error("Price must be a number of 0 or more");
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
            price: _price,
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

            sendEmailMeetingRequestToCustomer(customer.email, name, customer.username, start, duration, _price, customer.timeZone)

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
            if (expectedCents > 0 && await paymentIntentAlreadyConsumed(payment_intent)) {
                return res.status(409).send("This payment has already been used for a booking.");
            }
            // Refunds the charge if the captured amount doesn't match the expected price.
            const charge = await verifyBookingChargeOrRefund({
                payment_intent,
                expectedCents,
                name: groupChat.name,
                customer: currentUser,
                expert: null,
                groupChatId: groupChat._id.toString(),
                boundTo: { userId: String(userId), groupChatId: String(groupChat._id) },
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


// Emails every enrolled student (never the host) when a seminar's time/length/price
// changes, so a reschedule or re-price is never silent. Best-effort; a failed send
// must not fail the host's edit.
const notifySeminarChangeToStudents = async (before: any, changes: string[]) => {
    const studentIds = enrolledStudentIds(before);
    if (!studentIds.length || !changes.length) return;
    const students = await User.find({ _id: { $in: studentIds } }).select('email username');
    const changeList = changes.map((c) => `<li style="margin:4px 0;">${c}</li>`).join('');
    for (const student of students) {
        if (!student?.email) continue;
        await sendSeminarEmail(
            student.email,
            `Update to your seminar — ${before?.name || 'Seminar'}`,
            `<h2 style="color:#007bff;margin-top:0;">Your seminar has been updated</h2>
             <p>The host changed "<strong>${before?.name || 'your seminar'}</strong>", which you're enrolled in:</p>
             <ul style="padding-left:18px;">${changeList}</ul>
             <p>Your seat is unchanged and no action is needed. If the new time or price no longer
             works for you, you can leave the seminar from your dashboard.</p>`,
        );
    }
};

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

        let seminarEnrolledCount = 0;
        if (groupChat.type === 'seminar') {
            const seriesDocs = groupChat.seriesId
                ? await GroupChat.find({ seriesId: groupChat.seriesId, type: 'seminar' })
                : [groupChat];
            const enrolledSet = new Set<string>();
            for (const g of seriesDocs) enrolledStudentIds(g).forEach((id) => enrolledSet.add(id));
            seminarEnrolledCount = enrolledSet.size;
        }

        const updateFields: Record<string, any> = {};
        if (typeof name === 'string') updateFields.name = name;
        if (typeof description === 'string') updateFields.description = description;
        if (typeof image === 'string') updateFields.image = image;
        // Allow flipping a draft to a published seminar (or saving back as draft).
        if (typeof status === 'string' && ['draft', 'active', 'pending'].includes(status)) {
            if (groupChat.type === 'seminar' && status !== 'active' && seminarEnrolledCount > 0) {
                return res.status(409).send("You can't unpublish a seminar while students are enrolled. Please contact an admin to cancel and refund it.");
            }
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
        if (typeof price === 'string' || typeof price === 'number') {
            const parsedPrice = Number(price);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                return res.status(400).send("Price must be a number of 0 or more");
            }
            updateFields.price = parsedPrice;
        }
        if (typeof maxAttendees === 'number') {
            updateFields.maxAttendees = groupChat.type === 'seminar' && maxAttendees > 0
                ? Math.max(maxAttendees, seminarEnrolledCount)
                : maxAttendees;
        } else if (maxAttendees === null) updateFields.maxAttendees = null;
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

        const pastEditRejection = describePastEditRejection(groupChat, updateFields);
        if (pastEditRejection) {
            return res.status(409).send(pastEditRejection);
        }

        // Update group chat with only provided fields
        await GroupChat.findByIdAndUpdate(String(groupId), updateFields, { new: true });

        // A recurring series is one course at one price: registration charges the
        // occurrence a student books through but enrols them across the whole series.
        // So a price edit on any occurrence must apply to all of them, or occurrences
        // drift and students are over- or under-charged for the sessions they receive.
        if (groupChat.type === 'seminar' && groupChat.seriesId && updateFields.price !== undefined) {
            await GroupChat.updateMany(
                { seriesId: groupChat.seriesId, type: 'seminar' },
                { $set: { price: updateFields.price } },
            );
        }

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

        // Notify enrolled students when a live seminar's time/length/price changed, so a
        // reschedule or re-price never happens silently behind their paid seat.
        if (groupChat.type === 'seminar') {
            const changes = describeSeminarChanges(groupChat, updateFields);
            if (changes.length) {
                try {
                    await notifySeminarChangeToStudents(groupChat, changes);
                } catch (notifyErr) {
                    console.log('[updateGroupChat] change notification failed', notifyErr);
                }
            }
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


const resolveServerStripeMode = async (): Promise<'test' | 'live'> => {
    const appState = await AppState.findOne();
    return appState?.stripeMode === 'live' ? 'live' : 'test';
};

const claimSeminarSeat = async (groupChatId: any, userId: string, maxAttendees: unknown) => {
    const filter: Record<string, any> = {
        _id: groupChatId,
        type: 'seminar',
        status: 'active',
        admin: { $ne: userId },
        participants: { $ne: userId },
    };
    const cap = typeof maxAttendees === 'number' ? maxAttendees : null;
    if (cap != null && cap <= 0) {
        // A cap of 0 (or less) means the seminar is closed — no seat to claim.
        return null;
    }
    if (cap != null) {
        // Enrolled students exclude the host, mirroring enrolledStudentIds/seminarIsFull.
        filter.$expr = {
            $lt: [
                {
                    $size: {
                        $filter: {
                            input: '$participants',
                            as: 'p',
                            cond: { $ne: ['$$p', '$admin'] },
                        },
                    },
                },
                cap,
            ],
        };
    }
    return GroupChat.findOneAndUpdate(
        filter,
        { $addToSet: { participants: userId } },
        { new: true },
    );
};

const claimFutureSiblingSeats = async (groupChat: any, userId: string): Promise<boolean> => {
    if (!groupChat.seriesId) return true;
    const claimedIds: any[] = [];
    try {
        const now = Date.now();
        const siblings = await GroupChat.find({
            seriesId: groupChat.seriesId,
            type: 'seminar',
            status: 'active',
            _id: { $ne: groupChat._id },
        });
        for (const sib of siblings) {
            const sibStart = sib.start ? new Date(sib.start).getTime() : 0;
            if (!(sibStart >= now)) continue;
            const claimed = await claimSeminarSeat(sib._id, userId, sib.maxAttendees);
            if (!claimed) {
                if (claimedIds.length) {
                    await GroupChat.updateMany({ _id: { $in: claimedIds } }, { $pull: { participants: userId } });
                }
                return false;
            }
            claimedIds.push(sib._id);
        }
        return true;
    } catch (err: any) {
        console.log('[claimFutureSiblingSeats]', err?.message);
        if (claimedIds.length) {
            await GroupChat.updateMany({ _id: { $in: claimedIds } }, { $pull: { participants: userId } }).catch(() => null);
        }
        return false;
    }
};

const releaseSeminarSeat = async (groupChatId: any, userId: string) => {
    try {
        await GroupChat.updateOne({ _id: groupChatId }, { $pull: { participants: userId } });
    } catch (err) {
        console.log('[releaseSeminarSeat]', err);
    }
};

const releaseMismatchedHold = async (intent: any, payment_intent: string, mode: 'test' | 'live', userId: string) => {
    const meta = (intent && typeof intent === 'object' && intent.metadata) || {};
    if (!meta.userId || String(meta.userId) !== String(userId)) return false;
    return !!(await cancelPaymentIntent(payment_intent, mode));
};

const paymentIntentAlreadyConsumed = async (
    payment_intent: string,
    resumableFor?: { userId: string; groupChatId: string },
) => {
    if (!payment_intent) return false;
    const rows = await PaymentHistory.find({
        paymentIntent: String(payment_intent),
        paymentType: 'charge',
    }).select('status customer groupChat');
    if (!rows.length) return false;
    if (!resumableFor) return true;

    const heldBySeatRequest = await SeminarSeatRequest.exists({
        paymentIntent: String(payment_intent),
        status: 'pending',
    });
    if (heldBySeatRequest) return true;

    return !rows.every((row: any) => row.status === 'pending'
        && String(row.customer) === String(resumableFor.userId)
        && String(row.groupChat) === String(resumableFor.groupChatId));
};

const unenrollSeminarSeries = async (groupChat: any, userId: string) => {
    try {
        const filter: any = groupChat.seriesId
            ? { $or: [{ _id: groupChat._id }, { seriesId: groupChat.seriesId, type: 'seminar' }] }
            : { _id: groupChat._id };
        const affected = await GroupChat.find(filter).select('_id');
        const ids = affected.map((occ: any) => occ._id);
        await GroupChat.updateMany({ _id: { $in: ids } }, { $pull: { participants: userId } });
        await User.updateOne({ _id: userId }, { $pull: { groupChats: { $in: ids } } });
    } catch (err) {
        console.log('[unenrollSeminarSeries]', err);
    }
};

// Cancels rather than deletes if the delete fails, so an unpaid session can never
// surface on a dashboard as booked.
const rollbackIndividualSession = async (chat: any, customerId: any, expertId: any) => {
    if (!chat?._id) return;
    try {
        await User.updateOne({ _id: customerId }, { $pull: { groupChats: chat._id } });
        await User.updateOne({ _id: expertId }, { $pull: { groupChats: chat._id } });
    } catch (err: any) {
        console.log('[rollbackIndividualSession] could not detach users', err?.message);
    }
    try {
        await GroupChat.deleteOne({ _id: chat._id });
    } catch (deleteErr: any) {
        console.log('[rollbackIndividualSession] delete failed, cancelling instead', deleteErr?.message);
        await GroupChat.updateOne({ _id: chat._id }, { $set: { status: 'cancelled' } }).catch(() => null);
    }
};

/**
 * Reconciliation-side rollback: a booking whose payment ended up released or refunded
 * must not keep its access. Seminars lose the seat (and the rest of the series); a 1:1
 * session is cancelled outright. Skipped when the student paid for it by another intent.
 */
const releaseUncapturedSeatClaim = async (seminarId: any, userId: any) => {
    try {
        if (!seminarId || !userId) return;
        const gc = await GroupChat.findById(String(seminarId));
        if (!gc) return;

        if (gc.type !== 'seminar') {
            // A 1:1 whose charge was undone: cancel it so no dashboard shows it as booked.
            const paidFor = await PaymentHistory.exists({
                customer: userId,
                groupChat: gc._id,
                paymentType: 'charge',
                status: { $in: ['completed', 'withheld'] },
            });
            if (paidFor) return;
            if (gc.status === 'cancelled') return;
            await GroupChat.updateOne({ _id: gc._id }, { $set: { status: 'cancelled' } });
            console.log('[releaseUncapturedSeatClaim] cancelled unpaid 1:1 session', String(gc._id));
            return;
        }

        const seriesFilter: any = gc.seriesId
            ? { $or: [{ _id: gc._id }, { seriesId: gc.seriesId, type: 'seminar' }] }
            : { _id: gc._id };
        const seriesIds = (await GroupChat.find(seriesFilter).select('_id')).map((o: any) => o._id);
        const paidElsewhere = await PaymentHistory.exists({
            customer: userId,
            groupChat: { $in: seriesIds },
            paymentType: 'charge',
            status: 'completed',
        });
        if (paidElsewhere) return;
        await unenrollSeminarSeries(gc, String(userId));
    } catch (err: any) {
        console.log('[releaseUncapturedSeatClaim]', err.message);
    }
};

const enrollAndConfirmSeminar = async ({ groupChat, customer, expert, charge, payment_intent, recordPayment = true, paymentStatus = 'completed' }: any) => {
    const occurrences = [groupChat];
    if (groupChat.seriesId) {
        const now = Date.now();
        const siblings = await GroupChat.find({
            seriesId: groupChat.seriesId,
            type: 'seminar',
            status: 'active',
            _id: { $ne: groupChat._id },
        });
        for (const sib of siblings) {
            const sibStart = sib.start ? new Date(sib.start).getTime() : 0;
            if (sibStart && sibStart >= now) occurrences.push(sib);
        }
    }

    const occurrenceIds = occurrences.map((occ: any) => occ._id);

    for (const occId of occurrenceIds) {
        await GroupChat.updateOne(
            { _id: occId },
            { $addToSet: { participants: customer._id } },
        );
    }
    await User.updateOne(
        { _id: customer._id },
        { $addToSet: { groupChats: { $each: occurrenceIds } } },
    );

    try {
        await syncGroupRocketChannel(String(groupChat._id));
    } catch (syncErr) {
        console.log('[enrollAndConfirmSeminar] chat sync failed after enrollment', syncErr);
    }

    if (charge) {
        if (recordPayment) {
            const record = {
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description: paymentStatus === 'pending'
                    ? `Wallet payment clearing: ${groupChat.name}`
                    : groupChat.name,
                paymentIntent: payment_intent,
                receiptUrl: charge.receiptUrl,
                receiptNumber: charge.receiptNumber,
                status: paymentStatus,
                customer: customer._id.toString(),
                expert: expert._id.toString(),
                groupChat: groupChat._id.toString(),
            };
            let recorded = await appendPaymentHistory(record);
            if (!recorded) recorded = await appendPaymentHistory(record);
            if (!recorded) {
                console.error('[enrollAndConfirmSeminar] UNRECORDED CAPTURED PAYMENT — reconcile manually', JSON.stringify(record));
            }
        }

        try {
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
        } catch (receiptErr) {
            console.log('[enrollAndConfirmSeminar] receipt email failed after enrollment', receiptErr);
        }
    }

    try {
        scheduleEmailReminder(customer.email, customer.username, groupChat.name, groupChat.start, groupChat.duration, customer.timeZone);
    } catch (reminderErr) {
        console.log('[enrollAndConfirmSeminar] reminder scheduling failed after enrollment', reminderErr);
    }
};

const registerForSeminar = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Seminar no longer exists");
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }
        if (groupChat.type !== 'seminar') {
            await releaseOrphanBookingIntent(payment_intent, userId, "Target is not a seminar");
            return res.status(400).send("This group is not a seminar");
        }

        const customer = await User.findById(userId);
        const expert = await User.findById(groupChat.admin.toString());

        const expectedCents = dollarsToCents(groupChat.price);

        let charge: any = null;
        let held = false;
        // A wallet payment still clearing: enrol now, record the money once it lands.
        let settling = false;
        if (expectedCents > 0) {
            const consumed = await paymentIntentAlreadyConsumed(payment_intent, {
                userId: String(userId),
                groupChatId: String(groupChat._id),
            });
            if (consumed) {
                return res.status(409).send("This payment has already been used for a booking.");
            }
            const payment = await resolveBookingPayment({
                payment_intent,
                expectedCents,
                boundTo: { userId: String(userId), groupChatId: String(groupChat._id) },
                name: groupChat.name,
                customer,
                expert,
                groupChatId: groupChat._id.toString(),
            });
            if (!payment.ok) {
                return res.status(payment.code).send(payment.message);
            }
            charge = payment.charge;
            held = !!payment.held;
            settling = !!payment.settling;
        }

        // Held funds are released (no fee); already-captured funds must be refunded.
        const refundAndFail = async (code: number, message: string, reason: string, recordStatus: string = 'refunded') => {
            if (!charge) {
                return res.status(code).send(message);
            }
            if (held) {
                const cancelled = await cancelPaymentIntent(payment_intent, charge.paidBy);
                return res.status(code).send(cancelled
                    ? `${message} Your payment hold has been released and you were not charged.`
                    : `${message} Any hold on your card will be released automatically — please contact support if it does not clear.`);
            }
            const refunded = await refundBookingCharge({ payment_intent, charge, name: groupChat.name, customer, expert, groupChatId: groupChat._id.toString(), reason, recordStatus });
            if (!refunded) {
                console.error('[registerForSeminar] refund failed after capture — reconcile manually', payment_intent, reason);
                return res.status(code).send(`${message} Your payment could not be refunded automatically — please contact support.`);
            }
            return res.status(code).send(`${message} Your payment has been refunded.`);
        };

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

        const claimed = await claimSeminarSeat(groupChat._id, userId, groupChat.maxAttendees);
        if (!claimed) {
            const current = await GroupChat.findById(groupChat._id.toString());
            if (!current) {
                return refundAndFail(404, "Sorry, the group chat doesn't exist", "Seminar no longer exists");
            }
            if (current.admin.toString() === userId) {
                return refundAndFail(403, "Forbidden. Group admin can't register for their own seminar.", "Host cannot register for their own seminar");
            }
            if (current.status !== 'active') {
                return refundAndFail(400, "Sorry, the seminar is not active", "Seminar is no longer active");
            }
            if ((current.participants || []).some((p: any) => p.toString() === userId)) {
                const ownedElsewhere = held && !!(await PaymentHistory.exists({
                    paymentIntent: String(payment_intent),
                    paymentType: 'charge',
                }));
                if (ownedElsewhere) {
                    return res.status(409).send("You are already registered for this seminar.");
                }
                return refundAndFail(409, "You are already registered for this seminar.", "Already registered (duplicate payment)");
            }
            if (seminarIsFull(current)) {
                const startMs = current.start ? new Date(current.start).getTime() : 0;
                const convertible = held && charge && seatRequestWindowOpen(startMs);
                if (convertible) {
                    const pending = await SeminarSeatRequest.findOne({
                        customer: userId,
                        groupChat: current._id,
                        status: 'pending',
                    });
                    if (!pending) {
                        const recorded = await recordSeatRequest({
                            groupChat: current,
                            userId,
                            charge,
                            payment_intent,
                        });
                        if (!recorded.duplicate) {
                            return res.status(200).json({
                                success: true,
                                status: 'pending_approval',
                                requestId: recorded.request._id,
                            });
                        }
                    }
                }
                return refundAndFail(409, "Sorry, this seminar is full.", "Seminar reached capacity before registration completed");
            }
            return refundAndFail(409, "Sorry, we couldn't reserve your seat. Please try again.", "Seat claim failed");
        }
 
        if (!(await claimFutureSiblingSeats(groupChat, userId))) {
            await releaseSeminarSeat(claimed._id, userId);
            return refundAndFail(409, "Sorry, a later session in this seminar series is full, so we couldn't complete your registration.", "A later session in the series reached capacity");
        }

        // The seat is secured, so the hold can now be turned into a real charge.
        let pendingPaymentId: any = null;

        let lookupFailed = false;
        if (charge) {
            try {
                const existing = await PaymentHistory.findOne({
                    paymentIntent: String(payment_intent),
                    paymentType: 'charge',
                    status: 'pending',
                    customer: customer._id,
                    groupChat: groupChat._id,
                });
                if (existing) {
                    pendingPaymentId = existing._id;
                    await PaymentHistory.updateOne(
                        { _id: existing._id },
                        { $set: { description: `Retrying seminar registration: ${groupChat.name}` } },
                    );
                }
            } catch (lookupErr) {
                lookupFailed = true;
                console.log('[registerForSeminar] pending payment lookup failed', lookupErr);
            }
        }

        if (charge && held) {
            if (lookupFailed) {
                await unenrollSeminarSeries(claimed, userId);
                await cancelPaymentIntent(payment_intent, charge.paidBy);
                return res.status(500).send("We couldn't complete your registration, so you have not been charged. Please try again.");
            }
            if (!pendingPaymentId) {
                try {
                    const ph = new PaymentHistory({
                        stripeMode: charge.paidBy,
                        paymentType: 'charge',
                        amount: charge.amount,
                        currency: charge.currency,
                        description: `Capturing seminar registration: ${groupChat.name}`,
                        paymentIntent: payment_intent,
                        status: 'pending',
                        customer: customer._id,
                        expert: expert._id,
                        groupChat: groupChat._id,
                    });
                    await ph.save();
                    pendingPaymentId = ph._id;
                } catch (historyErr: any) {
                    if (historyErr?.code === 11000) {
                        await unenrollSeminarSeries(claimed, userId);
                        return res.status(409).send(BOOKING_PAYMENT_ALREADY_USED);
                    }
                    console.log('[registerForSeminar] could not record payment before capture', historyErr);
                    await unenrollSeminarSeries(claimed, userId);
                    await cancelPaymentIntent(payment_intent, charge.paidBy);
                    return res.status(500).send("We couldn't complete your registration, so you have not been charged. Please try again.");
                }
            }

            let captured = await capturePaymentIntent(payment_intent, charge.paidBy);
            if (!captured) {
                captured = await checkPaymentIntentSucceeded(payment_intent, charge.paidBy);
            }
            if (!captured) {
                await unenrollSeminarSeries(claimed, userId);
                const cancelled = await cancelPaymentIntent(payment_intent, charge.paidBy);
                if (cancelled) {
                    await PaymentHistory.findByIdAndDelete(pendingPaymentId).catch(() => null);
                    return res.status(502).send("We couldn't complete your payment, so you have not been charged. Please try again.");
                }
                console.error('[registerForSeminar] capture and cancel both failed — left pending for reconciliation', payment_intent);
                return res.status(502).send("We couldn't confirm your payment. If you were charged, it will be refunded automatically — please contact support if it does not clear.");
            }
            const chargeObj = captured.latest_charge && typeof captured.latest_charge === 'object'
                ? captured.latest_charge
                : null;
            charge = {
                paidBy: charge.paidBy,
                amount: capturedAmountCents(captured),
                currency: captured.currency,
                receiptUrl: chargeObj?.receipt_url ?? null,
                receiptNumber: chargeObj?.receipt_number ?? null,
            };
            held = false;
        }

        try {
            await enrollAndConfirmSeminar({
                groupChat: claimed,
                customer,
                expert,
                charge,
                payment_intent,
                recordPayment: !pendingPaymentId,
                paymentStatus: settling ? 'pending' : 'completed',
            });
        } catch (enrollErr: any) {
            console.log('[registerForSeminar] enrollment failed after charge', enrollErr);
            await unenrollSeminarSeries(claimed, userId);
            if (pendingPaymentId) {
                await PaymentHistory.findByIdAndUpdate(pendingPaymentId, {
                    status: 'completed',
                    description: `${groupChat.name} — enrollment failed after capture`,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                }).catch(() => null);
            }
            return refundAndFail(
                500,
                "We couldn't complete your registration.",
                "Enrollment error after payment",
                pendingPaymentId ? 'completed' : 'refunded',
            );
        }

        if (pendingPaymentId) {
            try {
                await PaymentHistory.findByIdAndUpdate(pendingPaymentId, {
                    status: 'completed',
                    description: groupChat.name,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                });
            } catch (historyErr) {
                console.error('[registerForSeminar] captured payment left pending — reconcile manually', payment_intent, historyErr);
            }
        }

        let userDetails: any = null;
        try {
            userDetails = await getFullUserData(customer.email);
            userDetails.token = null;
            userDetails.password = null;
        } catch (profileErr) {
            console.log('[registerForSeminar] enrolled but profile reload failed', profileErr);
        }

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

const refundBookingCharge = async ({ payment_intent, charge, name, customer, expert, groupChatId, reason, recordStatus }: any) => {
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
        status: recordStatus || 'refunded',
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
    const meta = (intent && intent.metadata) || {};
    if (!meta.userId || String(meta.userId) !== String(userId)) {
        console.log('[refundOrphanBookingCharge] intent does not belong to this user — not refunding', payment_intent);
        return;
    }
    const customer = userId ? await User.findById(String(userId)) : null;
    await refundBookingCharge({
        payment_intent,
        charge: { paidBy: mode, amount: intent.amount, currency: intent.currency },
        name: null,
        customer,
        expert: null,
        groupChatId: undefined,
        reason,
        recordStatus: 'refunded',
    });
};

const releaseOrphanBookingIntent = async (payment_intent: string, userId: string, reason: string) => {
    if (!payment_intent) return;
    try {
        const mode = await resolveServerStripeMode();
        const auth = await checkPaymentIntentAuthorized(payment_intent, mode);
        if (auth) {
            const meta = (auth && auth.metadata) || {};
            if (!meta.userId || String(meta.userId) !== String(userId)) {
                console.log('[releaseOrphanBookingIntent] hold does not belong to this user — leaving it', payment_intent);
                return;
            }
            await cancelPaymentIntent(payment_intent, mode);
            return;
        }
    } catch (err: any) {
        console.log('[releaseOrphanBookingIntent]', err?.message);
    }
    await refundOrphanBookingCharge(payment_intent, userId, reason);
};

const verifyBookingChargeOrRefund = async ({ payment_intent, expectedCents, name, customer, expert, groupChatId, boundTo }: any) => {
    let succeededTest: any = false;
    let succeededLive: any = false;
    if (expectedCents > 0) {
        const serverMode = await resolveServerStripeMode();
        const succeededProbe = await checkPaymentIntentSucceeded(payment_intent, serverMode);
        succeededTest = serverMode === 'test' ? succeededProbe : false;
        succeededLive = serverMode === 'live' ? succeededProbe : false;
    }
    const captured = succeededTest || succeededLive;
    if (captured && boundTo) {
        assertIntentMatchesBooking(captured, boundTo);
    }
    if (captured && captured.amount !== expectedCents) {
        await refundBookingCharge({
            payment_intent,
            charge: { paidBy: succeededTest ? 'test' : 'live', amount: captured.amount, currency: captured.currency },
            name,
            customer,
            expert,
            groupChatId,
            reason: 'Payment amount did not match the expected price',
            recordStatus: 'refunded',
        });
    }
    return assertPaymentMatchesExpected(expectedCents, payment_intent, succeededTest, succeededLive);
};

const expandedCharge = (intent: any): any =>
    intent?.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;

const chargeReceiptUrl = (intent: any): string | null => expandedCharge(intent)?.receipt_url ?? null;

const chargeReceiptNumber = (intent: any): string | null => expandedCharge(intent)?.receipt_number ?? null;

export type BookingPaymentResolution = {
    ok: boolean;
    charge?: any;
    held?: boolean;
    /** Wallet payment still clearing — booked now, confirmed by the webhook. */
    settling?: boolean;
    code?: number;
    message?: string;
};

const resolveBookingPayment = async ({
    payment_intent,
    expectedCents,
    boundTo,
    name,
    customer,
    expert,
    groupChatId,
}: any): Promise<BookingPaymentResolution> => {
    if (!(expectedCents > 0)) return { ok: true, charge: null, held: false };
    if (!payment_intent) return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };

    const serverMode = await resolveServerStripeMode();
    const authProbe = await checkPaymentIntentAuthorized(payment_intent, serverMode);

    if (authProbe) {
        try {
            assertIntentMatchesBooking(authProbe, boundTo);
        } catch (bindErr) {
            // Only ever cancels a hold this payer owns, never a third party's.
            await releaseMismatchedHold(authProbe, payment_intent, serverMode, String(boundTo?.userId ?? ''));
            return { ok: false, code: 400, message: BOOKING_PAYMENT_WRONG_BOOKING };
        }
        let charge: any = null;
        try {
            charge = assertPaymentMatchesExpected(
                expectedCents,
                payment_intent,
                serverMode === 'test' ? authProbe : false,
                serverMode === 'live' ? authProbe : false,
            );
        } catch (amountErr) {
            // Wrong amount on a hold: release it (free) rather than let it expire.
            await cancelPaymentIntent(payment_intent, serverMode);
            return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };
        }
        if (!charge) return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };
        return { ok: true, charge, held: true };
    }

    const settlingProbe = await checkPaymentIntentProcessing(payment_intent, serverMode);
    if (settlingProbe) {
        try {
            assertIntentMatchesBooking(settlingProbe, boundTo);
        } catch (bindErr) {
            return { ok: false, code: 400, message: BOOKING_PAYMENT_WRONG_BOOKING };
        }
        try {
            const charge = assertPaymentMatchesExpected(
                expectedCents,
                payment_intent,
                serverMode === 'test' ? settlingProbe : false,
                serverMode === 'live' ? settlingProbe : false,
            );
            if (!charge) return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };
            return { ok: true, charge, held: false, settling: true };
        } catch (amountErr) {
            // Can't cancel or refund money still in flight; the sweep settles it later.
            return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };
        }
    }

    // No live hold — accept an already-captured intent, refunding a wrong amount.
    try {
        const charge = await verifyBookingChargeOrRefund({
            payment_intent,
            expectedCents,
            name,
            customer,
            expert,
            groupChatId,
            boundTo,
        });
        if (!charge) return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };
        return { ok: true, charge, held: false };
    } catch (verifyErr: any) {
        return { ok: false, code: 400, message: BOOKING_PAYMENT_UNVERIFIED };
    }
};

const captureBookingHold = async ({ payment_intent, charge, customer, expert, groupChat, description }: any): Promise<
    { ok: boolean; charge?: any; pendingPaymentId?: any; message?: string; duplicate?: boolean }
> => {
    let pendingPaymentId: any = null;
    try {
        const ph = new PaymentHistory({
            stripeMode: charge.paidBy,
            paymentType: 'charge',
            amount: charge.amount,
            currency: charge.currency,
            description: `Capturing booking: ${description}`,
            paymentIntent: payment_intent,
            status: 'pending',
            customer: customer?._id,
            expert: expert?._id,
            groupChat: groupChat?._id,
        });
        await ph.save();
        pendingPaymentId = ph._id;
    } catch (historyErr: any) {
        if (historyErr?.code === 11000) {
            // A concurrent request won this intent. Its hold is not ours to cancel.
            console.log('[captureBookingHold] intent already claimed by another request', payment_intent);
            return { ok: false, duplicate: true, message: BOOKING_PAYMENT_ALREADY_USED };
        }
        console.log('[captureBookingHold] could not record payment before capture', historyErr);
        await cancelPaymentIntent(payment_intent, charge.paidBy);
        return { ok: false, message: BOOKING_CAPTURE_FAILED };
    }

    let captured = await capturePaymentIntent(payment_intent, charge.paidBy);
    if (!captured) {
        // A concurrent capture (retry, sweep) may have already taken the money.
        captured = await checkPaymentIntentSucceeded(payment_intent, charge.paidBy);
    }
    if (!captured) {
        const cancelled = await cancelPaymentIntent(payment_intent, charge.paidBy);
        if (cancelled) {
            await PaymentHistory.findByIdAndDelete(pendingPaymentId).catch(() => null);
            return { ok: false, message: BOOKING_CAPTURE_FAILED };
        }
        console.error('[captureBookingHold] capture and cancel both failed — left pending for reconciliation', payment_intent);
        return { ok: false, message: "We couldn't confirm your payment. If you were charged, it will be refunded automatically — please contact support if it does not clear." };
    }

    const chargeObj = captured.latest_charge && typeof captured.latest_charge === 'object'
        ? captured.latest_charge
        : null;
    return {
        ok: true,
        pendingPaymentId,
        charge: {
            paidBy: charge.paidBy,
            amount: capturedAmountCents(captured),
            currency: captured.currency,
            receiptUrl: chargeObj?.receipt_url ?? null,
            receiptNumber: chargeObj?.receipt_number ?? null,
        },
    };
};

const parkBookingHold = async ({ payment_intent, charge, customer, expert, groupChat, description }: any): Promise<
    { ok: boolean; pendingPaymentId?: any; decisionDeadline?: Date; captureBefore?: Date | null; message?: string; duplicate?: boolean }
> => {
    const serverMode = charge.paidBy;
    const authProbe = await checkPaymentIntentAuthorized(payment_intent, serverMode);
    const captureBefore = captureBeforeMs(authProbe);
    const decisionDeadline = decisionDeadlineFrom({
        captureBefore,
        sessionStartMs: groupChat?.start ? new Date(groupChat.start).getTime() : 0,
    });

    try {
        const ph = new PaymentHistory({
            stripeMode: serverMode,
            paymentType: 'charge',
            amount: charge.amount,
            currency: charge.currency,
            description: `Session request (held, awaiting expert approval): ${description}`,
            paymentIntent: payment_intent,
            status: 'withheld',
            customer: customer?._id,
            expert: expert?._id,
            groupChat: groupChat?._id,
        });
        await ph.save();
        return {
            ok: true,
            pendingPaymentId: ph._id,
            decisionDeadline,
            captureBefore: captureBefore > 0 ? new Date(captureBefore) : null,
        };
    } catch (historyErr: any) {
        if (historyErr?.code === 11000) {
            console.log('[parkBookingHold] intent already claimed by another request', payment_intent);
            return { ok: false, duplicate: true, message: BOOKING_PAYMENT_ALREADY_USED };
        }
        console.log('[parkBookingHold] could not record the held payment', historyErr);
        await cancelPaymentIntent(payment_intent, serverMode);
        return { ok: false, message: BOOKING_CAPTURE_FAILED };
    }
};

const captureParkedHold = async ({ payment_intent, stripeMode }: any): Promise<
    { ok: boolean; charge?: any; message?: string }
> => {
    let captured = await capturePaymentIntent(payment_intent, stripeMode);
    if (!captured) {
        captured = await checkPaymentIntentSucceeded(payment_intent, stripeMode);
    }
    if (!captured) {
        return {
            ok: false,
            message: "We couldn't collect the student's payment — the authorization has expired or was released. The session has not been confirmed. Ask them to book again.",
        };
    }
    const chargeObj = captured.latest_charge && typeof captured.latest_charge === 'object'
        ? captured.latest_charge
        : null;
    return {
        ok: true,
        charge: {
            paidBy: stripeMode,
            amount: capturedAmountCents(captured),
            currency: captured.currency,
            receiptUrl: chargeObj?.receipt_url ?? null,
            receiptNumber: chargeObj?.receipt_number ?? null,
        },
    };
};

const findParkedHold = async (groupChatId: any) => PaymentHistory.findOne({
    groupChat: String(groupChatId),
    paymentType: 'charge',
    status: 'withheld',
});

const recordSeatRequest = async ({ groupChat, userId, charge, payment_intent, paymentMode = 'card' }: any) => {
    const appState = await AppState.findOne();
    const deadlineHours = typeof appState?.seminarApprovalDeadlineHours === 'number'
        ? appState.seminarApprovalDeadlineHours
        : 24;
    const startMs = groupChat.start ? new Date(groupChat.start).getTime() : 0;
    const decisionDeadline = computeSeatRequestDeadline(startMs, deadlineHours);

    let pendingPaymentId: any = undefined;
    let createdPaymentRow = false;
    if (charge) {
        const description = `Seat request (held, awaiting host approval): ${groupChat.name}`;
        const existing = await PaymentHistory.findOne({
            paymentIntent: String(payment_intent),
            paymentType: 'charge',
            status: { $in: ['pending', 'withheld'] },
            customer: userId,
            groupChat: groupChat._id,
        });
        if (existing) {
            await PaymentHistory.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        stripeMode: charge.paidBy,
                        amount: charge.amount,
                        currency: charge.currency,
                        description,
                        expert: groupChat.admin,
                        status: 'withheld',
                    },
                },
            );
            pendingPaymentId = existing._id;
        } else {
            const ph = new PaymentHistory({
                stripeMode: charge.paidBy,
                paymentType: 'charge',
                amount: charge.amount,
                currency: charge.currency,
                description,
                paymentIntent: payment_intent,
                status: 'withheld',
                customer: userId,
                expert: groupChat.admin,
                groupChat: groupChat._id,
            });
            try {
                await ph.save();
            } catch (saveErr: any) {
                // Another request already claimed this intent — treat as a duplicate
                // request rather than cancelling a hold that is no longer ours.
                if (saveErr?.code === 11000) {
                    return { duplicate: true, request: null, decisionDeadline };
                }
                throw saveErr;
            }
            pendingPaymentId = ph._id;
            createdPaymentRow = true;
        }
    }

    let request: any;
    try {
        request = await SeminarSeatRequest.create({
            customer: userId,
            groupChat: groupChat._id,
            expert: groupChat.admin,
            paymentIntent: charge ? payment_intent : undefined,
            paymentHistory: pendingPaymentId,
            stripeMode: charge ? charge.paidBy : undefined,
            amount: charge ? charge.amount : (paymentMode === 'wallet' ? dollarsToCents(groupChat.price) : 0),
            currency: charge ? charge.currency : (groupChat.currency || 'usd'),
            paymentMode,
            decisionDeadline,
        });
    } catch (createErr: any) {
        if (createdPaymentRow) await PaymentHistory.findByIdAndDelete(pendingPaymentId).catch(() => null);
        if (createErr?.code === 11000) {
            return { duplicate: true, request: null, decisionDeadline };
        }
        if (charge) await cancelPaymentIntent(payment_intent, charge.paidBy);
        throw createErr;
    }

    const expert = await User.findById(groupChat.admin.toString());
    const customer = await User.findById(String(userId));

    if (customer?.email) {
        const holdLine = charge
            ? `Your card has been authorized for <strong>$${(charge.amount / 100).toFixed(2)} ${String(charge.currency || 'USD').toUpperCase()}</strong> but not charged. You'll only be charged if the host approves your seat; otherwise the hold is released.`
            : paymentMode === 'wallet'
                ? `Nothing has been charged yet. If the host approves your seat, we'll email you a link to pay <strong>$${(dollarsToCents(groupChat.price) / 100).toFixed(2)}</strong> with WeChat Pay or Alipay within a limited window.`
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
            : paymentMode === 'wallet'
                ? 'They are paying by WeChat Pay or Alipay, which cannot hold funds — they pay once you approve.'
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

    return { duplicate: false, request, decisionDeadline };
};

const requestSeminarSeat = async (req, res) => {
    try {
        const { userId } = req.user;
        const { groupChatId, payment_intent } = req.body;
        const releaseOwnHold = async () => {
            if (!payment_intent) return;
            const mode = await resolveServerStripeMode();
            const auth = await checkPaymentIntentAuthorized(payment_intent, mode);
            if (!auth) return;
            const meta = (auth && (auth as any).metadata) || {};
            if (!meta.userId || String(meta.userId) !== String(userId)) return;
            await cancelPaymentIntent(payment_intent, mode);
        };

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });
        if (!groupChat) {
            await releaseOwnHold();
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }
        if (groupChat.type !== 'seminar') {
            await releaseOwnHold();
            return res.status(400).send("This group is not a seminar");
        }
        if (groupChat.admin.toString() === userId) {
            await releaseOwnHold();
            return res.status(403).send("Forbidden. Group admin can't register for their own seminar.");
        }
        if (groupChat.status !== 'active') {
            await releaseOwnHold();
            return res.status(400).send("Sorry, the seminar is not active");
        }

        const expectedCents = dollarsToCents(groupChat.price);
        const paymentMode = normalizePaymentMode(req.body.paymentMode);
        const walletRequest = paymentMode === 'wallet' && expectedCents > 0;

        let charge: any = null;
        if (expectedCents > 0 && !walletRequest) {
            if (await paymentIntentAlreadyConsumed(payment_intent)) {
                return res.status(409).send("This payment has already been used for a booking.");
            }
            const serverMode = await resolveServerStripeMode();
            const authProbe = await checkPaymentIntentAuthorized(payment_intent, serverMode);
            const authTest = serverMode === 'test' ? authProbe : false;
            const authLive = serverMode === 'live' ? authProbe : false;
            if (!authTest && !authLive) {
                const succeededProbe = await checkPaymentIntentSucceeded(payment_intent, serverMode);
                const capturedTest = serverMode === 'test' ? succeededProbe : false;
                const capturedLive = serverMode === 'live' ? succeededProbe : false;
                const captured = capturedTest || capturedLive;
                if (!captured) {
                    return res.status(400).send("Payment could not be verified.");
                }
                try {
                    assertIntentMatchesBooking(captured, {
                        userId: String(userId),
                        groupChatId: String(groupChat._id),
                    });
                } catch (bindErr) {
                    return res.status(400).send("This payment does not belong to this seminar.");
                }
                const refunded = await refundBookingCharge({
                    payment_intent,
                    charge: {
                        paidBy: capturedTest ? 'test' : 'live',
                        amount: captured.amount,
                        currency: captured.currency,
                    },
                    name: groupChat.name,
                    customer: await User.findById(String(userId)),
                    expert: await User.findById(groupChat.admin.toString()),
                    groupChatId: groupChat._id.toString(),
                    reason: 'Seat requests hold the fee rather than charging it',
                    recordStatus: 'refunded',
                });
                if (!refunded) {
                    console.error('[requestSeminarSeat] captured payment could not be refunded', payment_intent);
                    return res.status(500).send("Your payment was charged instead of held and could not be refunded automatically. Please contact support.");
                }
                return res.status(400).send("Your payment was charged instead of held, so it has been refunded. Please request a seat again.");
            }
            try {
                assertIntentMatchesBooking(authTest || authLive, {
                    userId: String(userId),
                    groupChatId: String(groupChat._id),
                });
            } catch (bindErr) {
                await releaseMismatchedHold(authTest || authLive, payment_intent, authTest ? 'test' : 'live', String(userId));
                return res.status(400).send("This payment does not belong to this seminar.");
            }
            try {
                charge = assertPaymentMatchesExpected(expectedCents, payment_intent, authTest, authLive);
            } catch (verifyErr) {
                await cancelPaymentIntent(payment_intent, authTest ? 'test' : 'live');
                return res.status(400).send("Payment could not be verified.");
            }
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
        const windowClosedMsg = seatRequestUnavailableMessage(startMs);
        if (windowClosedMsg) {
            return releaseAndFail(400, windowClosedMsg);
        }

        const existing = await SeminarSeatRequest.findOne({
            customer: userId,
            groupChat: groupChat._id,
            status: { $in: ['pending', 'awaiting_payment'] },
        });
        if (existing) {
            return releaseAndFail(409, existing.status === 'awaiting_payment'
                ? "Your seat was already approved — please complete the payment instead."
                : "You already have a pending request for this seminar.");
        }

        const recorded = await recordSeatRequest({ groupChat, userId, charge, payment_intent, paymentMode });
        if (recorded.duplicate) {
            return releaseAndFail(409, "You already have a pending request for this seminar.");
        }

        return res.status(200).json({ success: true, status: 'pending_approval', requestId: recorded.request._id });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const approveSeminarSeatRequest = async (req, res) => {
    try {
        const { userId } = req.user;
        const { requestId } = req.body;
        const decisionNote = sanitizeDecisionNote(req.body.note);

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

        const customer = await User.findById(request.customer.toString());
        const expert = await User.findById(groupChat.admin.toString());
        if (!customer || !expert) {
            return res.status(404).send("User not found for this request.");
        }


        const alreadyEnrolled = (groupChat.participants || []).some(
            (p: any) => p.toString() === request.customer.toString(),
        );
        const currentPriceCents = dollarsToCents(groupChat.price);
        const walletRequest = isWallet(request.paymentMode);
        const authorizedCents = typeof request.amount === 'number'
            ? request.amount
            : currentPriceCents;
        const approvalBlock = resolveSeatApprovalBlock({
            alreadyEnrolled,
            seminarStatus: groupChat.status,
            startMs: groupChat.start ? new Date(groupChat.start).getTime() : 0,
            deadlineMs: request.decisionDeadline ? new Date(request.decisionDeadline).getTime() : 0,
            // Nothing was authorized for a wallet request, so a price change since it was
            // made is not a blocker — the student simply pays today's price.
            authorizedCents: walletRequest ? undefined : authorizedCents,
            currentPriceCents,
        });
        const rejection = approvalBlock === 'already_enrolled'
                ? { status: 'rejected', code: 409, msg: "This student is already enrolled in the seminar." }
            : approvalBlock === 'seminar_closed'
                ? { status: 'rejected', code: 400, msg: "This seminar is no longer open, so the request can't be approved." }
            : approvalBlock === 'seminar_started'
                ? { status: 'expired', code: 400, msg: "This seminar has already started, so the request can no longer be approved." }
            : approvalBlock === 'request_expired'
                ? { status: 'expired', code: 400, msg: "This seat request has expired." }
            : approvalBlock === 'price_increased'
                ? { status: 'rejected', code: 409, msg: "The seminar price changed since this request, so it can't be approved. Please ask the student to request a seat again." }
            : null;
        if (rejection) {
            const claimedInvalid = await SeminarSeatRequest.findOneAndUpdate(
                { _id: request._id, status: 'pending' },
                { $set: { status: rejection.status } },
            );
            if (!claimedInvalid) {
                return res.status(409).send("This request has already been decided.");
            }
            const outcome = await releaseSeatRequestHold(request);
            await settleSeatRequestPayment(request, outcome, `Hold released — ${rejection.msg}`);
            return res.status(rejection.code).send(rejection.msg);
        }

        if (walletRequest && currentPriceCents > 0) {
            const appState = await AppState.findOne();
            const payBy = paymentWindowDeadline({
                sessionStartMs: groupChat.start ? new Date(groupChat.start).getTime() : 0,
                windowHours: paymentWindowHours(appState),
            });
            const awaiting = await SeminarSeatRequest.findOneAndUpdate(
                { _id: request._id, status: 'pending' },
                {
                    $set: {
                        status: 'awaiting_payment',
                        amount: currentPriceCents,
                        paymentDeadline: payBy,
                        decisionNote,
                        decisionNoteAt: new Date(),
                        decisionNoteReadAt: null,
                    },
                },
                { new: true },
            );
            if (!awaiting) {
                return res.status(409).send("This request has already been decided.");
            }

            await sendSeminarEmail(
                customer.email,
                `Seat approved — pay to confirm "${groupChat.name}"`,
                `<h2 style="color:#28a745;margin-top:0;">Your seat was approved</h2>
                 <p>${expert.username || 'The host'} approved your seat for
                 "<strong>${groupChat.name}</strong>". To claim it, please pay
                 <strong>$${(currentPriceCents / 100).toFixed(2)}</strong> with WeChat Pay or Alipay
                 from your dashboard by <strong>${payBy.toLocaleString()}</strong>.</p>
                 <p>The seat is released if payment isn't completed by then.</p>
                 ${decisionNoteEmailBlock(decisionNote, 'Message from the host')}`,
            );

            return res.status(200).json({ success: true, status: 'awaiting_payment', paymentDeadline: payBy });
        }

        const decided = await SeminarSeatRequest.findOneAndUpdate(
            { _id: request._id, status: 'pending' },
            { $set: { status: 'approved', decisionNote, decisionNoteAt: new Date(), decisionNoteReadAt: null } },
            { new: true },
        );
        if (!decided) {
            return res.status(409).send("This request has already been decided.");
        }

        let charge: any = null;
        if (request.paymentIntent) {
            const captureCents = Math.min(authorizedCents, currentPriceCents);

            if (captureCents <= 0) {
                // Seminar became free after the hold — release the hold, enrol at no charge.
                await cancelPaymentIntent(request.paymentIntent, request.stripeMode);
                if (request.paymentHistory) {
                    await PaymentHistory.findByIdAndUpdate(request.paymentHistory, {
                        status: 'released',
                        description: `Hold released — seminar is now free: ${groupChat.name}`,
                    }).catch(() => null);
                }
            } else {

                let captured = await capturePaymentIntent(request.paymentIntent, request.stripeMode, captureCents);
                if (!captured) {
                    captured = await checkPaymentIntentSucceeded(request.paymentIntent, request.stripeMode);
                }
                if (!captured) {
                    // Hand the decision back so the host can retry.
                    await SeminarSeatRequest.updateOne(
                        { _id: request._id, status: 'approved' },
                        { $set: { status: 'pending' } },
                    );
                    return res.status(502).send("Could not capture the authorized payment. The hold may have expired.");
                }
                const chargeObj = captured.latest_charge && typeof captured.latest_charge === 'object'
                    ? captured.latest_charge
                    : null;
                charge = {
                    paidBy: request.stripeMode,
                    amount: capturedAmountCents(captured),
                    currency: captured.currency,
                    receiptUrl: chargeObj?.receipt_url ?? null,
                    receiptNumber: chargeObj?.receipt_number ?? null,
                };
            }
        }

        try {
            await enrollAndConfirmSeminar({ groupChat, customer, expert, charge, payment_intent: request.paymentIntent, recordPayment: false });
        } catch (enrollErr) {
            console.log('[approveSeminarSeatRequest] enrollment failed after capture', enrollErr);
            await unenrollSeminarSeries(groupChat, request.customer.toString());

            let refunded = false;
            if (charge) {
                refunded = !!(await refundPaymentIntent(request.paymentIntent, null, request.stripeMode));
                if (request.paymentHistory) {
                    await PaymentHistory.findByIdAndUpdate(request.paymentHistory, {
                        status: refunded ? 'refunded' : 'completed',
                        // Record what was actually captured, not the authorized hold — a
                        // 'completed' (refund-pending) row must not overstate revenue.
                        amount: charge.amount,
                        currency: charge.currency,
                        description: refunded
                            ? `Refund — enrollment failed after capture: ${groupChat.name}`
                            : `Captured but enrollment failed, refund pending: ${groupChat.name}`,
                    });
                }
            }

            await SeminarSeatRequest.updateOne(
                { _id: request._id, status: 'approved' },
                { $set: { status: 'failed' } },
            );

            await sendSeminarEmail(
                customer.email,
                `Couldn't complete your seat — ${groupChat.name}`,
                `<h2 style="color:#dc3545;margin-top:0;">Seat could not be completed</h2>
                 <p>The host approved your seat for "<strong>${groupChat.name}</strong>", but we hit an
                 error finishing your enrollment, so you are not registered.
                 ${charge ? (refunded ? 'Your payment has been fully refunded.' : 'Our team is processing your refund.') : ''}</p>`,
            );

            return res
                .status(500)
                .send(
                    charge && !refunded
                        ? "The student could not be enrolled and the captured payment could not be refunded automatically. Please contact support."
                        : "The student could not be enrolled, so their payment was refunded. Please ask them to try again.",
                );
        }

        if (charge && request.paymentHistory) {
            try {
                await PaymentHistory.findByIdAndUpdate(request.paymentHistory, {
                    status: 'completed',
                    description: groupChat.name,
                    amount: charge.amount,
                    currency: charge.currency,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                });
            } catch (historyErr) {
                console.log('[approveSeminarSeatRequest] payment record update failed after enrollment', historyErr);
            }
        }

        await sendSeminarEmail(
            customer.email,
            `You're in — ${groupChat.name}`,
            `<h2 style="color:#28a745;margin-top:0;">Seat approved</h2>
             <p>${expert.username || 'The host'} approved your seat for
             "<strong>${groupChat.name}</strong>". ${charge ? 'Your card has now been charged and you\'re registered.' : 'You\'re now registered.'}</p>
             ${decisionNoteEmailBlock(decisionNote, 'Message from the host')}`,
        );

        return res.status(200).json({ success: true, status: 'approved' });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};


const paySeminarSeatRequest = async (req, res) => {
    try {
        const { userId } = req.user;
        const { requestId, payment_intent } = req.body;

        const request = await SeminarSeatRequest.findById(String(requestId));
        if (!request || request.customer.toString() !== String(userId)) {
            return res.status(404).send("Seat request not found.");
        }
        if (request.status !== 'awaiting_payment') {
            return res.status(409).send(request.status === 'approved'
                ? "This seat is already paid for and confirmed."
                : WALLET_NOT_YET_PAYABLE);
        }
        if (paymentWindowLapsed(request.paymentDeadline)) {
            return res.status(410).send("The payment window for this seat has closed, so it has been released. Please request a seat again.");
        }

        const groupChat = await GroupChat.findById(request.groupChat.toString());
        if (!groupChat) {
            return res.status(404).send("Seminar not found.");
        }
        const customer = await User.findById(String(userId));
        const expert = await User.findById(groupChat.admin.toString());
        if (!customer || !expert) {
            return res.status(404).send("User not found for this request.");
        }

        const expectedCents = Number(request.amount) || 0;
        if (!(expectedCents > 0)) {
            return res.status(400).send(BOOKING_PAYMENT_AMOUNT_INVALID);
        }
        if (await paymentIntentAlreadyConsumed(payment_intent)) {
            return res.status(409).send("This payment has already been used for a booking.");
        }

        const serverMode = await resolveServerStripeMode();
        // A wallet may still be clearing. The student has paid either way, so the seat is
        // claimed now and the webhook settles (or rolls back) the money.
        const settled = await checkPaymentIntentSucceeded(payment_intent, serverMode);
        const succeeded = settled || await checkPaymentIntentProcessing(payment_intent, serverMode);
        const settling = !settled && !!succeeded;
        if (!succeeded) {
            return res.status(400).send("Payment could not be verified. If you were charged, it will be refunded automatically.");
        }
        try {
            assertIntentMatchesBooking(succeeded, {
                userId: String(userId),
                groupChatId: String(groupChat._id),
            });
        } catch (bindErr) {
            return res.status(400).send("This payment does not belong to this seminar.");
        }
        // Bound to this seat specifically, not merely to the seminar: an intent minted
        // for some other flow on the same seminar must not be redeemable here.
        if (String(succeeded.metadata?.seatRequestId || '') !== String(request._id)) {
            return res.status(400).send("This payment was not created for this seat request.");
        }

        let charge: any;
        try {
            charge = assertPaymentMatchesExpected(
                expectedCents,
                payment_intent,
                serverMode === 'test' ? succeeded : false,
                serverMode === 'live' ? succeeded : false,
            );
        } catch (amountErr) {
            await refundBookingCharge({
                payment_intent,
                charge: { paidBy: serverMode, amount: succeeded.amount, currency: succeeded.currency },
                name: groupChat.name,
                customer,
                expert,
                groupChatId: groupChat._id.toString(),
                reason: 'Wallet payment did not match the approved seat price',
                recordStatus: 'refunded',
            });
            return res.status(400).send("The payment amount did not match this seat, so it has been refunded. Please try again.");
        }
        if (!charge) {
            return res.status(400).send("Payment could not be verified.");
        }

        const refundAndFail = async (code: number, message: string, reason: string) => {
            const refunded = await refundBookingCharge({
                payment_intent,
                charge,
                name: groupChat.name,
                customer,
                expert,
                groupChatId: groupChat._id.toString(),
                reason,
                recordStatus: 'refunded',
            });
            return res.status(code).send(refunded
                ? `${message} Your payment has been refunded.`
                : `${message} Your payment could not be refunded automatically — please contact support.`);
        };

        if (groupChat.status !== 'active') {
            return refundAndFail(400, "This seminar is no longer open.", "Seminar closed before the seat was paid for");
        }
        const startMs = groupChat.start ? new Date(groupChat.start).getTime() : 0;
        if (startMs && startMs <= Date.now()) {
            return refundAndFail(400, "This seminar has already started.", "Seminar started before the seat was paid for");
        }
        if ((groupChat.participants || []).some((p: any) => p.toString() === String(userId))) {
            return refundAndFail(409, "You are already registered for this seminar.", "Already enrolled before the seat was paid for");
        }

        // Claim the request before enrolling so a double submit can't buy two seats.
        const claimed = await SeminarSeatRequest.findOneAndUpdate(
            { _id: request._id, status: 'awaiting_payment' },
            {
                $set: {
                    status: 'approved',
                    paymentIntent: payment_intent,
                    stripeMode: charge.paidBy,
                    amount: charge.amount,
                    currency: charge.currency,
                },
            },
            { new: true },
        );
        if (!claimed) {
            return refundAndFail(409, "This seat request has already been settled.", "Seat request settled concurrently");
        }

        let paymentHistoryId: any = request.paymentHistory || null;
        if (!paymentHistoryId) {
            try {
                const ph = new PaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: settling ? `Wallet payment clearing: ${groupChat.name}` : groupChat.name,
                    paymentIntent: payment_intent,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                    // Money still in flight is not revenue yet; the webhook settles it.
                    status: settling ? 'pending' : 'completed',
                    customer: customer._id,
                    expert: expert._id,
                    groupChat: groupChat._id,
                });
                await ph.save();
                paymentHistoryId = ph._id;
                await SeminarSeatRequest.updateOne({ _id: request._id }, { $set: { paymentHistory: ph._id } });
            } catch (historyErr: any) {
                if (historyErr?.code === 11000) {
                    await SeminarSeatRequest.updateOne(
                        { _id: request._id, status: 'approved' },
                        { $set: { status: 'awaiting_payment' } },
                    );
                    return res.status(409).send(BOOKING_PAYMENT_ALREADY_USED);
                }
                console.error('[paySeminarSeatRequest] UNRECORDED CAPTURED PAYMENT — reconcile manually', payment_intent, historyErr);
            }
        }

        try {
            await enrollAndConfirmSeminar({ groupChat, customer, expert, charge, payment_intent, recordPayment: false });
        } catch (enrollErr) {
            console.log('[paySeminarSeatRequest] enrollment failed after payment', enrollErr);
            await unenrollSeminarSeries(groupChat, String(userId));
            const refunded = !!(await refundPaymentIntent(payment_intent, null, charge.paidBy));
            if (paymentHistoryId) {
                await PaymentHistory.findByIdAndUpdate(paymentHistoryId, {
                    status: refunded ? 'refunded' : 'completed',
                    description: refunded
                        ? `Refund — enrollment failed after payment: ${groupChat.name}`
                        : `Paid but enrollment failed, refund pending: ${groupChat.name}`,
                }).catch(() => null);
            }
            await SeminarSeatRequest.updateOne(
                { _id: request._id, status: 'approved' },
                { $set: { status: 'failed' } },
            );
            return res.status(500).send(refunded
                ? "We couldn't complete your registration, so your payment has been refunded."
                : "We couldn't complete your registration and the payment could not be refunded automatically. Please contact support.");
        }

        let userDetails: any = null;
        try {
            userDetails = await getFullUserData(customer.email);
            userDetails.token = null;
            userDetails.password = null;
        } catch (profileErr) {
            console.log('[paySeminarSeatRequest] enrolled but profile reload failed', profileErr);
        }

        return res.status(200).json({ success: true, status: 'approved', result: userDetails });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const releaseSeatRequestHold = async (request: any) => {
    if (!request.paymentIntent) return 'released';
    if (await cancelPaymentIntent(request.paymentIntent, request.stripeMode)) return 'released';

    if (await checkPaymentIntentSucceeded(request.paymentIntent, request.stripeMode)) {
        const refund = await refundPaymentIntent(request.paymentIntent, null, request.stripeMode);
        if (refund) return 'refunded';
        console.error('[releaseSeatRequestHold] captured payment could not be refunded', request.paymentIntent);
        return 'stuck';
    }
    if (await checkPaymentIntentAuthorized(request.paymentIntent, request.stripeMode)) {
        console.error('[releaseSeatRequestHold] hold could not be released', request.paymentIntent);
        return 'stuck';
    }
    return 'released';
};

const releaseParkedHold = async (parked: any): Promise<'released' | 'refunded' | 'stuck'> => {
    if (!parked?.paymentIntent) return 'released';
    if (await cancelPaymentIntent(parked.paymentIntent, parked.stripeMode)) return 'released';

    if (await checkPaymentIntentSucceeded(parked.paymentIntent, parked.stripeMode)) {
        const refund = await refundPaymentIntent(parked.paymentIntent, null, parked.stripeMode);
        if (refund) return 'refunded';
        console.error('[releaseParkedHold] captured payment could not be refunded', parked.paymentIntent);
        return 'stuck';
    }
    if (await checkPaymentIntentAuthorized(parked.paymentIntent, parked.stripeMode)) {
        console.error('[releaseParkedHold] hold could not be released', parked.paymentIntent);
        return 'stuck';
    }
    return 'released';
};

const settleSeatRequestPayment = async (request: any, outcome: string, note: string) => {
    if (!request.paymentHistory) return;
    const update = outcome === 'stuck'
        ? { status: 'pending', description: `ACTION REQUIRED — hold not released (${note})` }
        : { status: outcome === 'refunded' ? 'refunded' : 'released', description: note };
    await PaymentHistory.findByIdAndUpdate(request.paymentHistory, update).catch(() => null);
};

const rejectSeminarSeatRequest = async (req, res) => {
    try {
        const { userId } = req.user;
        const { requestId } = req.body;
        // Turning a student away past capacity is a rejection, so the host owes them
        // a reason they can act on (see the decline rule in cancelIndividualAppointment).
        const decisionNote = sanitizeDecisionNote(req.body.note);
        if (!decisionNote) {
            return res.status(400).send("Please add a short note for the student explaining the decline.");
        }

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

        const decided = await SeminarSeatRequest.findOneAndUpdate(
            { _id: request._id, status: 'pending' },
            { $set: { status: 'rejected', decisionNote, decisionNoteAt: new Date(), decisionNoteReadAt: null } },
        );
        if (!decided) {
            return res.status(409).send("This request has already been decided.");
        }

        const outcome = await releaseSeatRequestHold(request);
        await settleSeatRequestPayment(request, outcome, `Hold released — seat request declined: ${groupChat.name}`);

        const customer = await User.findById(request.customer.toString());
        if (customer?.email) {
            const moneyLine = !request.paymentIntent ? ''
                : outcome === 'refunded' ? ' Your payment has been refunded.'
                : outcome === 'stuck' ? ' We are still releasing your payment hold — please contact support if it has not cleared within a few days.'
                : ' Your payment hold has been released and you were not charged.';
            await sendSeminarEmail(
                customer.email,
                `Seat request update — ${groupChat.name}`,
                `<h2 style="color:#333;margin-top:0;">Seat request declined</h2>
                 <p>Unfortunately the host could not offer you a seat for
                 "<strong>${groupChat.name}</strong>".${moneyLine}</p>
                 ${decisionNoteEmailBlock(decisionNote, 'Message from the host')}`,
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
            .populate({
                path: 'groupChat',
                select: 'name start description duration price keywords services purposeOther type isRecurring recurrenceFrequency admin participants',
                populate: [
                    { path: 'admin', select: 'username email image' },
                    { path: 'participants', select: 'username email image' },
                    { path: 'keywords', select: 'value label approved' },
                    { path: 'services', select: 'value label' },
                ],
            })
            .sort({ createdAt: 1 });
        return res.status(200).json({ success: true, result: requests });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const getMyDecisionNotices = async (req, res) => {
    try {
        const { userId } = req.user;
        const cutoff = decisionNoticeCutoff();

        const sessions = await GroupChat.find({
            participants: userId,
            admin: { $ne: userId },
            type: 'individual',
            decisionNote: { $nin: [null, ''] },
            decisionNoteAt: { $gte: cutoff },
            decisionNoteReadAt: null,
        })
            .select('name status decisionNote decisionNoteAt admin createdBy start price paymentMode paymentDeadline')
            .populate('admin', 'username image')
            .sort({ decisionNoteAt: -1 })
            .limit(20);

        const seats = await SeminarSeatRequest.find({
            customer: userId,
            decisionNote: { $nin: [null, ''] },
            decisionNoteAt: { $gte: cutoff },
            decisionNoteReadAt: null,
        })
            .select('status decisionNote decisionNoteAt groupChat expert amount paymentMode paymentDeadline')
            .populate('groupChat', 'name start')
            .populate('expert', 'username image')
            .sort({ decisionNoteAt: -1 })
            .limit(20);

        const notices = [
            ...sessions.map((g: any) => {
                // A pending session the expert created and then cancelled was an offer
                // they withdrew; anything else they cancelled was the student's request.
                const outcome = resolveSessionDecisionOutcome({
                    status: g.status,
                    expertCreated: String(g.createdBy) === String(g.admin?._id ?? g.admin),
                    awaitingPayment: isWallet(g.paymentMode) && !!g.paymentDeadline,
                });
                return {
                    id: String(g._id),
                    kind: 'session',
                    outcome,
                    title: g.name || '1:1 session',
                    start: g.start,
                    note: g.decisionNote,
                    decidedAt: g.decisionNoteAt,
                    // Only meaningful while payment is owed — lets the notice offer to pay.
                    price: typeof g.price === 'number' ? g.price : null,
                    payBy: outcome === 'accepted_awaiting_payment' ? g.paymentDeadline : null,
                    expertName: g.admin?.username || null,
                    expertImage: g.admin?.image || null,
                };
            }),
            ...seats.map((r: any) => {
                const outcome = resolveSeatDecisionOutcome(r.status);
                return {
                    id: String(r._id),
                    kind: 'seat',
                    outcome,
                    title: r.groupChat?.name || 'Seminar',
                    start: r.groupChat?.start,
                    note: r.decisionNote,
                    decidedAt: r.decisionNoteAt,
                    groupChatId: r.groupChat?._id ? String(r.groupChat._id) : null,
                    price: typeof r.amount === 'number' ? r.amount / 100 : null,
                    payBy: outcome === 'accepted_awaiting_payment' ? r.paymentDeadline : null,
                    expertName: r.expert?.username || null,
                    expertImage: r.expert?.image || null,
                };
            }),
        ]
            .filter((n) => decisionNoticeIsVisible({ note: n.note, decidedAt: n.decidedAt }))
            .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime());

        return res.status(200).json({ success: true, result: notices });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

// Dismissing a notice is scoped to the caller's own rows, so one student can
// never clear another's.
const markDecisionNoticeRead = async (req, res) => {
    try {
        const { userId } = req.user;
        const { noticeId, kind } = req.body;
        if (!noticeId || (kind !== 'session' && kind !== 'seat')) {
            return res.status(400).send("A notice id and kind are required.");
        }

        const readAt = new Date();
        const updated = kind === 'session'
            ? await GroupChat.updateOne(
                { _id: String(noticeId), participants: userId, type: 'individual' },
                { $set: { decisionNoteReadAt: readAt } },
            )
            : await SeminarSeatRequest.updateOne(
                { _id: String(noticeId), customer: userId },
                { $set: { decisionNoteReadAt: readAt } },
            );

        if (!updated?.matchedCount) {
            return res.status(404).send("Notice not found.");
        }
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const getMySeatRequests = async (req, res) => {
    try {
        await sweepExpiredSeatRequests();
        await sweepExpiredWalletPayments();
        const { userId } = req.user;
        const requests = await SeminarSeatRequest.find({ customer: userId })
            .select('groupChat status decisionDeadline paymentDeadline paymentMode amount currency')
            .populate({
                path: 'groupChat',
                select: 'name start description duration price keywords services purposeOther type isRecurring recurrenceFrequency admin',
                populate: [
                    { path: 'admin', select: 'username email image' },
                    { path: 'keywords', select: 'value label approved' },
                    { path: 'services', select: 'value label' },
                ],
            })
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, result: requests });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeHttp500Message(err));
    }
};

const sweepExpiredSeatRequests = async () => {
    try {
        const due = await SeminarSeatRequest.find({
            status: 'pending',
            decisionDeadline: { $lte: new Date() },
        }).populate('groupChat', 'name');
        let expired = 0;
        for (const request of due) {

            const claimed = await SeminarSeatRequest.findOneAndUpdate(
                { _id: request._id, status: 'pending' },
                { $set: { status: 'expired' } },
            );
            if (!claimed) continue;
            expired += 1;

            const outcome = await releaseSeatRequestHold(request);
            await settleSeatRequestPayment(request, outcome, `Hold released — seat request expired: ${request.groupChat?.name || 'Seminar'}`);

            const customer = await User.findById(request.customer.toString());
            if (customer?.email) {
                const moneyLine = !request.paymentIntent ? ''
                    : outcome === 'refunded' ? ' Your payment has been refunded.'
                    : outcome === 'stuck' ? ' We are still releasing your payment hold — please contact support if it has not cleared within a few days.'
                    : ' Your payment hold has been released and you were not charged.';
                await sendSeminarEmail(
                    customer.email,
                    `Seat request expired — ${request.groupChat?.name || 'Seminar'}`,
                    `<h2 style="color:#333;margin-top:0;">Seat request expired</h2>
                     <p>The host didn't respond in time to your seat request for
                     "<strong>${request.groupChat?.name || 'the seminar'}</strong>".${moneyLine}</p>`,
                );
            }
        }
        return expired;
    } catch (err) {
        console.log('[sweepExpiredSeatRequests]', err.message);
        return 0;
    }
};

const EXPIRY_NOTICE_WINDOW_MS = 48 * 60 * 60 * 1000;

const sweepExpiredSessionHolds = async () => {
    try {
        const nowDate = new Date();
        const due = await GroupChat.find({
            type: 'individual',
            status: 'pending',
            $or: [
                { decisionDeadline: { $ne: null, $lte: nowDate } },
                { start: { $ne: null, $lt: nowDate } },
            ],
        }).select('name admin createdBy participants decisionDeadline paymentMode start');

        let expired = 0;
        for (const chat of due) {
            const parked = await findParkedHold(chat._id);
            if (!parked) {
                const startMs = chat.start ? new Date(chat.start).getTime() : 0;
                const sessionPassed = startMs > 0 && startMs <= Date.now();
                if (isWallet(chat.paymentMode) || sessionPassed) {
                    const lapsed = await GroupChat.findOneAndUpdate(
                        { _id: chat._id, status: 'pending' },
                        { $set: { status: 'cancelled', decisionDeadline: null } },
                    );
                    if (!lapsed) continue;
                    expired += 1;
                    // Retiring a long-dead request is bookkeeping catching up, not news.
                    // Only tell the student when the expiry is recent enough to act on.
                    const staleBacklog = sessionPassed && Date.now() - startMs > EXPIRY_NOTICE_WINDOW_MS;
                    const student = staleBacklog ? null : await User.findById(String(chat.createdBy));
                    if (student?.email) {
                        await sendSeminarEmail(
                            student.email,
                            `Session request expired — ${chat.name || '1:1 session'}`,
                            `<h2 style="color:#333;margin-top:0;">Session request expired</h2>
                             <p>The expert didn't respond in time to your 1:1 session request for
                                "<strong>${chat.name || '1:1 session'}</strong>". You were never charged.</p>
                             <p>Thank you for using WisdomLinked. We hope you find another expert who meets your needs.</p>`,
                        );
                    }
                    continue;
                }
                await GroupChat.updateOne(
                    { _id: chat._id, status: 'pending' },
                    { $set: { decisionDeadline: null } },
                ).catch(() => null);
                continue;
            }

            const claimed = await GroupChat.findOneAndUpdate(
                { _id: chat._id, status: 'pending' },
                { $set: { status: 'cancelled' } },
            );
            if (!claimed) continue;
            expired += 1;

            const sessionName = chat.name || '1:1 session';
            const outcome = await releaseParkedHold(parked);
            if (outcome === 'refunded') {
                await appendPaymentHistory({
                    stripeMode: parked.stripeMode,
                    amount: parked.amount,
                    currency: parked.currency,
                    description: `Refund — session request expired: ${sessionName}`,
                    customer: parked.customer,
                    expert: parked.expert,
                    groupChat: parked.groupChat,
                    paymentType: 'refund',
                    paymentIntent: parked.paymentIntent,
                    status: 'refunded',
                });
            }
            await PaymentHistory.findByIdAndUpdate(parked._id, outcome === 'stuck'
                ? { status: 'pending', description: `ACTION REQUIRED — hold not released (session request expired: ${sessionName})` }
                : {
                    status: outcome === 'refunded' ? 'refunded' : 'released',
                    description: `Hold released — session request expired: ${sessionName}`,
                }).catch(() => null);

            const customer = await User.findById(String(parked.customer));
            if (customer?.email) {
                const moneyLine = outcome === 'refunded'
                    ? ' Your payment has been refunded in full.'
                    : outcome === 'stuck'
                        ? ' We are still releasing your payment authorization — please contact support if it has not cleared within a few days.'
                        : ' Your payment authorization has been released, and no payment has been processed.';
                await sendSeminarEmail(
                    customer.email,
                    `Session request expired — ${sessionName}`,
                    `<h2 style="color:#333;margin-top:0;">Session request expired</h2>
                     <p>The expert didn't respond in time to your 1:1 session request for
                        "<strong>${sessionName}</strong>".${moneyLine}</p>
                     <p>Thank you for using WisdomLinked. We hope you find another expert who meets your needs.</p>`,
                );
            }
        }
        return expired;
    } catch (err) {
        console.log('[sweepExpiredSessionHolds]', err.message);
        return 0;
    }
};

const sweepExpiredWalletPayments = async () => {
    let expired = 0;
    try {
        const sessions = await GroupChat.find({
            type: 'individual',
            status: 'pending',
            paymentMode: 'wallet',
            paymentDeadline: { $ne: null, $lte: new Date() },
        }).select('name createdBy paymentDeadline');

        for (const chat of sessions) {
            const claimed = await GroupChat.findOneAndUpdate(
                { _id: chat._id, status: 'pending' },
                { $set: { status: 'cancelled', paymentDeadline: null, decisionDeadline: null } },
            );
            if (!claimed) continue;
            expired += 1;

            const student = await User.findById(String(chat.createdBy));
            if (student?.email) {
                await sendSeminarEmail(
                    student.email,
                    `Session released — ${chat.name || '1:1 session'}`,
                    `<h2 style="color:#333;margin-top:0;">Your session was released</h2>
                     <p>Payment for "<strong>${chat.name || 'your 1:1 session'}</strong>" wasn't completed in time,
                        so the slot has been released. You were not charged.</p>
                     <p>You're welcome to book it again if it's still available.</p>`,
                );
            }
        }
    } catch (err: any) {
        console.log('[sweepExpiredWalletPayments] sessions', err.message);
    }

    try {
        const seats = await SeminarSeatRequest.find({
            status: 'awaiting_payment',
            paymentDeadline: { $ne: null, $lte: new Date() },
        }).populate('groupChat', 'name');

        for (const request of seats) {
            const claimed = await SeminarSeatRequest.findOneAndUpdate(
                { _id: request._id, status: 'awaiting_payment' },
                { $set: { status: 'expired' } },
            );
            if (!claimed) continue;
            expired += 1;

            const customer = await User.findById(request.customer.toString());
            if (customer?.email) {
                await sendSeminarEmail(
                    customer.email,
                    `Seat released — ${request.groupChat?.name || 'Seminar'}`,
                    `<h2 style="color:#333;margin-top:0;">Your seat was released</h2>
                     <p>Payment for your approved seat in "<strong>${request.groupChat?.name || 'the seminar'}</strong>"
                        wasn't completed in time, so the seat has been released. You were not charged.</p>`,
                );
            }
        }
    } catch (err: any) {
        console.log('[sweepExpiredWalletPayments] seats', err.message);
    }

    return expired;
};

// An expert's offer holds a slot no student has committed to, so it is released when
// its payment window lapses. Nothing was authorized on this path, so there is no money
// to return — only a slot to free and two people to tell.
const sweepExpiredProposedSessions = async () => {
    let expired = 0;
    try {
        const sessions = await GroupChat.find({
            type: 'individual',
            status: 'pending',
            paymentMode: { $ne: 'wallet' },
            paymentDeadline: { $ne: null, $lte: new Date() },
        }).select('name admin createdBy participants start price paymentDeadline');

        for (const chat of sessions) {
            // Only the expert's own offers expire this way; a student's request is the
            // expert's to decide on and is governed by the hold, not by this window.
            if (String(chat.createdBy) !== String(chat.admin)) continue;

            const claimed = await GroupChat.findOneAndUpdate(
                { _id: chat._id, status: 'pending' },
                { $set: { status: 'cancelled', paymentDeadline: null, decisionDeadline: null } },
            );
            if (!claimed) continue;
            expired += 1;

            const expertId = String(chat.admin);
            const studentId = groupMemberIds(chat).find((id: string) => id !== expertId);
            const sessionName = chat.name || '1:1 session';

            for (const participantId of chat.participants || []) {
                await User.updateOne(
                    { _id: String(participantId) },
                    { $pull: { groupChats: chat._id } },
                );
            }

            const student = studentId ? await User.findById(studentId) : null;
            if (student?.email) {
                await sendSeminarEmail(
                    student.email,
                    `Session offer expired — ${sessionName}`,
                    `<h2 style="color:#333;margin-top:0;">This session offer has expired</h2>
                     <p>The offer for "<strong>${sessionName}</strong>" wasn't paid for in time, so the slot has
                        been released. You were not charged.</p>
                     <p>You're welcome to book the expert again if the time still suits you.</p>`,
                );
            }

            const expert = await User.findById(expertId);
            if (expert?.email) {
                await sendSeminarEmail(
                    expert.email,
                    `Offer expired — ${sessionName}`,
                    `<h2 style="color:#333;margin-top:0;">Your session offer expired</h2>
                     <p>${student?.username || 'The student'} did not pay for "<strong>${sessionName}</strong>"
                        within the payment window, so the offer has been released and your time is free again.</p>`,
                );
            }
        }
    } catch (err: any) {
        console.log('[sweepExpiredProposedSessions]', err.message);
    }

    return expired;
};

const PENDING_PAYMENT_GRACE_MS = 60 * 60 * 1000;

const sweepPendingSeminarPayments = async () => {
    try {
        const rows = await PaymentHistory.find({
            status: 'pending',
            paymentType: 'charge',
            paymentIntent: { $nin: [null, ''] },
            updatedAt: { $lte: new Date(Date.now() - PENDING_PAYMENT_GRACE_MS) },
        }).limit(200);

        let settled = 0;
        for (const row of rows) {
            // A hold still awaiting a host decision is owned by the approval flow.
            const ownedByOpenSeatRequest = !!(await SeminarSeatRequest.exists({
                paymentIntent: row.paymentIntent,
                status: 'pending',
            }));
            const captured = ownedByOpenSeatRequest
                ? false
                : await checkPaymentIntentSucceeded(row.paymentIntent, row.stripeMode);
            const stillAuthorized = (ownedByOpenSeatRequest || captured)
                ? false
                : !!(await checkPaymentIntentAuthorized(row.paymentIntent, row.stripeMode));
            const settling = (ownedByOpenSeatRequest || captured || stillAuthorized)
                ? false
                : !!(await checkPaymentIntentProcessing(row.paymentIntent, row.stripeMode));
            const enrolled = captured
                ? !!(await GroupChat.exists({ _id: row.groupChat, participants: row.customer }))
                : false;

            const action = resolvePendingPayment({
                captured: !!captured,
                stillAuthorized,
                ownedByOpenSeatRequest,
                enrolled,
                settling,
            });
            if (action === 'wait') continue;

            let update: Record<string, any>;
            let preExistingRefund = false;
            if (action === 'settle') {
                const chargeObj = captured.latest_charge && typeof captured.latest_charge === 'object'
                    ? captured.latest_charge
                    : null;
                update = {
                    status: 'completed',
                    amount: capturedAmountCents(captured),
                    currency: captured.currency,
                    receiptUrl: chargeObj?.receipt_url ?? null,
                    receiptNumber: chargeObj?.receipt_number ?? null,
                };
            } else if (action === 'refund') {
                const refund: any = await refundPaymentIntent(row.paymentIntent, null, row.stripeMode);
                if (!refund) {
                    console.error('[sweepPendingSeminarPayments] captured-but-unenrolled refund failed', row.paymentIntent);
                    continue;
                }
                // Already refunded elsewhere: settle our books quietly rather than
                // announcing a refund the student was told about long ago.
                preExistingRefund = !!refund.alreadyRefunded;
                update = {
                    status: 'refunded',
                    description: preExistingRefund
                        ? 'Refund — recorded from an existing Stripe refund (reconciled)'
                        : 'Refund — captured without enrollment',
                };
            } else if (action === 'release') {
                const cancelled = await cancelPaymentIntent(row.paymentIntent, row.stripeMode);
                if (!cancelled) {
                    const raced = await checkPaymentIntentSucceeded(row.paymentIntent, row.stripeMode);
                    if (!raced) {
                        console.error('[sweepPendingSeminarPayments] hold could not be released, will retry', row.paymentIntent);
                    }
                    continue;
                }
                update = { status: 'failed', description: 'Hold released — registration never completed' };
            } else {
                update = { status: 'failed' };
            }

            const result = await PaymentHistory.updateOne(
                { _id: row._id, status: 'pending' },
                { $set: update },
            );
            if (result?.modifiedCount) {
                settled += 1;
                console.log('[sweepPendingSeminarPayments]', action, row.paymentIntent);
                if ((action === 'refund' && !preExistingRefund) || action === 'release') {

                    await releaseUncapturedSeatClaim(row.groupChat, row.customer);
                    const student = await User.findById(String(row.customer));
                    if (student?.email) {
                        await sendSeminarEmail(
                            student.email,
                            action === 'refund' ? 'Payment refunded' : 'Payment hold released',
                            action === 'refund'
                                ? `<h2 style="color:#28a745;margin-top:0;">Payment refunded</h2>
                                   <p>We charged your card for a seminar seat but could not complete your
                                   registration, so the payment has been fully refunded. You were not enrolled.</p>`
                                : `<h2 style="color:#28a745;margin-top:0;">Payment hold released</h2>
                                   <p>A seminar registration didn't complete, so the hold on your card has been
                                   released. You were not charged and you were not enrolled.</p>`,
                        );
                    }
                }
            }
        }
        return settled;
    } catch (err) {
        console.log('[sweepPendingSeminarPayments]', err.message);
        return 0;
    }
};

const ORPHAN_INTENT_GRACE_MS = 60 * 60 * 1000;
const ORPHAN_INTENT_LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000;
const ORPHAN_MATCH_BEFORE_MS = 15 * 60 * 1000;
const ORPHAN_MATCH_AFTER_MS = 24 * 60 * 60 * 1000;

const orphanIntentWasDelivered = async (intent: any, meta: any): Promise<boolean> => {
    if (meta.groupChatId) {
        const chat = await GroupChat.findById(String(meta.groupChatId)).select('type status participants');
        if (!chat) return false;
        const isParticipant = (chat.participants || []).some(
            (p: any) => String(p) === String(meta.userId),
        );
        // On a 1:1 both people are participants from the moment it is requested, so
        // membership proves nothing about payment — only an active session means the
        // booking was actually delivered. A seminar seat, by contrast, is the enrolment.
        if (chat.type === 'individual') return isParticipant && chat.status === 'active';
        return isParticipant;
    }
    if (!meta.expertId || !intent.createdMs) return false;
    return !!(await GroupChat.exists({
        type: 'individual',
        createdBy: meta.userId,
        admin: meta.expertId,
        price: intent.amount / 100,
        status: { $ne: 'cancelled' },
        createdAt: {
            $gte: new Date(intent.createdMs - ORPHAN_MATCH_BEFORE_MS),
            $lte: new Date(intent.createdMs + ORPHAN_MATCH_AFTER_MS),
        },
    }));
};

const sweepOrphanedBookingIntentsForMode = async (stripeMode: 'test' | 'live') => {
    try {
        const now = Date.now();
        const intents = await listReconcilableBookingIntents(stripeMode, {
            sinceMs: now - ORPHAN_INTENT_LOOKBACK_MS,
            untilMs: now - ORPHAN_INTENT_GRACE_MS,
        });

        let handled = 0;
        for (const intent of intents) {
            const meta = intent.metadata || {};
            if (!meta.userId) continue;

            const recorded = !!(await PaymentHistory.exists({ paymentIntent: intent.id }));
            const heldByRequest = !!(await SeminarSeatRequest.exists({
                paymentIntent: intent.id,
                status: { $in: ['pending', 'approved'] },
            }));

            const enrolled = intent.status === 'succeeded'
                ? await orphanIntentWasDelivered(intent, meta)
                : false;

            const action = resolveOrphanedIntent({ status: intent.status, recorded, heldByRequest, enrolled });
            if (action === 'skip') continue;

            if (action === 'release') {
                if (await cancelPaymentIntent(intent.id, stripeMode)) {
                    handled += 1;
                    console.log('[sweepOrphanedBookingIntents] released stranded hold', intent.id);
                    await releaseUncapturedSeatClaim(meta.groupChatId, meta.userId);
                }
                continue;
            }

            const expertId = meta.groupChatId
                ? (await GroupChat.findById(String(meta.groupChatId)).select('admin'))?.admin
                : meta.expertId;

            if (action === 'record') {
                await appendPaymentHistory({
                    stripeMode,
                    paymentType: 'charge',
                    amount: intent.amount,
                    currency: intent.currency,
                    description: 'Booking payment recovered from Stripe',
                    paymentIntent: intent.id,
                    status: 'completed',
                    customer: meta.userId,
                    expert: expertId,
                    groupChat: meta.groupChatId,
                });
                handled += 1;
                console.log('[sweepOrphanedBookingIntents] recorded enrolled-but-unrecorded charge', intent.id);
                continue;
            }

            // action === 'refund'
            const refund: any = await refundPaymentIntent(intent.id, null, stripeMode);
            if (refund) {
                const preExisting = !!refund.alreadyRefunded;
                await appendPaymentHistory({
                    stripeMode,
                    paymentType: 'refund',
                    amount: intent.amount,
                    currency: intent.currency,
                    description: preExisting
                        ? 'Refund — recorded from an existing Stripe refund (reconciled)'
                        : 'Refund — booking never completed (reconciled from Stripe)',
                    paymentIntent: intent.id,
                    status: 'refunded',
                    customer: meta.userId,
                    expert: expertId,
                    groupChat: meta.groupChatId,
                });
                handled += 1;
                console.log(
                    preExisting
                        ? '[sweepOrphanedBookingIntents] recorded pre-existing refund'
                        : '[sweepOrphanedBookingIntents] refunded stranded capture',
                    intent.id,
                );
                const student = preExisting ? null : await User.findById(String(meta.userId));
                if (student?.email) {
                    await sendSeminarEmail(
                        student.email,
                        'Payment refunded',
                        `<h2 style="color:#28a745;margin-top:0;">Payment refunded</h2>
                         <p>A booking payment didn't complete, so it has been fully refunded.
                         You were not enrolled. The refund appears within 5–10 business days.</p>`,
                    );
                }
            }
        }
        return handled;
    } catch (err: any) {
        console.log('[sweepOrphanedBookingIntents]', stripeMode, err.message);
        return 0;
    }
};

const sweepOrphanedBookingIntents = async () => {
    let handled = 0;
    for (const mode of ['test', 'live'] as const) {
        handled += await sweepOrphanedBookingIntentsForMode(mode);
    }
    return handled;
};

const handleBookingPaymentIntentEvent = async (event: any): Promise<string> => {
    const intent = event?.data?.object;
    const meta = (intent && intent.metadata) || {};
    const bookingType = String(meta.bookingType || '');
    if (bookingType !== 'groupChat' && bookingType !== 'oneToOne') return 'ignored';
    if (!intent?.id || !meta.userId) return 'ignored';

    const stripeMode: 'test' | 'live' = event?.livemode ? 'live' : 'test';

    if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
        const pending = await PaymentHistory.find({
            paymentIntent: String(intent.id),
            paymentType: 'charge',
            status: 'pending',
        }).select('_id groupChat customer');

        for (const row of pending) {
            await PaymentHistory.updateOne(
                { _id: row._id, status: 'pending' },
                { $set: { status: 'failed', description: `Payment ${event.type === 'payment_intent.canceled' ? 'canceled' : 'failed'} — booking not completed` } },
            );
            await releaseUncapturedSeatClaim(row.groupChat, row.customer);
        }

        const withheld = await PaymentHistory.find({
            paymentIntent: String(intent.id),
            paymentType: 'charge',
            status: 'withheld',
        }).select('_id groupChat customer');

        for (const row of withheld) {
            await PaymentHistory.updateOne(
                { _id: row._id, status: 'withheld' },
                {
                    $set: {
                        status: event.type === 'payment_intent.canceled' ? 'released' : 'failed',
                        description: `Authorization ${event.type === 'payment_intent.canceled' ? 'released' : 'failed'} before the expert decided`,
                    },
                },
            );
            await GroupChat.updateOne(
                { _id: row.groupChat, status: 'pending' },
                { $set: { status: 'cancelled', decisionDeadline: null } },
            ).catch(() => null);
        }

        if (meta.groupChatId) {
            await releaseUncapturedSeatClaim(meta.groupChatId, meta.userId);
        }
        return (pending.length || withheld.length) ? 'failed_rolled_back' : 'failed_noop';
    }

    if (event.type !== 'payment_intent.succeeded') return 'ignored';

    const settled = await PaymentHistory.findOneAndUpdate(
        { paymentIntent: String(intent.id), paymentType: 'charge', status: 'pending' },
        {
            $set: {
                status: 'completed',
                amount: capturedAmountCents(intent),
                currency: intent.currency,
                receiptUrl: chargeReceiptUrl(intent),
                receiptNumber: chargeReceiptNumber(intent),
            },
        },
    );
    if (settled) {
        // The booking was confirmed while the wallet cleared, so this is the first
        // moment the student can be told their payment actually landed.
        try {
            const chat = settled.groupChat
                ? await GroupChat.findById(String(settled.groupChat)).select('name')
                : null;
            const student = await User.findById(String(settled.customer));
            if (student?.email) {
                await sendSeminarEmail(
                    student.email,
                    `Payment confirmed — ${chat?.name || 'your booking'}`,
                    `<h2 style="color:#28a745;margin-top:0;">Payment confirmed</h2>
                     <p>Your payment of <strong>$${(capturedAmountCents(intent) / 100).toFixed(2)}
                     ${String(intent.currency || 'USD').toUpperCase()}</strong> for
                     "<strong>${chat?.name || 'your booking'}</strong>" has cleared. Your booking is confirmed.</p>`,
                );
            }
        } catch (notifyErr: any) {
            console.log('[handleBookingPaymentIntentEvent] settle notice failed', notifyErr?.message);
        }
        return 'settled_pending';
    }

    const recorded = await PaymentHistory.exists({
        paymentIntent: String(intent.id),
        paymentType: 'charge',
    });
    if (recorded) return 'already_recorded';

    const heldByRequest = await SeminarSeatRequest.exists({
        paymentIntent: String(intent.id),
        status: { $in: ['pending', 'approved'] },
    });
    if (heldByRequest) return 'held_by_seat_request';
    if (meta.seatRequestId && mongoose.isValidObjectId(String(meta.seatRequestId))) {
        const claimable = await SeminarSeatRequest.exists({
            _id: String(meta.seatRequestId),
            status: { $in: ['awaiting_payment', 'approved'] },
        });
        if (claimable) return 'held_by_seat_request';
    }

    const delivered = await orphanIntentWasDelivered(
        { amount: intent.amount, createdMs: Number(intent.created || 0) * 1000 },
        meta,
    );
    // Undelivered money is deliberately left to the graced sweep: a booking request may
    // still be in flight, and refunding here would cancel a sale that is about to close.
    if (!delivered) return 'awaiting_sweep';

    const expertId = meta.groupChatId
        ? (await GroupChat.findById(String(meta.groupChatId)).select('admin'))?.admin
        : meta.expertId;

    await appendPaymentHistory({
        stripeMode,
        paymentType: 'charge',
        amount: capturedAmountCents(intent),
        currency: intent.currency,
        description: 'Booking payment confirmed by Stripe webhook',
        paymentIntent: String(intent.id),
        status: 'completed',
        customer: meta.userId,
        expert: expertId,
        groupChat: meta.groupChatId,
    });
    return 'recorded';
};

const acceptIndividualAppointment = async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { groupChatId, payment_intent } = req.body;
        // Only the expert's side of this endpoint carries a note; a student paying
        // for a proposed session has nothing to tell the expert here.
        const decisionNote = role === 'customer' ? '' : sanitizeDecisionNote(req.body.note);

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Session no longer exists");
            return res.status(404).send("Sorry, the group chat doesn't exist");
        }

        if (role !== 'customer' && String(groupChat.createdBy) === String(userId)) {
            return res.status(403).send("The student must accept and pay for a session you proposed.");
        }

        // Only someone already on the session may accept it — otherwise any account
        // could pay to activate a stranger's proposed appointment.
        if (!groupMemberIds(groupChat).includes(String(userId))) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Not a participant of this session");
            return res.status(403).send("This session is not yours to accept.");
        }

        if (groupChat.status === 'cancelled') {
            await releaseOrphanBookingIntent(payment_intent, userId, "Session was cancelled");
            return res.status(400).send("This session has been cancelled.");
        }

        if (groupChat.status === 'active') {
            await releaseOrphanBookingIntent(payment_intent, userId, "Session is already confirmed");
            return res.status(409).send(role === 'customer'
                ? "This session has already been confirmed and paid for. You have not been charged again."
                : "This session has already been confirmed.");
        }

        if (role === 'customer') {
            const alreadyPaid = await PaymentHistory.exists({
                groupChat: String(groupChat._id),
                paymentType: 'charge',
                status: { $in: ['completed', 'pending', 'withheld'] },
            });
            if (alreadyPaid) {
                await releaseOrphanBookingIntent(payment_intent, userId, "Session is already paid for");
                return res.status(409).send("This session has already been confirmed and paid for. You have not been charged again.");
            }
        }

        const startMs = groupChat.start ? new Date(groupChat.start).getTime() : 0;
        if (startMs && startMs <= Date.now()) {
            await releaseOrphanBookingIntent(payment_intent, userId, "Session start time has passed");
            return res.status(400).send("This session's start time has already passed, so it can no longer be confirmed. You have not been charged.");
        }

        let charge: any = null;
        let held = false;
        let settling = false;
        let payer: any = null;
        let expertUser: any = null;
        let parkedRow: any = null;
        let intentId = payment_intent;
        if (role !== 'customer') {
            parkedRow = await findParkedHold(groupChat._id);
            if (parkedRow) {
                if (holdHasLapsed(groupChat.decisionDeadline)) {
                    return res.status(409).send("The time to decide on this request has passed and the student's payment authorization has been released. They will need to book again.");
                }
                payer = await User.findById(String(parkedRow.customer));
                expertUser = await User.findById(groupChat.admin.toString());
                intentId = parkedRow.paymentIntent;
                charge = {
                    paidBy: parkedRow.stripeMode,
                    amount: parkedRow.amount,
                    currency: parkedRow.currency,
                };
                held = true;
            }

            // A wallet booking holds no funds, so accepting it does not confirm the
            // session — it opens the student's window to pay, and the session stays
            // pending until they do.
            if (!parkedRow && isWallet(groupChat.paymentMode) && dollarsToCents(groupChat.price) > 0) {
                if (groupChat.paymentDeadline) {
                    return res.status(409).send("You have already accepted this request. It is waiting for the student to pay.");
                }
                const appState = await AppState.findOne();
                const deadline = paymentWindowDeadline({
                    sessionStartMs: groupChat.start ? new Date(groupChat.start).getTime() : 0,
                    windowHours: paymentWindowHours(appState),
                });
                const accepted = await GroupChat.findOneAndUpdate(
                    { _id: groupChat._id, status: 'pending', paymentDeadline: null },
                    {
                        $set: {
                            paymentDeadline: deadline,
                            ...(decisionNote
                                ? { decisionNote, decisionNoteAt: new Date(), decisionNoteReadAt: null }
                                : {}),
                        },
                    },
                    { new: true },
                );
                if (!accepted) {
                    return res.status(409).send("This request has already been decided.");
                }

                const student = await User.findById(String(groupChat.createdBy));
                if (student?.email) {
                    try {
                        await sendSeminarEmail(
                            student.email,
                            `Accepted — pay to confirm "${groupChat.name}"`,
                            `<h2 style="color:#28a745;margin-top:0;">Your session was accepted</h2>
                             <p>Good news — your request for "<strong>${groupChat.name}</strong>" was accepted.
                                To confirm it, please pay <strong>$${Number(groupChat.price || 0).toFixed(2)}</strong>
                                with WeChat Pay or Alipay from your dashboard by
                                <strong>${deadline.toLocaleString()}</strong>.</p>
                             <p>The slot is released if payment isn't completed by then.</p>
                             ${decisionNoteEmailBlock(decisionNote)}`,
                        );
                    } catch (emailErr) {
                        console.log('[acceptIndividualAppointment] wallet pay-now email failed', emailErr);
                    }
                }

                return res.status(200).json({
                    success: true,
                    status: 'awaiting_payment',
                    paymentDeadline: deadline,
                });
            }
        }
        if (role === 'customer') {
            payer = await User.findById(userId);
            expertUser = await User.findById(groupChat.admin.toString());

            const expectedCents = dollarsToCents(groupChat.price);

            // Paying a wallet booking is only possible in the window the expert's
            // acceptance opened — before that there is no sale, after it the slot is gone.
            if (isWallet(groupChat.paymentMode) && expectedCents > 0 && !groupChat.paymentDeadline) {
                return res.status(409).send(WALLET_NOT_YET_PAYABLE);
            }
            // An expert's offer carries its own window from the moment it is made, so a
            // lapsed deadline closes the sale whichever rail it was going to settle on.
            if (expectedCents > 0 && paymentWindowLapsed(groupChat.paymentDeadline)) {
                return res.status(410).send("The payment window for this session has closed, so it has been released. Please book again if you still want it.");
            }
            if (expectedCents > 0 && await paymentIntentAlreadyConsumed(payment_intent)) {
                return res.status(409).send("This payment has already been used for a booking.");
            }
            const payment = await resolveBookingPayment({
                payment_intent,
                expectedCents,
                boundTo: { userId: String(userId), groupChatId: String(groupChat._id) },
                name: groupChat.name,
                customer: payer,
                expert: expertUser,
                groupChatId,
            });
            if (!payment.ok) {
                return res.status(payment.code).send(payment.message);
            }
            charge = payment.charge;
            held = !!payment.held;
            settling = !!payment.settling;
        }

        // Activate the session before capturing — a held payment is released rather
        // than refunded if activation fails, so the student is never charged for it.
        const previousStatus = groupChat.status;
        try {
            const activated = await GroupChat.findOneAndUpdate(
                { _id: groupChat._id, status: { $ne: 'cancelled' } },
                { $set: decisionNote ? { status: 'active', decisionNote, decisionNoteAt: new Date(), decisionNoteReadAt: null } : { status: 'active' } },
            );
            if (!activated) {
                if (charge && held) {
                    await cancelPaymentIntent(intentId, charge.paidBy);
                    if (parkedRow) {
                        await PaymentHistory.findByIdAndUpdate(parkedRow._id, {
                            status: 'released',
                            description: `Hold released — session cancelled: ${groupChat.name}`,
                        }).catch(() => null);
                    }
                    return res.status(409).send("This session was cancelled while your payment was being processed. Your payment hold has been released and you were not charged.");
                }
                if (charge) {
                    await refundBookingCharge({
                        payment_intent,
                        charge,
                        name: groupChat.name,
                        customer: payer,
                        expert: expertUser,
                        groupChatId,
                        reason: 'Session was cancelled during payment',
                    });
                }
                return res.status(409).send("This session was cancelled while your payment was being processed. Any payment has been refunded.");
            }
            groupChat.status = 'active';
        } catch (activateErr) {
            if (charge && held) {
                await cancelPaymentIntent(intentId, charge.paidBy);
            } else if (charge) {
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

        let pendingPaymentId: any = null;
        if (charge && held) {
            const restore = async () => {
                await GroupChat.updateOne(
                    { _id: groupChat._id, status: 'active' },
                    { $set: { status: previousStatus } },
                ).catch(() => null);
                groupChat.status = previousStatus;
            };

            if (parkedRow) {
                const captured = await captureParkedHold({ payment_intent: intentId, stripeMode: charge.paidBy });
                if (!captured.ok) {
                    await restore();
                    await PaymentHistory.findByIdAndUpdate(parkedRow._id, {
                        status: 'failed',
                        description: `Hold could not be captured on approval: ${groupChat.name}`,
                    }).catch(() => null);
                    return res.status(502).send(captured.message);
                }
                charge = captured.charge;
                pendingPaymentId = parkedRow._id;
            } else {
                const captured = await captureBookingHold({
                    payment_intent: intentId,
                    charge,
                    customer: payer,
                    expert: expertUser,
                    groupChat,
                    description: groupChat.name,
                });
                if (!captured.ok) {
                    await restore();
                    return res.status(captured.duplicate ? 409 : 502).send(captured.message);
                }
                charge = captured.charge;
                pendingPaymentId = captured.pendingPaymentId;
            }
            held = false;
        }

        // Record the charge + receipt only once the session is actually active.
        if (charge) {
            if (pendingPaymentId) {
                await PaymentHistory.findByIdAndUpdate(pendingPaymentId, {
                    status: 'completed',
                    description: groupChat.name,
                    amount: charge.amount,
                    currency: charge.currency,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                }).catch((historyErr: any) => {
                    console.error('[acceptIndividualAppointment] captured payment left pending — reconcile manually', payment_intent, historyErr?.message);
                });
            } else {
                await appendPaymentHistory({
                    stripeMode: charge.paidBy,
                    paymentType: 'charge',
                    amount: charge.amount,
                    currency: charge.currency,
                    description: settling ? `Wallet payment clearing: ${groupChat.name}` : groupChat.name,
                    paymentIntent: payment_intent,
                    receiptUrl: charge.receiptUrl,
                    receiptNumber: charge.receiptNumber,
                    // Money still in flight is not revenue yet; the webhook settles it.
                    status: settling ? 'pending' : 'completed',
                    customer: String(userId),
                    expert: groupChat.admin.toString(),
                    groupChat: groupChatId,
                })
            }

            // No receipt exists until the wallet payment actually lands.
            if (!settling) {
                await sendBookingReceiptAndConfirmation({
                    payment_intent: intentId,
                    charge,
                    sessionType: '1:1 Session',
                    sessionName: groupChat.name,
                    expertName: expertUser?.username,
                    studentName: payer?.username,
                    studentEmail: payer?.email,
                    start: groupChat.start,
                    duration: groupChat.duration,
                    timeZone: payer?.timeZone,
                    noteHtml: decisionNoteEmailBlock(decisionNote),
                });
            }
        }

        res.status(200).send("Group chat accepted successfully!");

        void (async () => {
            try {
                const expertUser = await User.findById(userId);
                const customerUser = await User.findById(groupChat.createdBy);
                if (customerUser?.email && !charge) {
                    await sendEmailMeetingAcceptance(
                        customerUser.email,
                        customerUser.username,
                        groupChat.name,
                        groupChat.start,
                        groupChat.duration,
                        customerUser.timeZone,
                        decisionNoteEmailBlock(decisionNote),
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
        const { groupChatId, scope } = req.body;

        const groupChat = await GroupChat.findOne({ _id: String(groupChatId) });

        if (!groupChat) {
            throw new Error("Sorry, the group chat doesn't exist");
        }

        if (String(groupChat.admin) !== String(userId)) {
            throw new Error("Forbidden. Only group admins can delete a group.");
        }

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

        const groupChats =
            scope === 'occurrence' ? [groupChat] : seriesDocs;

        const deleteIds = groupChats.map((g: any) => g._id.toString());

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
        if (!groupMemberIds(groupChat).includes(String(userId))) {
            return res.status(403).send("This session is not yours to cancel.");
        }

        const expertId = String(groupChat.admin);
        const cancelledByExpert = expertId === String(userId);
        const expertProposed = String(groupChat.createdBy) === expertId;
        const paidSessionMessage = "The student has already paid for this session, so it can no longer be cancelled here. Please contact an admin.";

        // An expert turning down a student's request must say something the student
        // can act on — that note is the whole point of the decline flow. Withdrawing
        // one's own unpaid offer is not a rejection, so a note stays optional there.
        const decisionNote = cancelledByExpert ? sanitizeDecisionNote(req.body.note) : '';
        // A student turning down an offer owes no explanation, but if they leave one it
        // is the only thing the expert learns from the decline.
        const studentNote = !cancelledByExpert && expertProposed ? sanitizeDecisionNote(req.body.note) : '';
        const decliningStudentRequest = cancelledByExpert && !expertProposed;
        if (decliningStudentRequest && !decisionNote) {
            return res.status(400).send("Please add a short note for the student explaining the decline.");
        }

        if (groupChat.status !== 'pending') {
            if (expertProposed && cancelledByExpert && groupChat.status === 'active') {
                return res.status(409).send(paidSessionMessage);
            }
            throw new Error("Sorry, the group chat is not in pending status");
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            throw new Error("User not found");
        }

        const claimed = await GroupChat.findOneAndUpdate(
            { _id: groupChat._id, status: 'pending' },
            { $set: decisionNote ? { status: 'cancelled', decisionNote, decisionNoteAt: new Date(), decisionNoteReadAt: null } : { status: 'cancelled' } },
        );
        if (!claimed) {
            return res.status(409).send("This session has already been updated. Please refresh and try again.");
        }
        const restorePending = async () => {
            await GroupChat.updateOne(
                { _id: groupChat._id, status: 'cancelled' },
                { $set: { status: 'pending' } },
            ).catch(() => null);
        };

        const parked = await findParkedHold(groupChatId);
        const payment = await PaymentHistory.findOne({
            groupChat: String(groupChatId),
            paymentType: 'charge',
            status: { $in: ['completed', 'pending'] },
        });

        if (payment && expertProposed && cancelledByExpert) {
            await restorePending();
            return res.status(409).send(paidSessionMessage);
        }
        if (payment && payment.status === 'pending') {
            await restorePending();
            return res.status(409).send("This payment is still being processed. Please try again in a moment.");
        }

        const studentId = groupMemberIds(groupChat).find((id: string) => id !== expertId) || String(groupChat.createdBy);
        const student = await User.findById(studentId);
        const sessionName = groupChat.name || '1:1 session';
        const startLabel = groupChat.start ? new Date(groupChat.start).toLocaleString() : '';
        const declinedProposal = expertProposed && !cancelledByExpert;

        const noteBlock = decisionNoteEmailBlock(decisionNote);
        // The note is the only channel the student has once the cancelled session
        // drops off their dashboard, so every expert-side decline sends mail even
        // when there was no payment to refund.
        let studentNotified = false;

        let refundMessage = '';
        if (parked) {
            const outcome = await releaseParkedHold(parked);
            if (outcome === 'stuck') {
                await restorePending();
                return res.status(502).send("We couldn't release the student's payment authorization, so the session was not declined. Please try again or contact support.");
            }

            if (outcome === 'refunded') {
                await appendPaymentHistory({
                    stripeMode: parked.stripeMode,
                    amount: parked.amount,
                    currency: parked.currency,
                    description: `Refund — session request declined: ${sessionName}`,
                    customer: parked.customer,
                    expert: parked.expert,
                    groupChat: parked.groupChat,
                    paymentType: 'refund',
                    paymentIntent: parked.paymentIntent,
                    status: 'refunded',
                });
                await PaymentHistory.findByIdAndUpdate(parked._id, {
                    status: 'refunded',
                    description: `Refund — session request declined: ${sessionName}`,
                });
                refundMessage = ' The payment has been refunded in full.';
            } else {
                await PaymentHistory.findByIdAndUpdate(parked._id, {
                    status: 'released',
                    description: `Hold released — session request declined: ${sessionName}`,
                });
                refundMessage = ' The payment authorization has been released.';
            }

            if (student?.email) {
                await sendSeminarEmail(
                    student.email,
                    `Appointment Request Declined — ${sessionName}`,
                    `<h2 style="color:#007bff;margin-top:0;">Appointment Request Declined</h2>
                     <p>We regret to inform you that the expert has declined your 1:1 session request.
                        ${outcome === 'refunded'
                            ? 'Your payment has been refunded in full and will appear on your original payment method within 5–10 business days.'
                            : 'Your payment authorization has been released, and no payment has been processed. No further action is required on your part.'}</p>
                     <p>Thank you for using WisdomLinked. We hope you find another expert who meets your needs.</p>
                     ${noteBlock}`,
                );
                studentNotified = true;
            }
        } else if (payment && payment.paymentIntent) {
            const alreadyRefunded = await PaymentHistory.exists({
                paymentIntent: payment.paymentIntent,
                paymentType: 'refund',
            });
            if (!alreadyRefunded) {
                const refund = await refundPaymentIntent(payment.paymentIntent, payment.amount, payment.stripeMode)
                if (!refund) {
                    await restorePending();
                    return res.status(502).send("We couldn't refund the payment, so the session was not cancelled. Please try again or contact support.");
                }
                await appendPaymentHistory({
                    stripeMode: payment.stripeMode,
                    amount: payment.amount,
                    currency: payment.currency,
                    description: payment.description,
                    customer: payment.customer,
                    expert: payment.expert,
                    groupChat: payment.groupChat,
                    event: payment.event,
                    paymentType: 'refund',
                    paymentIntent: refund.payment_intent,
                    status: 'refunded',
                })
                await PaymentHistory.findByIdAndUpdate(payment._id, { status: 'refunded' });
                refundMessage = ' The payment has been refunded in full.';
                if (student?.email) {
                    await sendSeminarEmail(
                        student.email,
                        `Session cancelled — ${sessionName}`,
                        `<h2 style="color:#007bff;margin-top:0;">Your session was cancelled</h2>
                         <p>"<strong>${sessionName}</strong>" has been cancelled${cancelledByExpert ? ' by the expert' : ''}.</p>
                         <p>Your payment of $${(Number(payment.amount || 0) / 100).toFixed(2)} has been refunded in full and will
                            appear on your original payment method within 5–10 business days.</p>
                         ${noteBlock}`,
                    );
                    studentNotified = true;
                }
            }
        } else if (expertProposed && cancelledByExpert && student?.email) {
            await sendSeminarEmail(
                student.email,
                `Session offer withdrawn — ${sessionName}`,
                `<h2 style="color:#007bff;margin-top:0;">This session offer was withdrawn</h2>
                 <p>The expert has withdrawn the proposed session "<strong>${sessionName}</strong>" before it was paid for.</p>
                 <p>You have not been charged. You can book another time from the expert's profile.</p>
                 ${noteBlock}`,
            );
            studentNotified = true;
        }

        if (decliningStudentRequest && !studentNotified && student?.email) {
            await sendSeminarEmail(
                student.email,
                `Session request declined — ${sessionName}`,
                `<h2 style="color:#007bff;margin-top:0;">Your session request was declined</h2>
                 <p>The expert could not take "<strong>${sessionName}</strong>" at the time you requested.
                    You have not been charged.</p>
                 ${noteBlock}`,
            );
        }

        if (declinedProposal) {
            const expert = await User.findById(expertId);
            if (expert?.email) {
                await sendSeminarEmail(
                    expert.email,
                    `Session offer declined — ${sessionName}`,
                    `<h2 style="color:#007bff;margin-top:0;">Your session offer was declined</h2>
                     <p>${student?.username || 'The student'} declined the session you proposed,
                        "<strong>${sessionName}</strong>"${startLabel ? ` on ${startLabel}` : ''}.
                        Nothing was charged and the time is free again.</p>
                     ${decisionNoteEmailBlock(studentNote, 'Message from the student')}`,
                );
            }
        }

        for (const participantId of groupChat.participants) {
            await User.updateOne(
                { _id: String(participantId) },
                { $pull: { groupChats: groupChat._id } },
            );
        }

        const cancelledLabel = expertProposed && cancelledByExpert
            ? "The session offer has been withdrawn."
            : declinedProposal
                ? "The session offer has been declined."
                : "Your appointment has been canceled!";
        return res.status(200).send(`${cancelledLabel}${refundMessage}`);
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
        if (groupChat.type !== 'seminar') {
            return res.status(400).send("This group is not a seminar.");
        }

        const seriesFilter: any = groupChat.seriesId
            ? { $or: [{ _id: groupChat._id }, { seriesId: groupChat.seriesId, type: 'seminar' }] }
            : { _id: groupChat._id };
        const occurrences = await GroupChat.find(seriesFilter);
        const occurrenceIds = occurrences.map((o: any) => o._id);

        const enrolledOccurrences = occurrences.filter((o: any) =>
            (o.participants || []).some((p: any) => p.toString() === String(userId)),
        );
        if (!enrolledOccurrences.length) {
            return res.status(403).send("You are not enrolled in this seminar.");
        }

        const now = Date.now();
        const enrolledStartTimes = enrolledOccurrences
            .map((o: any) => (o.start ? new Date(o.start).getTime() : 0))
            .filter((ms: number) => ms > 0);
        const hasFutureSession = enrolledOccurrences.some((o: any) => o.start && new Date(o.start).getTime() > now);
        if (!hasFutureSession) {
            throw new Error("Unable to leave a seminar that has already finished.");
        }

        const earliestEnrolledStart = enrolledStartTimes.length ? Math.min(...enrolledStartTimes) : 0;
        const seriesStarted = earliestEnrolledStart > 0 && earliestEnrolledStart <= now;

        const payment = await PaymentHistory.findOne({
            groupChat: { $in: occurrenceIds },
            customer: userId,
            paymentType: 'charge',
            status: 'completed',
        }).sort({ createdAt: -1 });

        let refundMessage = '';
        if (seriesStarted) {
            refundMessage = ' Because the seminar has already begun, this cancellation is not eligible for an automatic refund.';
        } else if (payment && payment.paymentIntent) {
            const alreadyRefunded = await PaymentHistory.exists({
                paymentIntent: payment.paymentIntent,
                paymentType: 'refund',
            });
            if (!alreadyRefunded) {
                const refundCents = voluntaryCancellationRefundCents(payment.amount);
                if (refundCents > 0) {
                    const refund = await refundPaymentIntent(payment.paymentIntent, refundCents, payment.stripeMode);
                    if (!refund) {
                        return res.status(502).send("We couldn't refund your seminar payment, so you're still enrolled. Please try again or contact support.");
                    }
                    await appendPaymentHistory({
                        stripeMode: payment.stripeMode,
                        amount: refundCents,
                        currency: payment.currency,
                        description: payment.description,
                        customer: payment.customer,
                        expert: payment.expert,
                        pendingAppointmentToGroup: payment.pendingAppointmentToGroup,
                        groupChat: payment.groupChat,
                        event: payment.event,
                        paymentType: 'refund',
                        paymentIntent: refund.payment_intent,
                        status: 'refunded',
                    });
                    await PaymentHistory.findByIdAndUpdate(payment._id, { status: 'refunded' });
                    refundMessage = refundCents < Number(payment.amount || 0)
                        ? ` You have been refunded $${(refundCents / 100).toFixed(2)}; a payment-processing fee was retained.`
                        : ' Your payment has been refunded.';
                }
            }
        }

        await unenrollSeminarSeries(groupChat, String(userId));

        return res.status(200).send(`You have left the seminar.${refundMessage}`);
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
    paySeminarSeatRequest,
    getSeminarSeatRequests,
    getMySeatRequests,
    getMyDecisionNotices,
    markDecisionNoticeRead,
    sweepExpiredSeatRequests,
    sweepExpiredSessionHolds,
    sweepExpiredWalletPayments,
    sweepExpiredProposedSessions,
    sweepPendingSeminarPayments,
    sweepOrphanedBookingIntents,
    handleBookingPaymentIntentEvent,
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
