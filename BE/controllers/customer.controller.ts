import { Request, Response } from 'express';
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const Keyword = require("../models/Keyword")
const PaymentHistory = require("../models/PaymentHistory");
import { safeErrorMessage } from '../utils/httpUserFacingCopy';

// Escape user-supplied text so it can be used safely inside a regex (prevents ReDoS / injection).
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

//  - followerCount: how many customers follow the expert
//  - isFollowing:   whether the requesting customer already follows them
const withFollowInfo = (expert: any, myFollowingIds: Set<string>) => {
    // flattenMaps so Map fields (e.g. blockedBookingSlots) serialize to plain objects;
    // toObject() defaults to flattenMaps:false, which JSON.stringify turns into {}.
    const plain = typeof expert.toObject === 'function'
        ? expert.toObject({ flattenMaps: true })
        : expert;
    return {
        ...plain,
        followerCount: Array.isArray(plain.followers) ? plain.followers.length : 0,
        isFollowing: myFollowingIds.has(String(plain._id)),
    };
};

const followingIdSet = (reqUser: any): Set<string> =>
    new Set((reqUser?.following || []).map((id: any) => String(id)));

const filterExperts = async (req: any, res: Response) => {
    try {
        const { _id, username, keywords, services, sortBy } = req.body
        // Default to active experts only — excludes experts still in review or blocked.
        let query = User.find({ role: 'expert', status: 'active' })
        if (_id) {
            query.where({ _id: String(_id) })
        } else {
            const term = typeof username === 'string' ? username.trim() : ''
            if (term) {
                const rx = { $regex: escapeRegex(term), $options: 'i' }
                // The search box matches across name, institution/title, bio and major (keyword) names.
                const matchingKeywords = await Keyword.find({ value: rx }).select('_id')
                const keywordIds = matchingKeywords.map((k: any) => k._id)
                query.where({
                    $or: [
                        { username: rx },
                        { title: rx },
                        { description: rx },
                        ...(keywordIds.length ? [{ keywords: { $in: keywordIds } }] : []),
                    ],
                })
            }
            if (keywords?.length) {
                let _keywords = []
                for (let i = 0; i < keywords.length; i++) {
                    if (keywords[i].new) {
                        const sameKeywordExist = await Keyword.findOne({
                            value: { $regex: new RegExp(`^${escapeRegex(keywords[i].value)}$`, 'i') },
                        })
                        if (sameKeywordExist) {
                            _keywords.push(sameKeywordExist._id)
                        }
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
            case "Price in ASC":
                query.sort({ price: 1 })
                break;
            case "Price in DESC":
                query.sort({ price: -1 })
                break;
            case "Recently joined":
                query.sort({ createdAt: -1 })
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
            }])
        const experts = await query.exec();
        const myFollowing = followingIdSet(req.user);

        return res.status(200).json({
            result: experts.map((e: any) => withFollowInfo(e, myFollowing))
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const filterSeminars = async (req, res) => {
    try {
        const { name, keywords, services, sortBy } = req.body

        let query = GroupChat.find({
            type: 'seminar',
            status: { $ne: 'draft' }, // never surface an expert's unfinished drafts to students
            $or: [
                {
                    start: { $gt: new Date() },
                },
                {
                    start: { $lt: new Date() },
                    end: { $gt: new Date() }
                }
            ],
            // Keep seminars the student is already enrolled in so they stay listed
            // with a "Registered" badge rather than disappearing after registration.
        })
        if (name) {
            query.where({ name: { '$regex': escapeRegex(String(name)), '$options': 'i' } })
        }
        if (keywords?.length) {
            let _keywords = []
            for (let i = 0; i < keywords.length; i++) {
                if (keywords[i].new) {
                    const sameKeywordExist = await Keyword.find({ value: keywords[i].value })
                    if (sameKeywordExist.length) {
                        _keywords.push(sameKeywordExist[0]._id)
                    } else {
                        const temp = new Keyword(keywords[i])
                        const newKeyword = await temp.save()
                        _keywords.push(newKeyword._id)
                    }
                } else {
                    _keywords.push(keywords[i]._id)
                }
            }
            query.where({ keywords: { $in: _keywords } })
        }
        if (services?.length) {
            query.where({ services: { $in: services } })
        }
        switch (sortBy) {
            case "Name in ASC":
                query.sort({ name: 1 })
                break;
            case "Name in DESC":
                query.sort({ name: -1 })
                break;
            case "Price in ASC":
                query.sort({ price: 1 })
                break;
            case "Price in DESC":
                query.sort({ price: -1 })
                break;
            default:
                break;
        }

        query.populate([
            {
                path: 'admin',
                select: 'email username image role status title description services keywords status bookingNoticeHours',
                populate: ['keywords', 'services']
            },
            {
                path: 'participants',
                select: 'email username image role status'
            },
            "keywords",
            "services"
        ])
        const seminars = (await query.exec()).filter(x => x.admin.status === 'active');

        return res.status(200).json({
            result: seminars
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}


const getExpertById = async (req, res) => {
    try {
        const { id } = req.params
        const query = await User.findById(String(id)).populate(["keywords","services","events","groupChats"
        ,{
            path: "pendingGroupChats",
            populate: ["groupChatId"],
        },
        ])

        if (!query) {
            return res.status(404).send("Expert not found");
        }

        return res.status(200).json({
            result: withFollowInfo(query, followingIdSet(req.user))
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const followExpert = async (req: any, res: Response) => {
    try {
        const { userId } = req.user
        const expertId = String(req.params.expertId)

        if (String(userId) === expertId) {
            return res.status(400).send("You cannot follow yourself");
        }

        const expert = await User.findOne({ _id: expertId, role: 'expert' });
        if (!expert) {
            return res.status(404).send("Expert not found");
        }

        await User.updateOne({ _id: userId }, { $addToSet: { following: expertId } });
        await User.updateOne({ _id: expertId }, { $addToSet: { followers: userId } });

        const updated = await User.findById(expertId).select('followers');
        return res.status(200).json({
            following: true,
            followerCount: updated?.followers?.length ?? 0,
        });
    } catch (err: any) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

// Unfollow an expert: remove the link from both sides.
const unfollowExpert = async (req: any, res: Response) => {
    try {
        const { userId } = req.user
        const expertId = String(req.params.expertId)

        await User.updateOne({ _id: userId }, { $pull: { following: expertId } });
        await User.updateOne({ _id: expertId }, { $pull: { followers: userId } });

        const updated = await User.findById(expertId).select('followers');
        return res.status(200).json({
            following: false,
            followerCount: updated?.followers?.length ?? 0,
        });
    } catch (err: any) {
        console.log(err)
        return res.status(500).send(safeErrorMessage(err));
    }
}

const getMyPaymentHistory = async (req: any, res: Response) => {
    try {
        const customerId = req.user.userId;
        const histories = await PaymentHistory.find({ customer: customerId })
            .populate("expert", "username email")
            .populate("groupChat", "name type")
            .populate("event", "title")
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        const enriched = histories.map((h: any) => ({
            ...h,
            paymentKind: h.groupChat?.type === "seminar" ? "seminar" : h.groupChat || h.event ? "individual" : "other",
        }));

        return res.status(200).json({ result: enriched });
    } catch (err: any) {
        console.log(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    filterExperts,
    filterSeminars,
    getExpertById,
    followExpert,
    unfollowExpert,
    getMyPaymentHistory,
}