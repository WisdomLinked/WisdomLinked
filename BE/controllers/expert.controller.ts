import { Request, Response } from 'express';
import { safeErrorMessage } from '../utils/httpUserFacingCopy';
const { ALLOWED_NOTICE_HOURS } = require("../utils/bookingLeadTime");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const Keyword = require("../models/Keyword");
const PaymentHistory = require("../models/PaymentHistory");
const { shareMeetingId } = require("../services/notifications")
const { classifyPayment, summarizePaymentHistory } = require("../utils/paymentSummary");

function expertUserUpdateFilter(req: any) {
    if (req.user?.userId) {
        return { _id: req.user.userId };
    }
    const email = req.user?.email;
    if (email) {
        const escaped = String(email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return { email: { $regex: new RegExp(`^${escaped}$`, "i") } };
    }
    return null;
}

function normalizeBlockedDates(dates: unknown): string[] | null {
    if (!Array.isArray(dates)) return null;
    const unique = [
        ...new Set(
            dates
                .map((d: unknown) => String(d || "").trim().slice(0, 10))
                .filter((s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
        ),
    ];
    unique.sort();
    return unique;
}

function normalizeBlockedSlots(
    slots: unknown,
): Record<string, number[]> | null {
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) return null;
    const out: Record<string, number[]> = {};
    for (const [rawKey, rawVal] of Object.entries(slots as Record<string, unknown>)) {
        const key = String(rawKey || "").trim().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
        if (!Array.isArray(rawVal)) continue;
        const indices = [
            ...new Set(
                rawVal
                    .map((v: unknown) => Math.trunc(Number(v)))
                    .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 47),
            ),
        ].sort((a, b) => a - b);
        if (indices.length) out[key] = indices;
    }
    return out;
}

const updateTimeSlots = async (req: any, res: Response) => {
    try {
        const { email } = req.user
        const { timeSlots, availabilityMode, weeklyTimeSlots } = req.body
        const update: any = { timeSlots: timeSlots }
        if (availabilityMode === 'common' || availabilityMode === 'daily') {
            update.availabilityMode = availabilityMode
        }
        if (weeklyTimeSlots && typeof weeklyTimeSlots === 'object') {
            update.weeklyTimeSlots = weeklyTimeSlots
        }
        const newUser = await User.findOneAndUpdate({ email: String(email) }, update, { new: true })
        newUser.token = null
        newUser.password = null
        return res.status(200).json({
            newUser: newUser
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getDailyTimeSlots = async (req, res) => {
    try {
        const { email } = req.user
        const { startTime, endTime, userId } = req.body
        const user = await User.findOne(userId ? { _id: String(userId) } : { email: email }).select('dailyTimeSlots')
        if (!user) {
            throw new Error("User not found")
        }
        let slots = []
        user.dailyTimeSlots.map(slot => {
            if (slot >= startTime && slot <= endTime) {
                slots.push(slot)
            }
        })
        return res.status(200).json({
            dailyTimeSlots: slots
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const updateDailyTimeSlots = async (req, res) => {
    try {
        const { email } = req.user
        const { startTime, endTime } = req.body
        const newSlots = Array.isArray(req.body?.newSlots) ? req.body.newSlots.map(String) : []
        const user = await User.findOne({ email: email }).select('dailyTimeSlots')
        if (!user) {
            throw new Error("User not found")
        }
        let slots = newSlots
        user.dailyTimeSlots.forEach(slot => {
            if (slot >= startTime && slot <= endTime) {
                // do nothing
            } else {
                slots.push(slot)
            }
        })
        await User.findOneAndUpdate({ email: String(email) }, { $set: { dailyTimeSlots: slots.map(String) } }, { new: true })

        return res.status(200).json({
            dailyTimeSlots: slots
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getCustomerById = async (req, res) => {
    try {
        console.log("inside getCustomerByid")
        const { id } = req.params
        const query = await User.findById(String(id)).populate(["keywords", "services"])
        console.log("inside getCustomerByid", query)
        return res.status(200).json({
            result: query
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const filterCustomers = async (req, res) => {
    try {
        const { email } = req.user
        const { _id, username, keywords, services, sortBy } = req.body
        let query = User.find({ role: 'customer', status: { $ne: 'blocked' } })
        if (_id) {
            query.where({ _id: String(_id) })
        } else {
            const searchTerm = username && String(username).trim();
            if (searchTerm) {
                const rx = { $regex: escapeRegex(searchTerm), $options: 'i' };
                // Mirrors the student-side expert search: name/email plus the student's
                // institution, degree, bio and major (keyword) names.
                const matchingKeywords = await Keyword.find({ value: rx }).select('_id')
                const keywordIds = matchingKeywords.map((k: any) => k._id)
                query.where({
                    $or: [
                        { username: rx },
                        { email: rx },
                        { title: rx },
                        { description: rx },
                        { currentUniversity: rx },
                        { targetUniversities: rx },
                        { degreeSought: rx },
                        { customKeywords: rx },
                        ...(keywordIds.length ? [{ keywords: { $in: keywordIds } }] : []),
                    ],
                });
            }
            if (keywords?.length) {
                let _keywords = []
                for (let i = 0; i < keywords.length; i++) {
                    if (keywords[i].new) {
                        const existing = await Keyword.findOne({ value: String(keywords[i].value) })
                        if (existing) _keywords.push(existing._id)
                    } else {
                        _keywords.push(keywords[i]._id)
                    }
                }
                query.where({ keywords: { $in: _keywords } })
            }
            if (services?.length) {
                query.where({ services: { $in: services } })
            }
        }
        switch (sortBy) {
            case "Name in ASC":
                query.sort({ username: 1 })
                break;
            case "Name in DESC":
                query.sort({ username: -1 })
                break;
            default:
                break;
        }

        query.populate([
            "events",
            "services",
            "keywords",
            "groupChats",
            {
                path: 'pendingGroupChats',
                populate: [
                    {
                        path: 'customerId',
                        select: 'email username image role status'
                    },
                    'groupChatId'
                ]
            }
        ])
        const customers = await query.exec();

        return res.status(200).json({
            result: customers
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const shareMeetingViaEmail = async (req, res) => {
    try {
        const { email, groupchatId } = req.body;
        const groupChat = await GroupChat.findById(String(groupchatId));

        const user = await User.findOne({ email: email.toLowerCase() })
        const name = user?.username ?? "Guest"

        shareMeetingId(email, name, groupchatId, groupChat.name)

        return res.status(200).send("Shared meeting Id via email successfully!");

    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

/** Set minimum advance booking notice (24 / 48 / 72 hours). */
const setBookingNoticeHours = async (req: any, res: Response) => {
    try {
        const filter = expertUserUpdateFilter(req);
        if (!filter) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const raw = req.body?.bookingNoticeHours ?? req.body?.hours;
        const n = Number(raw);
        if (!ALLOWED_NOTICE_HOURS.includes(n)) {
            return res.status(400).json({
                error: "bookingNoticeHours must be 24, 48, or 72",
            });
        }
        const user = await User.findByIdAndUpdate(
            filter,
            { bookingNoticeHours: n },
            { new: true },
        ).select("bookingNoticeHours timeZone email");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json({
            bookingNoticeHours: user.bookingNoticeHours,
            timeZone: user.timeZone || "UTC",
        });
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: safeErrorMessage(err) });
    }
};

/** Replace expert whole-day booking blocks (YYYY-MM-DD). */
const setBlockedBookingDates = async (req: any, res: Response) => {
    try {
        const filter = expertUserUpdateFilter(req);
        if (!filter) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const normalized = normalizeBlockedDates(req.body?.dates);
        if (normalized === null) {
            return res.status(400).json({
                error: "dates must be an array of YYYY-MM-DD strings",
            });
        }
        const user = await User.findByIdAndUpdate(
            filter,
            { blockedBookingDates: normalized },
            { new: true },
        ).select("blockedBookingDates bookingNoticeHours timeZone email");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json({
            blockedBookingDates: user.blockedBookingDates || [],
            bookingNoticeHours: user.bookingNoticeHours,
            timeZone: user.timeZone || "UTC",
        });
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: safeErrorMessage(err) });
    }
};

/** Replace expert per-date blocked time slots ({ "YYYY-MM-DD": [halfHourIndex, ...] }). */
const setBlockedBookingSlots = async (req: any, res: Response) => {
    try {
        const filter = expertUserUpdateFilter(req);
        if (!filter) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const normalized = normalizeBlockedSlots(req.body?.slots);
        if (normalized === null) {
            return res.status(400).json({
                error: "slots must be an object of YYYY-MM-DD to half-hour index arrays",
            });
        }
        const user = await User.findByIdAndUpdate(
            filter,
            { blockedBookingSlots: normalized },
            { new: true },
        ).select("blockedBookingSlots timeZone email");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json({
            blockedBookingSlots: user.blockedBookingSlots || {},
            timeZone: user.timeZone || "UTC",
        });
    } catch (err: any) {
        console.log(err);
        return res.status(500).json({ error: safeErrorMessage(err) });
    }
};

const getMyPaymentHistory = async (req: any, res: Response) => {
    try {
        const expertId = req.user.userId;
        const histories = await PaymentHistory.find({ expert: expertId })
            .populate("customer", "username email")
            .populate("groupChat", "name type")
            .populate("event", "title")
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        const enriched = histories.map((h: any) => ({
            ...h,
            paymentKind: classifyPayment(h),
        }));

        return res.status(200).json({
            result: enriched,
            summary: summarizePaymentHistory(histories),
        });
    } catch (err: any) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

// The logged-in expert's followers, as lightweight student cards for the dashboard list.
const getMyFollowers = async (req: any, res: Response) => {
    try {
        const expertId = req.user.userId;
        const expert = await User.findById(expertId)
            .select('followers')
            .populate({
                path: 'followers',
                select:
                    'email username image role status degreeSought intendedIntake ' +
                    'currentUniversity gpa country specialNote createdAt',
            })
            .lean();
        const followers = Array.isArray(expert?.followers) ? expert.followers : [];
        return res.status(200).json({ result: followers });
    } catch (err: any) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    updateTimeSlots,
    getDailyTimeSlots,
    updateDailyTimeSlots,
    setBookingNoticeHours,
    setBlockedBookingDates,
    setBlockedBookingSlots,
    filterCustomers,
    getCustomerById,
    shareMeetingViaEmail,
    getMyPaymentHistory,
    getMyFollowers,
}
