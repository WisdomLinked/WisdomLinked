import { Request, Response } from 'express';
import { safeErrorMessage } from '../utils/httpUserFacingCopy';
import {
    classifyBookingPayment,
    foldChargeRows,
    isActionable,
    summarizeVerdicts,
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
const { classifyMajors } = require("../utils/majorClassification");
const { isBaselineMajor } = require("../constants/majorOptions");
const ContactedUs = require("../models/ContactedUs");
const PendingUser = require("../models/PendingUser");
const PendingLogin = require("../models/PendingLogin");
const chatBotQA = require("../models/chatBotQA");

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
        const { username, email, role, status, sortBy, sortOrder, numPerPage, currentPage } = req.body
        let query = User.find({ role: { $ne: 'admin' } })
        let countQuery = User.countDocuments({ role: { $ne: 'admin' } })

        if (username) {
            query.where({ username: { '$regex': escapeRegExp(username), '$options': 'i' } })
            countQuery.where({ username: { '$regex': escapeRegExp(username), '$options': 'i' } })
        }
        if (email) {
            query.where({ email: { '$regex': escapeRegExp(email), '$options': 'i' } })
            countQuery.where({ email: { '$regex': escapeRegExp(email), '$options': 'i' } })
        }
        if (role) {
            query.where({ role: String(role) })
            countQuery.where({ role: String(role) })
        }
        if (status) {
            query.where({ status: String(status) })
            countQuery.where({ status: String(status) })
        }

        // Dynamic sorting based on `sortBy` and `sortOrder`
        const sortField = sortBy || "createdAt";
        const sortOrderValue = sortOrder === "DESC" ? -1 : 1;
        query.sort({ [sortField]: sortOrderValue });

        query.skip(numPerPage * currentPage).limit(numPerPage)
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
        const { email, sortBy, stripeMode, paymentType, status, dateFrom, dateTo, numPerPage, currentPage } = req.body
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
            { path: 'groupChat', select: 'type name status' },
        ])

        if (stripeMode) {
            query.where({ stripeMode: String(stripeMode) })
            countQuery.where({ stripeMode: String(stripeMode) })
        }

        if (paymentType) {
            query.where({ paymentType: String(paymentType) })
            countQuery.where({ paymentType: String(paymentType) })
        }

        if (status) {
            query.where({ status: String(status) })
            countQuery.where({ status: String(status) })
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
        query.skip(numPerPage * currentPage).limit(numPerPage)
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

        await User.findOneAndUpdate({ email: String(email) }, updates, { new: true })
        const result = await getFullUserData(email)
        if (status && status === 'active') {
            // If the user is activated, send an email notification
            await sendEmailUserAccountApproved(result.email, result.username);
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
            if (feedback.otherUserId) {
                otherUser = await User.findById(feedback.otherUserId).select("username _id image role");
            }

            let eventData = null;
            if (feedback.eventId) {
                eventData = await Event.findById(feedback.eventId).select("title");
            }

            let groupChatData = null;
            if (feedback.groupChatId) {
                groupChatData = await GroupChat.findById(feedback.groupChatId).select("name");
            }

            enriched.push({
                event: eventData || null,
                groupChat: groupChatData || null,
                eventType: feedback.eventType || null,
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
            fromDate.setUTCHours(0, 0, 0, 0); // Start of the day
            const toDate = new Date(dateTo);
            toDate.setUTCHours(23, 59, 59, 999); // End of the day

            query = query.where("createdAt").gte(fromDate).lte(toDate);
        }

        if (actioned) {
            query = query.where("actioned", String(actioned));
        }

        query = query.collation({ locale: "en", strength: 2 });

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
        const { email, message } = req.body;

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

        return res.status(200).json({
            status: "SUCCESS",
            message: "Email sent successfully."
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
        const SYSTEM_CHAT_NAMES = ["Global Chat", "Admin"];
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
            Event.countDocuments(),
            GroupChat.countDocuments({
                type: "seminar",
                name: { $nin: SYSTEM_CHAT_NAMES },
            }),
            PaymentHistory.countDocuments({ paymentType: { $ne: "refund" } }),
            PaymentHistory.countDocuments({ paymentType: "refund" }),
            countTodayUpcomingEvents(),
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
            },
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: safeErrorMessage(err) });
    }
};

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
        const limit = scope === "all" ? 400 : 500;

        const items: any[] = [];

        const includeEvent = types.includes("event");
        const includeSeminar = types.includes("seminar");
        const includeOneToOne = types.includes("oneToOne");

        if (includeEvent) {
            const q = timeFilter || {};
            const events = await Event.find(q)
                .populate("expert", "username email")
                .populate("customer", "username email")
                .sort({ start: sortOrder })
                .limit(limit);
            for (const ev of events) {
                items.push({
                    kind: "booking",
                    id: String(ev._id),
                    title: ev.title || "1:1 booking",
                    start: ev.start,
                    end: ev.end,
                    status: ev.status,
                    expert: ev.expert
                        ? { username: ev.expert.username, email: ev.expert.email }
                        : null,
                    customer: ev.customer
                        ? { username: ev.customer.username, email: ev.customer.email }
                        : null,
                });
            }
        }

        const gcTypes: string[] = [];
        if (includeSeminar) gcTypes.push("seminar");
        if (includeOneToOne) gcTypes.push("individual");

        if (gcTypes.length) {
            const gcQuery = timeFilter
                ? { $and: [timeFilter, { type: { $in: gcTypes } }] }
                : { type: { $in: gcTypes } };
            const gcs = await GroupChat.find(gcQuery)
                .populate("createdBy", "username email")
                .populate("admin", "username email")
                .sort({ start: sortOrder })
                .limit(limit);
            for (const g of gcs) {
                const isSeminar = g.type === "seminar";
                const adminUser = g.admin || g.createdBy;
                items.push({
                    kind: isSeminar ? "seminar" : "groupOneToOne",
                    id: String(g._id),
                    title: isSeminar ? `(S) ${g.name || "Seminar"}` : g.name || "1:1 session",
                    start: g.start,
                    end: g.end,
                    status: g.status,
                    expert: adminUser
                        ? { username: adminUser.username, email: adminUser.email }
                        : null,
                    customer: null,
                    groupChatType: g.type,
                });
            }
        }

        items.sort((a, b) => {
            const ta = new Date(a.start).getTime();
            const tb = new Date(b.start).getTime();
            return sortOrder === 1 ? ta - tb : tb - ta;
        });

        return res.status(200).json({ status: "SUCCESS", items });
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
        await PendingUser.findByIdAndDelete(String(pendingUserId));
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
            email: pendingUser.email.toLowerCase(),
            password: pendingUser.password,
            resume: pendingUser.resume,
            role: pendingUser.role,
            timeSlots: pendingUser.timeSlots,
            price: pendingUser.price,
            status: "active"
        });

        await newUser.save();

        await PendingUser.findByIdAndDelete(String(pendingUserId));

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
            timeSlots,
            status: 'active'
        });

        // Save user
        await newUser.save();

        return res.status(200).json({
            status: 'SUCCESS',
            message: 'User created successfully by admin'
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
            .select('_id name type price status start admin participants')
            .limit(INTEGRITY_MAX_BOOKINGS)
            .lean();

        const bookingIds = bookings.map((b: any) => b._id);
        const chargeRows = bookingIds.length
            ? await PaymentHistory.find({
                groupChat: { $in: bookingIds },
                paymentType: 'charge',
            }).select('groupChat customer status amount paymentIntent').lean()
            : [];

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

            for (const studentId of students) {
                const state = {
                    priceCents: Math.round(Number(booking.price ?? 0) * 100),
                    ...foldChargeRows(rowsByPair.get(`${String(booking._id)}|${studentId}`) || []),
                };
                const verdict = classifyBookingPayment(state);
                verdicts.push(verdict);
                if (onlyActionable && !isActionable(verdict)) continue;
                rows.push({
                    verdict,
                    groupChatId: String(booking._id),
                    name: booking.name,
                    type: booking.type,
                    status: booking.status,
                    start: booking.start,
                    priceCents: state.priceCents,
                    customer: studentId,
                    expert: adminId,
                    paymentIntents: (rowsByPair.get(`${String(booking._id)}|${studentId}`) || [])
                        .map((r: any) => r.paymentIntent)
                        .filter(Boolean),
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
    registerUserByAdmin
}
