import { Request, Response } from 'express';
import { safeErrorMessage } from '../utils/httpUserFacingCopy';
import { resolveFeedbackMeetingKind, toLookupIds, isLookupId } from '../utils/feedbackMeetingKind';
import {
    createdAtFilter,
    clampPage,
    clampPageSize,
    emptyPeriodCounts,
    heldStartFilter,
    oneToOneGroupFilter,
    parseDateParam,
    periodChange,
    resolveSnapshotRange,
    seminarBaseFilter,
    startInRangeFilter,
    statusListFilter,
    upcomingStartFilter,
} from '../utils/adminSnapshot';
import {
    computeMonthlyBreakdown,
    computePeriodSnapshot,
    computeSnapshotExtras,
} from '../utils/adminSnapshotStats';
import {
    checkSeat,
    markRefundedCharges,
    sessionHasEnded,
    summarizeVerdicts,
    recordCountsByStatus,
    RECORD_COUNT_STATUSES,
    BookingPaymentVerdict,
} from '../utils/paymentIntegrity';
const escapeRegExp = (value: unknown) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const { uploadFileToS3, getArrayField } = require("./auth.controller")
const {
    renderEmail: renderAdminEmail,
    paragraph: adminParagraph,
    facts: adminFacts,
    button: adminButton,
    callout: adminCallout,
    escapeHtml: adminEscape,
    emailAttachments: adminAttachments,
} = require('../services/emailTemplate');
const User = require("../models/User");
const Event = require("../models/Event");
const PaymentHistory = require("../models/PaymentHistory");
const Conversation = require("../models/Conversation");
const GroupChat = require("../models/GroupChat");
const Keyword = require("../models/Keyword");
const MajorConsolidation = require("../models/MajorConsolidation");
const AdminAuditLog = require("../models/AdminAuditLog");
const { classifyMajors } = require("../utils/majorClassification");
const { isBaselineMajor } = require("../constants/majorOptions");
const ContactedUs = require("../models/ContactedUs");
const PendingUser = require("../models/PendingUser");
const PendingLogin = require("../models/PendingLogin");
const chatBotQA = require("../models/chatBotQA");
const { logAdminAction } = require("../utils/adminAudit");
const {
    assertPendingSignupCanCreateAccount,
    recordSignupAcceptance,
} = require("../services/termsAgreement");
const { authCookieOptions, clearAuthCookieOptions } = require("../config/authCookie");
const { readAccessToken } = require("../middlewares/requireAuth");
const jwt = require("jsonwebtoken");

function startOfDayLocal(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDayLocal(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

/** Overlap calendar day & not yet ended (still “upcoming” for today). */
function buildTodayUpcomingTimeFilter() {
    const now = new Date();
    const sod = startOfDayLocal(now);
    const eod = endOfDayLocal(now);
    return {
        $and: [{ start: { $lte: eod } }, { end: { $gte: sod } }, { end: { $gte: now } }],
    };
}

function buildScopeTimeFilter(scope: string) {
    const now = new Date();
    const sod = startOfDayLocal(now);
    const eod = endOfDayLocal(now);
    if (scope === "today") {
        return buildTodayUpcomingTimeFilter();
    }
    if (scope === "upcoming") {
        return { end: { $gte: now } };
    }
    if (scope === "past") {
        return { end: { $lt: now } };
    }
    return null;
}

async function countTodayUpcomingEvents() {
    const q = buildTodayUpcomingTimeFilter();
    const [e, g] = await Promise.all([
        Event.countDocuments(q),
        GroupChat.countDocuments({
            $and: [q, { type: { $in: ["seminar", "individual"] } }],
        }),
    ]);
    return e + g;
}
const sgMail = require("@sendgrid/mail");
const adminEmail = "admin@wisdomlinked.com";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const nodemailer = require("nodemailer");

const { getFullUserData } = require('../middlewares/requireAuth')
const { checkTitleNameInvalid } = require("../services/global");
const { sendEmailUserAccountApproved } = require("../services/notifications");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const filterUsers = async (req, res) => {
    try {
        const { username, email, role, status, sortBy, sortOrder, numPerPage, currentPage, includeAdmins, dateFrom, dateTo, q } = req.body
        const roleFilter = role ? String(role) : "";
        const allowAdmins = Boolean(includeAdmins) || roleFilter === "admin";
        const baseFilter = allowAdmins ? {} : { role: { $ne: "admin" } };
        let query = User.find(baseFilter)
        let countQuery = User.countDocuments(baseFilter)

        if (username) {
            query.where({ username: { '$regex': escapeRegExp(username), '$options': 'i' } })
            countQuery.where({ username: { '$regex': escapeRegExp(username), '$options': 'i' } })
        }
        if (email) {
            query.where({ email: { '$regex': escapeRegExp(email), '$options': 'i' } })
            countQuery.where({ email: { '$regex': escapeRegExp(email), '$options': 'i' } })
        }
        if (roleFilter) {
            query.where({ role: roleFilter })
            countQuery.where({ role: roleFilter })
        }
        if (status) {
            query.where({ status: String(status) })
            countQuery.where({ status: String(status) })
        }

        const search = String(q || "").trim();
        if (search) {
            const rx = { $regex: escapeRegExp(search), $options: "i" };
            const searchOr = { $or: [{ username: rx }, { email: rx }, { title: rx }] };
            query.where(searchOr);
            countQuery.where(searchOr);
        }

        if (dateFrom || dateTo) {
            const createdRange = createdAtFilter(parseDateParam(dateFrom), parseDateParam(dateTo));
            query.where(createdRange);
            countQuery.where(createdRange);
        }

        // Dynamic sorting based on `sortBy` and `sortOrder`
        const sortField = sortBy || "createdAt";
        const sortOrderValue = sortOrder === "DESC" ? -1 : 1;
        query.sort({ [sortField]: sortOrderValue });

        const pageSize = clampPageSize(numPerPage);
        const page = clampPage(currentPage);
        query.skip(pageSize * page).limit(pageSize)
        const totalCount = await countQuery.exec()
        const users = await query.exec();
        return res.status(200).json({
            result: users,
            totalCount: totalCount
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const filterPaymentHistories = async (req, res) => {
    try {
        const { email, stripeMode, paymentType, status, dateFrom, dateTo, numPerPage, currentPage, q, bookingScope, excludeRefunds } = req.body
        const query = PaymentHistory.find()
        const countQuery = PaymentHistory.countDocuments()

        if (email) {
            const user = await User.findOne({ email: String(email) })
            if (!user) {
                return res.status(200).json({
                    result: [],
                    totalCount: 0
                })
            }
            query.where({ [user.role]: user._id.toString() })
            countQuery.where({ [user.role]: user._id.toString() })
        }

        query.populate([
            { path: 'expert', select: 'username email role' },
            { path: 'customer', select: 'username email role' },
            { path: 'groupChat', select: 'type name status start end seriesId' },
            { path: 'event', select: 'start end title status' },
        ])

        if (stripeMode) {
            query.where({ stripeMode: String(stripeMode) })
            countQuery.where({ stripeMode: String(stripeMode) })
        }

        if (paymentType) {
            query.where({ paymentType: String(paymentType) })
            countQuery.where({ paymentType: String(paymentType) })
        } else if (excludeRefunds) {
            query.where({ paymentType: { $ne: 'refund' } })
            countQuery.where({ paymentType: { $ne: 'refund' } })
        }

        if (status) {
            query.where({ status: String(status) })
            countQuery.where({ status: String(status) })
        }

        const search = String(q || "").trim();
        if (search) {
            const rx = { $regex: escapeRegExp(search), $options: "i" };
            query.where({ description: rx });
            countQuery.where({ description: rx });
        }

        const scope = String(bookingScope || "");
        const now = new Date();
        const pageSize = clampPageSize(numPerPage);
        const page = clampPage(currentPage);

        if (scope === "past" || scope === "upcoming") {
            const startMatch = scope === "upcoming"
                ? upcomingStartFilter(now)
                : heldStartFilter(parseDateParam(dateFrom), parseDateParam(dateTo), now);
            const [gcDocs, evDocs] = await Promise.all([
                GroupChat.find(startMatch).select("_id start").lean(),
                Event.find(startMatch).select("_id start").lean(),
            ]);
            const startByGc = new Map(gcDocs.map((g: any) => [String(g._id), g.start]));
            const startByEv = new Map(evDocs.map((e: any) => [String(e._id), e.start]));
            const bookingOr = {
                $or: [
                    { groupChat: { $in: [...startByGc.keys()] } },
                    { event: { $in: [...startByEv.keys()] } },
                ],
            };
            query.where(bookingOr);
            const leanRows = await PaymentHistory.find(query.getFilter())
                .select("groupChat event")
                .lean();
            const dir = scope === "upcoming" ? 1 : -1;
            leanRows.sort((a: any, b: any) => {
                const ta = new Date(
                    startByGc.get(String(a.groupChat)) || startByEv.get(String(a.event)) || 0,
                ).getTime();
                const tb = new Date(
                    startByGc.get(String(b.groupChat)) || startByEv.get(String(b.event)) || 0,
                ).getTime();
                return dir * (ta - tb);
            });
            const totalCount = leanRows.length;
            const pageIds = leanRows.slice(pageSize * page, pageSize * page + pageSize).map((row: any) => row._id);
            const histories = pageIds.length
                ? await PaymentHistory.find({ _id: { $in: pageIds } }).populate([
                    { path: "expert", select: "username email role" },
                    { path: "customer", select: "username email role" },
                    { path: "groupChat", select: "type name status start end seriesId" },
                    { path: "event", select: "start end title status" },
                ])
                : [];
            const byId = new Map(histories.map((row: any) => [String(row._id), row]));
            return res.status(200).json({
                result: pageIds.map((id: any) => byId.get(String(id))).filter(Boolean),
                totalCount,
            });
        }

        if (dateFrom) {
            query.where({ createdAt: { $gt: new Date(dateFrom) } })
            countQuery.where({ createdAt: { $gt: new Date(dateFrom) } })
        }

        if (dateTo) {
            query.where({ createdAt: { $lt: new Date(dateTo) } })
            countQuery.where({ createdAt: { $lt: new Date(dateTo) } })
        }

        query.sort({ createdAt: -1 })
        query.skip(pageSize * page).limit(pageSize)
        const totalCount = await countQuery.exec()
        const histories = await query.exec();
        return res.status(200).json({
            result: histories,
            totalCount: totalCount
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getFullUserDataByEmail = async (req, res) => {
    try {
        const { email } = req.body
        const user = await getFullUserData(email)
        return res.status(200).json({
            result: user
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const updateProfileOfUser = async (req, res) => {
    try {
        const { email, username, title, description, image, keywords, services, country, state, city, phoneNumber, price, joinPopupBlocked, status, specialNote } = req.body;
        const updates: Record<string, any> = {}
        if (username) {
            updates.username = username
        }
        if (title) {
            updates.title = title
        }
        if (description) {
            updates.description = description
        }
        if (image) {
            updates.image = image
        }
        if (services) {
            updates.services = services
        }
        if (price) {
            updates.price = price
        }
        if (status) {
            updates.status = status
        }
        if (keywords) {
            const { officialIds, customValues } = await classifyMajors(keywords)
            updates.keywords = officialIds
            updates.customKeywords = customValues
        }
        if (country) {
            updates.country = country
        }
        if (state) {
            updates.state = state
        }
        if (city) {
            updates.city = city
        }
        if (phoneNumber) {
            updates.phoneNumber = phoneNumber
        }
        if (joinPopupBlocked) {
            updates.joinPopupBlocked = joinPopupBlocked
        }
        if (specialNote !== undefined && specialNote !== null) {
            updates.specialNote =
                typeof specialNote === 'string' ? specialNote.slice(0, 5000) : String(specialNote).slice(0, 5000);
        }

        const existing = await User.findOne({ email: String(email) }).select("_id email status role username");
        await User.findOneAndUpdate({ email: String(email) }, updates, { new: true })
        const result = await getFullUserData(email)
        if (status && status === 'active') {
            // If the user is activated, send an email notification
            await sendEmailUserAccountApproved(result.email, result.username);
        }
        if (status && existing && existing.status !== status) {
            logAdminAction({
                actor: req.user,
                action: "user_status_change",
                targetType: "user",
                targetId: existing._id,
                targetEmail: existing.email,
                meta: { from: existing.status, to: status, role: existing.role },
            });
        }
        result.password = null
        result.token = null
        return res.status(200).json({
            result: result,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getDirectChatHistory = async (req, res) => {
    try {
        const { senderId, receiverId, currentPage } = req.body
        let conversation = await Conversation.findOne({
            participants: { $all: [String(receiverId), String(senderId)] },
            type: "DIRECT",
        });
        if (!conversation) {
            return res.status(200).json({
                result: [],
                gotAllChats: true
            });
        }
        conversation = await Conversation.findById(conversation._id.toString()).populate({
            path: "messages",
            model: "Message",
            populate: {
                path: "author",
                select: "username _id image role status",
                model: "User",
            }
        });

        if (!conversation) {
            return res.status(200).json({
                result: [],
                gotAllChats: true
            });
        }

        const limit = 20
        const messages = conversation.messages.reverse().slice(currentPage * limit, (currentPage + 1) * limit)
        const gotAllChats = conversation.messages.length <= (currentPage + 1) * limit

        return res.status(200).json({
            result: messages.reverse(),
            gotAllChats: gotAllChats
        });

    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getGroupChatHistory = async (req, res) => {
    try {
        const { groupChatId, currentPage } = req.body
        const groupChat = await GroupChat.findById(String(groupChatId)).populate({
            path: "messages",
            model: "Message",
            populate: {
                path: "author",
                select: "username _id image role status",
                model: "User"
            }
        });

        if (!groupChat) {
            return res.status(200).json({
                result: [],
                gotAllChats: true
            });
        }

        const limit = 20
        const messages = groupChat.messages.reverse().slice(currentPage * limit, (currentPage + 1) * limit)
        const gotAllChats = groupChat.messages.length <= (currentPage + 1) * limit

        return res.status(200).json({
            result: messages.reverse(),
            gotAllChats: gotAllChats
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getUserFeedbacks = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send("userId is required");
        }
        const user = await User.findById(String(userId));
        if (!user) {
            return res.status(404).send("User not found");
        }

        const feedbacks = user.feedbacks || [];

        const enriched = [];
        for (let i = 0; i < feedbacks.length; i++) {
            const feedback = feedbacks[i];
            let otherUser = null;
            if (isLookupId(feedback.otherUserId)) {
                otherUser = await User.findById(feedback.otherUserId).select("username _id image role email");
            }

            let eventData = null;
            if (isLookupId(feedback.eventId)) {
                eventData = await Event.findById(feedback.eventId).select("title");
            }

            let groupChatData = null;
            if (isLookupId(feedback.groupChatId)) {
                groupChatData = await GroupChat.findById(feedback.groupChatId).select("name type");
            }
            const meeting = resolveFeedbackMeetingKind({
                eventType: feedback.eventType,
                groupChat: groupChatData,
                event: eventData,
                eventId: feedback.eventId,
            });

            enriched.push({
                event: eventData || null,
                groupChat: groupChatData || null,
                eventType: feedback.eventType || null,
                meetingKind: meeting.kind,
                meetingName: meeting.name,
                userEmail: user.email || null,
                userUsername: user.username || null,
                userRole: user.role || null,
                start: feedback.start || null,
                end: feedback.end || null,
                totalTimeSpent: feedback.totalTimeSpent || null,
                rating: feedback.rating || 0,
                description: feedback.description || "",
                date: feedback.date || null,
                otherUserId: feedback.otherUserId || null,
                otherUser: otherUser || null
            });
        }
        return res.status(200).json({ result: enriched });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const getContactedUs = async (req, res) => {
    try {
        const { name, email, dateFrom, dateTo, sortBy, sortOrder, actioned } = req.body;

        let query = ContactedUs.find({});

        if (name) {
            query = query.where("name", new RegExp(escapeRegExp(name), "i"));
        }

        if (email) {
            query = query.where("email", new RegExp(escapeRegExp(email), "i"));
        }

        if (dateFrom && dateTo) {
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
                fromDate.setUTCHours(0, 0, 0, 0);
                toDate.setUTCHours(23, 59, 59, 999);
                if (fromDate <= toDate) {
                    query = query.where("createdAt").gte(fromDate).lte(toDate);
                }
            }
        }

        if (actioned) {
            query = query.where("actioned", String(actioned));
        }

        if (sortBy === "name") {
            query = query.collation({ locale: "en", strength: 2 });
        }

        if (sortBy) {
            const order = sortOrder && sortOrder.toLowerCase() === "desc" ? -1 : 1;
            query = query.sort({ [sortBy]: order });
        }

        const results = await query.exec();

        return res.status(200).json({
            status: "SUCCESS",
            data: results,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const toggleActionedStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const contactEntry = await ContactedUs.findById(String(id));

        if (!contactEntry) {
            return res.status(404).json({ message: "Record not found" });
        }

        contactEntry.actioned = contactEntry.actioned === "Yes" ? "No" : "Yes";
        await contactEntry.save();

        logAdminAction({
            actor: req.user,
            action: "toggle_contact_actioned",
            targetType: "contactedUs",
            targetId: contactEntry._id,
            targetEmail: contactEntry.email,
            meta: { actioned: contactEntry.actioned },
        });

        return res.status(200).json({
            message: "Actioned status updated",
            actioned: contactEntry.actioned
        });
    } catch (error) {
        console.error("Error updating actioned status:", error);
        return res.status(500).json({
            message: "An error occurred while updating actioned status."
        });
    }
};

const sendWelcomeEmail = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: "FAILED",
                message: "Email and password are required."
            });
        }

        const html = renderAdminEmail({
            heading: 'Welcome to WisdomLinked',
            previewText: 'Your account is ready.',
            blocks: [
                adminParagraph('Your account has been registered. You can sign in with the credentials below.'),
                adminFacts([['Email', email], ['Temporary password', password]]),
                adminCallout('Please sign in and change this password as soon as you can — it was sent by email and should not be treated as permanent.', 'warn'),
                adminButton('Sign in'),
            ],
        });

        const msg = {
            to: email,
            from: {
                name: "WisdomLinked Admin",
                email: adminEmail,
            },
            subject: "Welcome to WisdomLinked",
            html,
        };

        try {
            const inlineHeader = adminAttachments();
            if (inlineHeader.length) (msg as any).attachments = inlineHeader;
            const response = await sgMail.send(msg);
            console.log("Welcome email sent via SendGrid:", response[0].statusCode);
        } catch (error) {
            console.error("Error sending welcome email via SendGrid:", error.message);
            throw error;
        }

        return res.status(200).json({
            status: "SUCCESS",
            message: "Welcome email sent successfully."
        });
    } catch (error) {
        console.error("Error sending welcome email:", error);
        return res.status(500).json({
            status: "FAILED",
            message: "An error occurred while sending welcome email."
        });
    }
}

const sendEmailToUser = async (req, res) => {
    try {
        const { email, message, contactId } = req.body;

        if (!email || !message) {
            return res.status(400).json({
                status: "FAILED",
                message: "Email and message are required."
            });
        }

        const html = renderAdminEmail({
            heading: 'A reply to your enquiry',
            blocks: [
                adminParagraph('Thank you for reaching out. Whether you are seeking academic guidance or offering your expertise, we appreciate your interest.'),
                adminParagraph('<strong>Our response:</strong>'),
                adminCallout(adminEscape(message)),
                adminParagraph('If you have any further questions, just reply to this email.'),
            ],
        });

        const msg = {
            to: email,
            from: {
                name: "WisdomLinked Admin",
                email: adminEmail,
            },
            subject: "A reply from WisdomLinked",
            html,
            replyTo: email,
        };

        try {
            const inlineHeader = adminAttachments();
            if (inlineHeader.length) (msg as any).attachments = inlineHeader;
            const response = await sgMail.send(msg);
            console.log("Contact email sent via SendGrid:", response[0].statusCode);
        } catch (error) {
            console.error("Error sending contact email via SendGrid:", error.message);
            throw error;
        }

        let actioned;
        if (contactId) {
            const contactEntry = await ContactedUs.findById(String(contactId));
            if (contactEntry) {
                contactEntry.actioned = "Yes";
                await contactEntry.save();
                actioned = contactEntry.actioned;
                logAdminAction({
                    actor: req.user,
                    action: "contact_email_sent",
                    targetType: "contactedUs",
                    targetId: contactEntry._id,
                    targetEmail: contactEntry.email,
                    meta: { actioned: contactEntry.actioned },
                });
            }
        }

        return res.status(200).json({
            status: "SUCCESS",
            message: "Email sent successfully.",
            ...(actioned ? { actioned } : {}),
        });
    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({
            status: "FAILED",
            message: "An error occurred while sending email."
        });
    }
};

const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const snapshotRange = resolveSnapshotRange(req.query.dateFrom, req.query.dateTo, now);
        const models = { User, Event, GroupChat, PaymentHistory };
        const [
            pendingApprovals,
            pendingEmailVerify,
            unactionedContacts,
            unansweredChatbot,
            expertCount,
            customerCount,
            oneOnOneSessions,
            seminarsHeld,
            totalPaymentRecords,
            refundRecords,
            todayUpcomingEvents,
            rangeCounts,
            previousCounts,
            monthly,
            extras,
        ] = await Promise.all([
            User.countDocuments({ status: "review", role: { $ne: "admin" } }),
            PendingUser.countDocuments(),
            ContactedUs.countDocuments({ actioned: "No" }),
            chatBotQA.countDocuments({
                $or: [
                    { answer: { $exists: false } },
                    { answer: "" },
                    { answer: "Pending answer..." },
                ],
            }),
            User.countDocuments({ role: "expert" }),
            User.countDocuments({ role: "customer" }),
            Promise.all([Event.countDocuments(), GroupChat.countDocuments(oneToOneGroupFilter())])
                .then(([legacy, current]) => legacy + current),
            GroupChat.countDocuments(seminarBaseFilter()),
            PaymentHistory.countDocuments({ paymentType: { $ne: "refund" } }),
            PaymentHistory.countDocuments({ paymentType: "refund" }),
            countTodayUpcomingEvents(),
            computePeriodSnapshot(models, snapshotRange.from, snapshotRange.to, now),
            snapshotRange.isAllTime
                ? Promise.resolve(emptyPeriodCounts())
                : computePeriodSnapshot(
                    models,
                    snapshotRange.previousFrom,
                    snapshotRange.previousTo,
                    now,
                ),
            computeMonthlyBreakdown(models, snapshotRange.from, snapshotRange.to, now),
            computeSnapshotExtras(models, now),
        ]);

        return res.status(200).json({
            status: "SUCCESS",
            data: {
                pendingApprovals,
                pendingEmailVerify,
                newContactMessages: unactionedContacts,
                unansweredChatbotQuestions: unansweredChatbot,
                expertCount,
                customerCount,
                oneOnOneSessions,
                seminarsHeld,
                totalPayments: totalPaymentRecords,
                refundCount: refundRecords,
                todayUpcomingEvents,
                expertReviewCount: extras.expertReviewCount,
                customerBlockedCount: extras.customerBlockedCount,
                upcomingSessions: extras.upcomingSessions,
                upcomingSeminars: extras.upcomingSeminars,
                range: rangeCounts,
                previousRange: snapshotRange.isAllTime ? null : previousCounts,
                change: snapshotRange.isAllTime ? null : periodChange(rangeCounts, previousCounts),
                monthly,
            },
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: safeErrorMessage(err) });
    }
};

function andFilters(parts: unknown[]): Record<string, unknown> {
    const cleaned = parts.filter((p) => p && typeof p === "object" && Object.keys(p as object).length);
    if (!cleaned.length) return {};
    if (cleaned.length === 1) return cleaned[0] as Record<string, unknown>;
    return { $and: cleaned };
}

function mapEventPlatformItem(ev: any) {
    return {
        kind: "booking" as const,
        id: String(ev._id),
        title: ev.title || "1:1 booking",
        start: ev.start,
        end: ev.end,
        status: ev.status,
        expert: ev.expert
            ? {
                id: String(ev.expert._id),
                username: ev.expert.username,
                email: ev.expert.email,
            }
            : null,
        customer: ev.customer
            ? {
                id: String(ev.customer._id),
                username: ev.customer.username,
                email: ev.customer.email,
            }
            : null,
    };
}

function mapGroupChatPlatformItem(g: any, student?: any) {
    const isSeminar = g.type === "seminar";
    const adminUser = g.admin || g.createdBy;
    return {
        kind: isSeminar ? "seminar" as const : "groupOneToOne" as const,
        id: String(g._id),
        title: isSeminar ? `(S) ${g.name || "Seminar"}` : g.name || "1:1 session",
        start: g.start,
        end: g.end,
        status: g.status,
        expert: adminUser
            ? {
                id: String(adminUser._id),
                username: adminUser.username,
                email: adminUser.email,
            }
            : null,
        customer: student
            ? {
                id: String(student._id),
                username: student.username,
                email: student.email,
            }
            : null,
        groupChatType: g.type,
        participantCount: Array.isArray(g.participants) ? g.participants.length : 0,
    };
}

async function oneToOneStudents(gcs: any[]): Promise<Map<string, any>> {
    const studentIdByGc = new Map<string, string>();
    for (const g of gcs) {
        if (g.type !== "individual") continue;
        const expertId = String(g.admin?._id ?? g.admin ?? "");
        const studentId = (g.participants || []).map((id: any) => String(id?._id ?? id)).find((id: string) => id && id !== expertId);
        if (studentId) studentIdByGc.set(String(g._id), studentId);
    }
    if (!studentIdByGc.size) return new Map();
    const students = await User.find({ _id: { $in: [...new Set(studentIdByGc.values())] } }).select("username email").lean();
    const byId = new Map(students.map((u: any) => [String(u._id), u]));
    const out = new Map<string, any>();
    for (const [gcId, studentId] of studentIdByGc) {
        const student = byId.get(studentId);
        if (student) out.set(gcId, student);
    }
    return out;
}

function groupChatTypeFilter(includeSeminar: boolean, includeOneToOne: boolean) {
    if (includeSeminar && includeOneToOne) {
        return { $or: [seminarBaseFilter(), { type: "individual" }] };
    }
    if (includeSeminar) return seminarBaseFilter();
    if (includeOneToOne) return { type: "individual" };
    return null;
}

const getAdminPlatformEvents = async (req: Request, res: Response) => {
    try {
        const scope = (req.query.scope || "upcoming").toString();
        const typesRaw = req.query.types;
        const types = typesRaw
            ? String(typesRaw)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
            : ["event", "seminar", "oneToOne"];

        const timeFilter = buildScopeTimeFilter(scope);
        const sortOrder = scope === "past" ? -1 : 1;
        const page = clampPage(req.query.page);
        const limit = clampPageSize(req.query.limit);
        const skip = page * limit;

        const includeEvent = types.includes("event");
        const includeSeminar = types.includes("seminar");
        const includeOneToOne = types.includes("oneToOne");

        const applyDateRange = scope === "past" || scope === "all";
        const dateFrom = applyDateRange ? parseDateParam(req.query.dateFrom) : null;
        const dateTo = applyDateRange ? parseDateParam(req.query.dateTo) : null;
        const startRange = applyDateRange && (dateFrom || dateTo)
            ? startInRangeFilter(dateFrom, dateTo)
            : null;
        const statusFilter = statusListFilter(req.query.status);
        const search = String(req.query.q || "").trim();
        let eventSearch: Record<string, unknown> | null = null;
        let gcSearch: Record<string, unknown> | null = null;
        if (search) {
            const rx = { $regex: escapeRegExp(search), $options: "i" };
            const people = await User.find({
                $or: [{ username: rx }, { email: rx }],
            }).select("_id");
            const ids = people.map((u: { _id: unknown }) => u._id);
            eventSearch = {
                $or: [{ title: rx }, { expert: { $in: ids } }, { customer: { $in: ids } }],
            };
            gcSearch = {
                $or: [
                    { name: rx },
                    { admin: { $in: ids } },
                    { createdBy: { $in: ids } },
                    { ...oneToOneGroupFilter(), participants: { $in: ids } },
                ],
            };
        }

        const eventQuery = includeEvent
            ? andFilters([timeFilter, startRange, statusFilter, eventSearch])
            : null;
        const gcType = groupChatTypeFilter(includeSeminar, includeOneToOne);
        const gcQuery = gcType
            ? andFilters([timeFilter, startRange, statusFilter, gcSearch, gcType])
            : null;

        const items: any[] = [];
        let totalCount = 0;

        if (eventQuery && !gcQuery) {
            totalCount = await Event.countDocuments(eventQuery);
            const events = await Event.find(eventQuery)
                .populate("expert", "username email")
                .populate("customer", "username email")
                .sort({ start: sortOrder })
                .skip(skip)
                .limit(limit);
            for (const ev of events) items.push(mapEventPlatformItem(ev));
        } else if (gcQuery && !eventQuery) {
            totalCount = await GroupChat.countDocuments(gcQuery);
            const gcs = await GroupChat.find(gcQuery)
                .populate("createdBy", "username email")
                .populate("admin", "username email")
                .sort({ start: sortOrder })
                .skip(skip)
                .limit(limit);
            const students = await oneToOneStudents(gcs);
            for (const g of gcs) items.push(mapGroupChatPlatformItem(g, students.get(String(g._id))));
        } else if (eventQuery && gcQuery) {
            const [eventHeads, gcHeads] = await Promise.all([
                Event.find(eventQuery).select("start").lean(),
                GroupChat.find(gcQuery).select("start type").lean(),
            ]);
            const heads = [
                ...eventHeads.map((e: any) => ({ id: String(e._id), source: "event" as const, start: e.start })),
                ...gcHeads.map((g: any) => ({ id: String(g._id), source: "gc" as const, start: g.start })),
            ];
            heads.sort((a, b) => {
                const ta = new Date(a.start).getTime();
                const tb = new Date(b.start).getTime();
                const na = Number.isNaN(ta) ? 0 : ta;
                const nb = Number.isNaN(tb) ? 0 : tb;
                return sortOrder === 1 ? na - nb : nb - na;
            });
            totalCount = heads.length;
            const pageHeads = heads.slice(skip, skip + limit);
            const eventIds = pageHeads.filter((h) => h.source === "event").map((h) => h.id);
            const gcIds = pageHeads.filter((h) => h.source === "gc").map((h) => h.id);
            const [events, gcs] = await Promise.all([
                eventIds.length
                    ? Event.find({ _id: { $in: eventIds } })
                        .populate("expert", "username email")
                        .populate("customer", "username email")
                    : [],
                gcIds.length
                    ? GroupChat.find({ _id: { $in: gcIds } })
                        .populate("createdBy", "username email")
                        .populate("admin", "username email")
                    : [],
            ]);
            const byId = new Map<string, any>();
            for (const ev of events) byId.set(String(ev._id), mapEventPlatformItem(ev));
            const students = await oneToOneStudents(gcs as any[]);
            for (const g of gcs) byId.set(String(g._id), mapGroupChatPlatformItem(g, students.get(String(g._id))));
            for (const head of pageHeads) {
                const item = byId.get(head.id);
                if (item) items.push(item);
            }
        }

        return res.status(200).json({ status: "SUCCESS", items, totalCount, page, limit });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: safeErrorMessage(err) });
    }
};

const getPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await PendingUser.find();
        return res.status(200).json(pendingUsers);
    } catch (err) {
        return res.status(500).json({ message: safeErrorMessage(err) });
    }
};

const getPendingLogins = async (req, res) => {
    try {
        const pendingLogins = await PendingLogin.find();
        return res.status(200).json(pendingLogins);
    } catch (err) {
        return res.status(500).json({ message: safeErrorMessage(err) });
    }
};

const deletePendingUser = async (req, res) => {
    try {
        const { pendingUserId } = req.body;
        if (!pendingUserId) {
            return res.status(400).json({ message: "pendingUserId is required" });
        }
        const pending = await PendingUser.findById(String(pendingUserId)).select("email username role");
        await PendingUser.findByIdAndDelete(String(pendingUserId));
        logAdminAction({
            actor: req.user,
            action: "delete_pending_user",
            targetType: "pendingUser",
            targetId: pendingUserId,
            targetEmail: pending?.email,
            meta: pending ? { username: pending.username, role: pending.role } : undefined,
        });
        return res.status(200).json({ message: "Pending User deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: safeErrorMessage(err) });
    }
};

const deletePendingLogin = async (req, res) => {
    try {
        const { pendingLoginId } = req.body;
        if (!pendingLoginId) {
            return res.status(400).json({ message: "pendingLoginId is required" });
        }
        await PendingLogin.findByIdAndDelete(String(pendingLoginId));
        return res.status(200).json({ message: "Pending Login deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: safeErrorMessage(err) });
    }
};

const convertPendingUserToUserByAdmin = async (req, res) => {
    try {
        const { pendingUserId } = req.body;
        if (!pendingUserId) {
            return res.status(400).json({ message: "pendingUserId is required" });
        }

        const pendingUser = await PendingUser.findById(String(pendingUserId));
        if (!pendingUser) {
            return res.status(404).json({ message: "Pending User not found" });
        }

        const emailKey = pendingUser.email.toLowerCase();
        const gatedTerms = await assertPendingSignupCanCreateAccount(pendingUser.termsAcceptance);
        if (!gatedTerms.ok) {
            return res.status(400).json({ message: gatedTerms.error });
        }
        // Retry only the user this conversion already created. Do not stamp the
        // signature onto a different account that shares the email.
        let user = null;
        if (gatedTerms.acceptance && pendingUser.createdUserId) {
            user = await User.findById(pendingUser.createdUserId);
            if (!user) {
                return res.status(500).json({ message: safeErrorMessage(new Error('created user missing')) });
            }
        }
        if (!user) {
            const newUser = new User({
                username: pendingUser.username,
                title: pendingUser.title,
                description: pendingUser.description,
                services: pendingUser.services,
                keywords: pendingUser.keywords,
                country: pendingUser.country,
                state: pendingUser.state,
                city: pendingUser.city,
                phoneNumber: pendingUser.phoneNumber,
                email: emailKey,
                password: pendingUser.password,
                resume: pendingUser.resume,
                role: pendingUser.role,
                timeSlots: pendingUser.timeSlots,
                price: pendingUser.price,
                status: "active"
            });
            try {
                user = await newUser.save();
            } catch (saveErr: any) {
                if (saveErr?.code === 11000) {
                    console.error('[convertPendingUserToUserByAdmin] email already registered', emailKey);
                    return res.status(500).json({ message: safeErrorMessage(saveErr) });
                }
                throw saveErr;
            }
            if (gatedTerms.acceptance) {
                pendingUser.createdUserId = user._id;
                await pendingUser.save();
            }
        }

        if (gatedTerms.acceptance) {
            try {
                await recordSignupAcceptance(user._id, gatedTerms.acceptance);
            } catch (acceptErr) {
                console.error('[convertPendingUserToUserByAdmin] terms acceptance', acceptErr);
                return res.status(500).json({ message: safeErrorMessage(acceptErr) });
            }
        }

        await PendingUser.findByIdAndDelete(String(pendingUserId));

        logAdminAction({
            actor: req.user,
            action: "convert_pending_user",
            targetType: "user",
            targetId: user._id,
            targetEmail: user.email,
            meta: { pendingUserId, role: user.role },
        });

        return res.status(200).json({ message: "Pending User converted to a regular User successfully" });
    } catch (err) {
        return res.status(500).json({ message: safeErrorMessage(err) });
    }
};

const registerUserByAdmin = async (req, res) => {
    try {
        // Multipart fields arrive as strings; JSON.parse objects/arrays when needed.
        const safeParse = (val) => {
            if (val === undefined || val === null || val === '') return null;
            if (typeof val !== 'string') return val;
            try {
                return JSON.parse(val);
            } catch {
                return val;
            }
        };

        const role = safeParse(req.body.role);
        const username = safeParse(req.body.username);
        const title = safeParse(req.body.title);
        const description = safeParse(req.body.description);
        const keywords = getArrayField(req, 'keywords') || safeParse(req.body.keywords);
        const services = getArrayField(req, 'services') || safeParse(req.body.services);
        const country = safeParse(req.body.country);
        const state = safeParse(req.body.state);
        const city = safeParse(req.body.city);
        const phoneNumber = safeParse(req.body.phoneNumber);
        const email = safeParse(req.body.email);
        const password = safeParse(req.body.password);
        const timeSlots = safeParse(req.body.timeSlots);
        const sendWelcome = safeParse(req.body.sendWelcome) === true || req.body.sendWelcome === 'true';

        const allowedRoles = new Set(['customer', 'expert', 'admin']);
        if (!role || !allowedRoles.has(String(role))) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid role." });
        }

        if (checkTitleNameInvalid('Username', username)) {
            return res.status(200).json({ status: 'FAIL', error: checkTitleNameInvalid('Username', username) });
        }

        // check if user exists
        const userExists = await User.exists({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(200).json({ status: 'FAIL', error: "E-mail already in use." });
        }

        // check if user exists in pending list
        const userExistsInPending = await PendingUser.exists({ email: email.toLowerCase() });
        if (userExistsInPending) {
            return res.status(200).json({ status: 'FAIL', error: "E-mail already in use in pending list." });
        }

        // Handle uploading a resume if file is present (multer uploadsGeneral → req.file)
        const file = req.file
        let resumeUrl = file ? await uploadFileToS3(file, 'resumes') : '';

        let _keywords = []
        let _customKeywords = []
        if (keywords?.length) {
            const classified = await classifyMajors(keywords)
            _keywords = classified.officialIds
            _customKeywords = classified.customValues
        }

        // encrypt password
        const encryptedPassword = await bcrypt.hash(password, 10);


        let newUser = new User({
            username,
            title,
            description,
            services,
            keywords: _keywords,
            customKeywords: _customKeywords,
            country,
            state,
            city,
            phoneNumber,
            email: email.toLowerCase(),
            password: encryptedPassword,
            resume: resumeUrl,
            role,
            timeSlots: role === 'admin' ? undefined : timeSlots,
            status: 'active'
        });

        // Save user
        await newUser.save();

        logAdminAction({
            actor: req.user,
            action: role === 'admin' ? "invite_admin" : "register_user",
            targetType: "user",
            targetId: newUser._id,
            targetEmail: newUser.email,
            meta: { role, username },
        });

        if (sendWelcome || role === 'admin') {
            try {
                const html = renderAdminEmail({
                    heading: 'Welcome to WisdomLinked',
                    previewText: 'Your account is ready.',
                    blocks: [
                        adminParagraph(
                            role === 'admin'
                                ? 'An administrator account has been created for you. Sign in with the credentials below.'
                                : 'Your account has been registered. You can sign in with the credentials below.'
                        ),
                        adminFacts([['Email', email], ['Temporary password', password]]),
                        adminCallout('Please sign in and change this password as soon as you can — it was sent by email and should not be treated as permanent.', 'warn'),
                        adminButton('Sign in'),
                    ],
                });
                const msg: any = {
                    to: email,
                    from: { name: "WisdomLinked Admin", email: adminEmail },
                    subject: role === 'admin' ? "WisdomLinked admin invite" : "Welcome to WisdomLinked",
                    html,
                };
                const inlineHeader = adminAttachments();
                if (inlineHeader.length) msg.attachments = inlineHeader;
                await sgMail.send(msg);
            } catch (emailErr: any) {
                console.error("Welcome email failed after admin register:", emailErr?.message || emailErr);
            }
        }

        return res.status(200).json({
            status: 'SUCCESS',
            message: role === 'admin'
                ? 'Admin invited successfully'
                : 'User created successfully by admin'
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};


const getCustomMajors = async (req: Request, res: Response) => {
    try {
        const pipeline = (idField: string) => [
            { $unwind: "$customKeywords" },
            { $match: { customKeywords: { $type: "string", $ne: "" } } },
            {
                $group: {
                    _id: { $toLower: { $trim: { input: "$customKeywords" } } },
                    value: { $first: "$customKeywords" },
                    owners: { $addToSet: `$${idField}` },
                },
            },
        ];

        const [userRows, seminarRows] = await Promise.all([
            User.aggregate(pipeline("_id")),
            GroupChat.aggregate(pipeline("_id")),
        ]);

        const merged = new Map<string, { value: string; userCount: number; seminarCount: number; official: boolean }>();
        const absorb = (rows: any[], field: "userCount" | "seminarCount") => {
            for (const row of rows) {
                const key = String(row._id);
                const entry = merged.get(key) || { value: row.value, userCount: 0, seminarCount: 0, official: false };
                entry[field] += Array.isArray(row.owners) ? row.owners.length : 0;
                merged.set(key, entry);
            }
        };
        absorb(userRows, "userCount");
        absorb(seminarRows, "seminarCount");

        const nonBaselineKeywords = (await Keyword.find({ approved: { $ne: true } }).select("_id value")).filter(
            (k: any) => !isBaselineMajor(k.value),
        );
        for (const kw of nonBaselineKeywords) {
            const [userCount, seminarCount] = await Promise.all([
                User.countDocuments({ keywords: kw._id }),
                GroupChat.countDocuments({ keywords: kw._id }),
            ]);
            const key = String(kw.value || "").trim().toLowerCase();
            if (!key) continue;
            const entry = merged.get(key) || { value: kw.value, userCount: 0, seminarCount: 0, official: false };
            entry.userCount += userCount;
            entry.seminarCount += seminarCount;
            entry.official = true;
            merged.set(key, entry);
        }

        const result = Array.from(merged.values())
            .map((e) => ({
                value: e.value,
                count: e.userCount + e.seminarCount,
                userCount: e.userCount,
                seminarCount: e.seminarCount,
                official: e.official,
            }))
            .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

        return res.status(200).json({ result });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const consolidateMajors = async (req: Request, res: Response) => {
    try {
        const sourcesRaw = Array.isArray(req.body?.sources) ? req.body.sources : [];
        const target = String(req.body?.target || "").trim();
        const sources = sourcesRaw
            .map((s: any) => String(s || "").trim())
            .filter((s: string) => s.length);

        if (!target) {
            return res.status(400).json({ status: "FAIL", error: "A target official major is required." });
        }

        const performedBy = (req as any).user?.email || (req as any).user?.username || "";

        let keyword = await Keyword.findOne({
            value: { $regex: new RegExp(`^${escapeRegExp(target)}$`, "i") },
        });
        const targetCreated = !keyword;
        if (!keyword) {
            keyword = await Keyword.create({ value: target, label: target, approved: true });
        } else if (!keyword.approved) {
            keyword.approved = true;
            await keyword.save();
        }

        if (!sources.length) {
            await MajorConsolidation.create({
                target: keyword.value,
                targetCreated,
                sources: [],
                usersUpdated: 0,
                seminarsUpdated: 0,
                performedBy,
            });
            logAdminAction({
                actor: req.user,
                action: "consolidate_majors",
                targetType: "major",
                targetId: keyword._id,
                meta: { target: keyword.value, sources: [], usersUpdated: 0, seminarsUpdated: 0 },
            });
            return res.status(200).json({
                result: { major: keyword.value, usersUpdated: 0, seminarsUpdated: 0 },
            });
        }

        const matchesSource = (c: string) =>
            sources.some((s: string) => s.toLowerCase() === String(c).trim().toLowerCase());
        const sourceRegexes = sources.map((s: string) => new RegExp(`^${escapeRegExp(s)}$`, "i"));
        const idEq = (a: any, b: any) => String(a) === String(b);

        const touchedUserIds = new Set<string>();
        const touchedSeminarIds = new Set<string>();

        const affectedUsers = await User.find({ customKeywords: { $in: sourceRegexes } }).select("_id keywords customKeywords");
        for (const user of affectedUsers) {
            const hasKeyword = (user.keywords || []).some((k: any) => idEq(k, keyword._id));
            if (!hasKeyword) user.keywords.push(keyword._id);
            user.customKeywords = (user.customKeywords || []).filter((c: string) => !matchesSource(c));
            await user.save();
            touchedUserIds.add(String(user._id));
        }

        const affectedSeminars = await GroupChat.find({ customKeywords: { $in: sourceRegexes } }).select("_id keywords customKeywords");
        for (const seminar of affectedSeminars) {
            const hasKeyword = (seminar.keywords || []).some((k: any) => idEq(k, keyword._id));
            if (!hasKeyword) seminar.keywords.push(keyword._id);
            seminar.customKeywords = (seminar.customKeywords || []).filter((c: string) => !matchesSource(c));
            await seminar.save();
            touchedSeminarIds.add(String(seminar._id));
        }

        const sourceKeywords = await Keyword.find({
            value: { $in: sourceRegexes },
            _id: { $ne: keyword._id },
        }).select("_id");
        const sourceKeywordIds = sourceKeywords.map((k: any) => k._id);
        if (sourceKeywordIds.length) {
            const usersWithSourceKeyword = await User.find({ keywords: { $in: sourceKeywordIds } }).select("_id keywords");
            for (const user of usersWithSourceKeyword) {
                user.keywords = (user.keywords || []).filter((k: any) => !sourceKeywordIds.some((id: any) => idEq(id, k)));
                if (!user.keywords.some((k: any) => idEq(k, keyword._id))) user.keywords.push(keyword._id);
                await user.save();
                touchedUserIds.add(String(user._id));
            }

            const seminarsWithSourceKeyword = await GroupChat.find({ keywords: { $in: sourceKeywordIds } }).select("_id keywords");
            for (const seminar of seminarsWithSourceKeyword) {
                seminar.keywords = (seminar.keywords || []).filter((k: any) => !sourceKeywordIds.some((id: any) => idEq(id, k)));
                if (!seminar.keywords.some((k: any) => idEq(k, keyword._id))) seminar.keywords.push(keyword._id);
                await seminar.save();
                touchedSeminarIds.add(String(seminar._id));
            }

            await Keyword.deleteMany({ _id: { $in: sourceKeywordIds } });
        }

        const usersUpdated = touchedUserIds.size;
        const seminarsUpdated = touchedSeminarIds.size;

        await MajorConsolidation.create({
            target: keyword.value,
            targetCreated,
            sources,
            usersUpdated,
            seminarsUpdated,
            performedBy,
        });

        logAdminAction({
            actor: req.user,
            action: "consolidate_majors",
            targetType: "major",
            targetId: keyword._id,
            meta: { target: keyword.value, sources, usersUpdated, seminarsUpdated },
        });

        return res.status(200).json({
            result: {
                major: keyword.value,
                usersUpdated,
                seminarsUpdated,
            },
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const getMajorConsolidations = async (req: Request, res: Response) => {
    try {
        const rows = await MajorConsolidation.find()
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        return res.status(200).json({ result: rows });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const INTEGRITY_LOOKBACK_MS = 120 * 24 * 60 * 60 * 1000;
const INTEGRITY_STUCK_PENDING_MS = 60 * 60 * 1000;
const INTEGRITY_MAX_BOOKINGS = 500;

const getPaymentIntegrityReport = async (req, res) => {
    try {
        const onlyActionable = String(req.query?.onlyActionable ?? 'true') !== 'false';
        const since = new Date(Date.now() - INTEGRITY_LOOKBACK_MS);

        const bookings = await GroupChat.find({
            type: { $in: ['seminar', 'individual'] },
            price: { $gt: 0 },
            status: { $in: ['active', 'pending'] },
            createdAt: { $gte: since },
        })
            .select('_id name type price status start end duration admin participants seriesId paymentDeadline')
            .limit(INTEGRITY_MAX_BOOKINGS)
            .lean();

        const seriesIds = [...new Set(bookings.map((b: any) => String(b.seriesId || '')).filter(Boolean))];
        const seriesSiblings = seriesIds.length
            ? await GroupChat.find({ seriesId: { $in: seriesIds }, type: 'seminar' }).select('_id seriesId').lean()
            : [];
        const idsInSeries = new Map<string, string[]>();
        for (const sibling of seriesSiblings) {
            const key = String(sibling.seriesId);
            const list = idsInSeries.get(key) || [];
            list.push(String(sibling._id));
            idsInSeries.set(key, list);
        }

        const chargeBookingIds = new Set<string>(bookings.map((b: any) => String(b._id)));
        for (const sibling of seriesSiblings) chargeBookingIds.add(String(sibling._id));
        const recordedCharges: any[] = chargeBookingIds.size
            ? await PaymentHistory.find({
                groupChat: { $in: [...chargeBookingIds] },
                // A paid retry link is the "take payment again" this list asks for.
                $or: [{ paymentType: 'charge' }, { paymentType: 'retry', status: 'completed' }],
            }).select('groupChat customer status amount paymentIntent').lean()
            : [];
        const chargeIntents = [...new Set(recordedCharges.map((row: any) => String(row.paymentIntent || '')).filter(Boolean))];
        const refundedIntents = new Set<string>(chargeIntents.length
            ? (await PaymentHistory.distinct('paymentIntent', {
                paymentType: 'refund',
                paymentIntent: { $in: chargeIntents },
            })).map(String)
            : []);
        const chargeRows = markRefundedCharges(recordedCharges, refundedIntents);
        const now = Date.now();

        // (bookingId|studentId) -> charge rows
        const rowsByPair = new Map<string, any[]>();
        for (const row of chargeRows) {
            const key = `${String(row.groupChat)}|${String(row.customer)}`;
            const list = rowsByPair.get(key) || [];
            list.push(row);
            rowsByPair.set(key, list);
        }

        const verdicts: BookingPaymentVerdict[] = [];
        const rows: any[] = [];

        for (const booking of bookings) {
            const adminId = String(booking.admin ?? '');
            const students = (booking.participants || [])
                .map((p: any) => String(p))
                .filter((p: string) => p && p !== adminId);

            const seriesKey = String(booking.seriesId || '');
            const seriesGroupIds = seriesKey
                ? (idsInSeries.get(seriesKey) || [String(booking._id)])
                : [String(booking._id)];

            for (const studentId of students) {
                const ownCharges = rowsByPair.get(`${String(booking._id)}|${studentId}`) || [];
                const seriesHasCompletedCharge = seriesGroupIds.some((id) =>
                    (rowsByPair.get(`${id}|${studentId}`) || []).some((row: any) => row?.status === 'completed'),
                );
                const seriesHasRefundedCharge = seriesGroupIds.some((id) =>
                    (rowsByPair.get(`${id}|${studentId}`) || []).some((row: any) => row?.status === 'refunded'),
                );
                const priceCents = Math.round(Number(booking.price ?? 0) * 100);
                const check = checkSeat({
                    type: booking.type,
                    status: booking.status,
                    paymentDeadline: booking.paymentDeadline,
                    priceCents,
                    ownCharges,
                    seriesHasCompletedCharge,
                    seriesHasRefundedCharge,
                    sessionEnded: sessionHasEnded(booking, now),
                });
                if (check.verdict !== 'waiting') verdicts.push(check.verdict);
                if (onlyActionable && !check.list) continue;
                if (!onlyActionable && check.verdict === 'waiting') continue;
                rows.push({
                    verdict: check.verdict,
                    groupChatId: String(booking._id),
                    name: booking.name,
                    type: booking.type,
                    status: booking.status,
                    start: booking.start,
                    priceCents,
                    customer: studentId,
                    expert: adminId,
                    paymentIntents: ownCharges.map((r: any) => r.paymentIntent).filter(Boolean),
                });
            }
        }

        const stuckPending = await PaymentHistory.find({
            paymentType: 'charge',
            status: 'pending',
            updatedAt: { $lte: new Date(Date.now() - INTEGRITY_STUCK_PENDING_MS) },
        })
            .select('paymentIntent amount currency customer expert groupChat stripeMode updatedAt description')
            .limit(200)
            .lean();

        const recordGroups = await PaymentHistory.aggregate([
            { $match: { status: { $in: [...RECORD_COUNT_STATUSES] } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const userIds = new Set<string>();
        for (const row of rows) {
            if (row.customer) userIds.add(String(row.customer));
            if (row.expert) userIds.add(String(row.expert));
        }
        const users = userIds.size
            ? await User.find({ _id: { $in: Array.from(userIds) } }).select('email username role').lean()
            : [];
        const userById = new Map<string, any>(users.map((u: any) => [String(u._id), u]));
        for (const row of rows) {
            row.customerEmail = userById.get(String(row.customer))?.email ?? null;
            row.expertEmail = userById.get(String(row.expert))?.email ?? null;
        }

        const order: Record<string, number> = { unpaid: 0, refunded: 1, in_flight: 2, paid: 3, free: 4 };
        rows.sort((a, b) => (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9));

        return res.status(200).json({
            summary: summarizeVerdicts(verdicts),
            recordCounts: recordCountsByStatus(recordGroups),
            bookingsScanned: bookings.length,
            truncated: bookings.length >= INTEGRITY_MAX_BOOKINGS,
            lookbackDays: Math.round(INTEGRITY_LOOKBACK_MS / (24 * 60 * 60 * 1000)),
            rows,
            stuckPendingPayments: stuckPending,
        });
    } catch (err) {
        console.log('[getPaymentIntegrityReport]', err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const numPerPage = Math.min(Math.max(Number(req.query.numPerPage) || 25, 1), 100);
        const currentPage = Math.max(Number(req.query.currentPage) || 0, 0);
        const [totalCount, result] = await Promise.all([
            AdminAuditLog.countDocuments({}),
            AdminAuditLog.find({})
                .sort({ createdAt: -1 })
                .skip(numPerPage * currentPage)
                .limit(numPerPage)
                .lean(),
        ]);
        return res.status(200).json({ result, totalCount, numPerPage, currentPage });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const getAllFeedbacks = async (req: Request, res: Response) => {
    try {
        const numPerPage = Math.min(Math.max(Number(req.query.numPerPage) || 20, 1), 100);
        const currentPage = Math.max(Number(req.query.currentPage) || 0, 0);

        const pipeline: any[] = [
            { $match: { feedbacks: { $exists: true, $ne: [] } } },
            { $project: { email: 1, username: 1, role: 1, feedbacks: 1 } },
            { $unwind: "$feedbacks" },
            {
                $project: {
                    userId: "$_id",
                    userEmail: "$email",
                    userUsername: "$username",
                    userRole: "$role",
                    rating: { $ifNull: ["$feedbacks.rating", 0] },
                    description: { $ifNull: ["$feedbacks.description", ""] },
                    date: "$feedbacks.date",
                    start: "$feedbacks.start",
                    end: "$feedbacks.end",
                    eventType: "$feedbacks.eventType",
                    eventId: "$feedbacks.eventId",
                    groupChatId: "$feedbacks.groupChatId",
                    otherUserId: "$feedbacks.otherUserId",
                    totalTimeSpent: "$feedbacks.totalTimeSpent",
                },
            },
            { $sort: { date: -1, start: -1 } },
            {
                $facet: {
                    total: [{ $count: "count" }],
                    page: [{ $skip: numPerPage * currentPage }, { $limit: numPerPage }],
                },
            },
        ];

        const agg = await User.aggregate(pipeline);
        const totalCount = agg[0]?.total?.[0]?.count || 0;
        const page = agg[0]?.page || [];

        const otherIds = page.map((r: any) => r.otherUserId).filter(Boolean);
        const others = otherIds.length
            ? await User.find({ _id: { $in: otherIds } }).select("username email role image").lean()
            : [];
        const otherById = new Map(others.map((u: any) => [String(u._id), u]));

        const groupChatIds = toLookupIds(page.map((r: any) => r.groupChatId));
        const groupChats = groupChatIds.length
            ? await GroupChat.find({ _id: { $in: groupChatIds } }).select("name type").lean()
            : [];
        const groupChatById = new Map(groupChats.map((g: any) => [String(g._id), g]));

        const eventIds = toLookupIds(page.map((r: any) => r.eventId));
        const events = eventIds.length
            ? await Event.find({ _id: { $in: eventIds } }).select("title").lean()
            : [];
        const eventById = new Map(events.map((e: any) => [String(e._id), e]));

        const result = page.map((row: any) => {
            const groupChat = row.groupChatId ? groupChatById.get(String(row.groupChatId)) || null : null;
            const event = row.eventId ? eventById.get(String(row.eventId)) || null : null;
            const meeting = resolveFeedbackMeetingKind({
                eventType: row.eventType,
                groupChat,
                event,
                eventId: row.eventId,
            });
            return {
                ...row,
                groupChat,
                event,
                meetingKind: meeting.kind,
                meetingName: meeting.name,
                otherUser: row.otherUserId ? otherById.get(String(row.otherUserId)) || null : null,
            };
        });

        return res.status(200).json({ result, totalCount, numPerPage, currentPage });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const IMPERSONATION_TTL = "2h";
const IMPERSONATION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const inviteAdmin = async (req: Request, res: Response) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const username = String(req.body?.username || "").trim();
        let password = String(req.body?.password || "").trim();

        if (!email || !username) {
            return res.status(400).json({ status: "FAIL", error: "Email and username are required." });
        }
        if (checkTitleNameInvalid("Username", username)) {
            return res.status(200).json({ status: "FAIL", error: checkTitleNameInvalid("Username", username) });
        }
        if (!password) {
            password = Math.random().toString(36).slice(-10) + "A1!";
        }

        const userExists = await User.exists({ email });
        if (userExists) {
            return res.status(200).json({ status: "FAIL", error: "E-mail already in use." });
        }
        const pendingExists = await PendingUser.exists({ email });
        if (pendingExists) {
            return res.status(200).json({ status: "FAIL", error: "E-mail already in use in pending list." });
        }

        const encryptedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email,
            password: encryptedPassword,
            role: "admin",
            status: "active",
            description: "Admin account invited by another admin",
        });
        await newUser.save();

        logAdminAction({
            actor: req.user,
            action: "invite_admin",
            targetType: "user",
            targetId: newUser._id,
            targetEmail: newUser.email,
            meta: { username },
        });

        try {
            const html = renderAdminEmail({
                heading: "WisdomLinked admin invite",
                previewText: "You have been invited as an admin.",
                blocks: [
                    adminParagraph("An administrator account has been created for you. Sign in with the credentials below."),
                    adminFacts([["Email", email], ["Temporary password", password]]),
                    adminCallout("Please sign in and change this password as soon as you can.", "warn"),
                    adminButton("Sign in"),
                ],
            });
            const msg: any = {
                to: email,
                from: { name: "WisdomLinked Admin", email: adminEmail },
                subject: "WisdomLinked admin invite",
                html,
            };
            const inlineHeader = adminAttachments();
            if (inlineHeader.length) msg.attachments = inlineHeader;
            await sgMail.send(msg);
        } catch (emailErr: any) {
            console.error("Admin invite welcome email failed:", emailErr?.message || emailErr);
        }

        return res.status(200).json({
            status: "SUCCESS",
            message: "Admin invited successfully",
            temporaryPassword: password,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const impersonateUser = async (req: Request, res: Response) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ status: "FAIL", error: "email is required" });
        }

        const target = await User.findOne({ email }).select("+token");
        if (!target) {
            return res.status(404).json({ status: "FAIL", error: "User not found" });
        }
        if (target.role === "admin") {
            return res.status(403).json({ status: "FAIL", error: "Cannot impersonate another admin" });
        }
        if (target.status === "blocked") {
            return res.status(400).json({ status: "FAIL", error: "Cannot impersonate a blocked user" });
        }

        const adminToken = readAccessToken(req);
        if (!adminToken) {
            return res.status(401).json({ status: "FAIL", error: "Admin session missing" });
        }

        const impersonationToken = jwt.sign(
            { email: target.email.toString() },
            process.env.JWT_SECRET,
            { expiresIn: IMPERSONATION_TTL }
        );
        target.token = impersonationToken;
        await target.save();

        res.cookie("impersonatorToken", adminToken, authCookieOptions(IMPERSONATION_MAX_AGE_MS));
        res.cookie("accessToken", impersonationToken, authCookieOptions(IMPERSONATION_MAX_AGE_MS));

        logAdminAction({
            actor: req.user,
            action: "impersonate_start",
            targetType: "user",
            targetId: target._id,
            targetEmail: target.email,
            meta: { targetRole: target.role, targetUsername: target.username },
        });

        const safeUser = target.toObject();
        delete safeUser.password;
        delete safeUser.token;

        return res.status(200).json({
            status: "SUCCESS",
            userDetails: safeUser,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

const stopImpersonation = async (req: Request, res: Response) => {
    try {
        const impersonatorToken = req.cookies?.impersonatorToken;
        if (!impersonatorToken) {
            return res.status(400).json({ status: "FAIL", error: "Not currently impersonating" });
        }

        let decoded: any;
        try {
            decoded = jwt.verify(impersonatorToken, process.env.JWT_SECRET);
        } catch {
            res.clearCookie("impersonatorToken", clearAuthCookieOptions());
            return res.status(401).json({ status: "FAIL", error: "Impersonator session expired" });
        }

        const admin = await User.findOne({ email: decoded.email }).select("+token");
        if (!admin || admin.role !== "admin") {
            res.clearCookie("impersonatorToken", clearAuthCookieOptions());
            return res.status(401).json({ status: "FAIL", error: "Invalid impersonator" });
        }
        if (admin.status === "blocked") {
            res.clearCookie("impersonatorToken", clearAuthCookieOptions());
            return res.status(403).json({ status: "FAIL", error: "Admin account is blocked" });
        }

        let targetEmail: string | undefined;
        let targetId: string | undefined;
        try {
            const currentAccess = readAccessToken(req);
            if (currentAccess) {
                const targetDecoded: any = jwt.verify(currentAccess, process.env.JWT_SECRET);
                targetEmail = targetDecoded?.email;
                if (targetEmail) {
                    const target = await User.findOne({ email: targetEmail }).select("_id");
                    targetId = target?._id ? String(target._id) : undefined;
                }
            }
        } catch {
            // ignore — still restore admin
        }

        const restoredToken = await admin.generateAuthToken();
        res.cookie("accessToken", restoredToken, authCookieOptions());
        res.clearCookie("impersonatorToken", clearAuthCookieOptions());

        logAdminAction({
            actor: { userId: admin._id.toString(), email: admin.email },
            action: "impersonate_end",
            targetType: "user",
            targetId,
            targetEmail,
            meta: {},
        });

        const safeAdmin = admin.toObject();
        delete safeAdmin.password;
        delete safeAdmin.token;

        return res.status(200).json({
            status: "SUCCESS",
            userDetails: safeAdmin,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    getPaymentIntegrityReport,
    filterUsers,
    getCustomMajors,
    consolidateMajors,
    getMajorConsolidations,
    getFullUserDataByEmail,
    updateProfileOfUser,
    filterPaymentHistories,
    getDirectChatHistory,
    getGroupChatHistory,
    getUserFeedbacks,
    getAllFeedbacks,
    getContactedUs,
    toggleActionedStatus,
    sendEmailToUser,
    sendWelcomeEmail,
    getDashboardStats,
    getAdminPlatformEvents,
    getPendingUsers,
    getPendingLogins,
    deletePendingUser,
    deletePendingLogin,
    convertPendingUserToUserByAdmin,
    registerUserByAdmin,
    inviteAdmin,
    getAuditLogs,
    impersonateUser,
    stopImpersonation,
};
