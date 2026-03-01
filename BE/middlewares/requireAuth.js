const jwt = require("jsonwebtoken");
const UserModel = require('../models/User')

const config = process.env;

const getFullUserData = async (email) => {
    return await UserModel.findOne({
        email: email
    })
        .select("+password")
        .populate([
            {
                path: "friends",
            },
            {
                path: "events",
                populate: ['customer', 'expert']
            },
            {
                path: "groupChats",
                populate: [
                    {
                        path: 'admin',
                        select: 'email username image role status'
                    },
                    {
                        path: 'participants',
                        select: 'email username image role status'
                    },
                    {
                        path: 'createdBy',
                        select: 'email username image role status'
                    },
                    "keywords",
                    "services",
                ]
            },
            {
                path: "generalChats",
                populate: [
                    {
                        path: 'admin',
                        select: 'email username image role status'
                    },
                    {
                        path: 'participants',
                        select: 'email username image role status'
                    },
                ]
            },
            "keywords",
            "services",
            {
                path: 'pendingGroupChats',
                populate: [
                    {
                        path: 'customerId',
                        select: 'email username image role status'
                    },
                    {
                        path: 'groupChatId',
                        populate: {
                            path: 'admin',
                            select: 'email username image role status'
                        }
                    }
                ]
            }
        ]);
}

// HIGH-02: Lightweight alternative to getFullUserData for endpoints that only need
// basic user data (keywords + services). Avoids loading the entire social graph.
const getUserData = async (email) => {
    return await UserModel.findOne({ email })
        .populate(["keywords", "services"]);
};

// HIGH-04: Single auth factory replacing four copy-pasted middleware functions.
// HIGH-01 FIX: generateAuthToken() is NOT called here. Token regeneration belongs
// exclusively at login (confirmLoginByCode). The old code called user.save() on every
// authenticated request, causing: a DB write on every GET, race conditions where
// concurrent requests invalidated each other's tokens, and severe write IOPS under load.
const createAuth = (options = {}) => async (req, res, next) => {
    try {
        const { accessToken } = req.cookies;
        if (!accessToken) throw new Error("cookie has been expired");

        const decodedAccessToken = jwt.verify(accessToken, process.env.JWT_SECRET);
        const now = Math.floor(Date.now() / 1000);
        if (now >= decodedAccessToken.exp) throw new Error("Cookie Expired");

        const user = await UserModel.findOne({ email: decodedAccessToken.email }).select("+token");
        if (!user) throw new Error("Unregistered user");

        // Role check (if specified)
        if (options.role && user.role !== options.role) {
            throw new Error(`No ${options.role} permission`);
        }

        if (!user.token) throw new Error("Invalid cookie");

        if (user.status === 'blocked') throw new Error("User is blocked");

        if (options.restrictUnderReview && user.status === 'review') {
            throw new Error("Unable to use under review");
        }

        const decodedUserToken = jwt.verify(user.token, process.env.JWT_SECRET);
        if (decodedUserToken.email !== decodedAccessToken.email) throw new Error("Invalid cookie");
        if (now >= decodedUserToken.exp) throw new Error("server side cookie has been expired.");

        req.user = {
            userId: user._id.toString(),
            ...user._doc,
            password: null,
            token: null
        };
        next();
    } catch (err) {
        console.log(err);
        return res.status(401).send(err.message);
    }
};

// Backwards-compatible exports matching existing route usage:
// requireAuth(bool), customerAuth(bool), expertAuth(bool) are factory functions — call them to get middleware.
// adminAuth is the middleware directly — use as-is in routes (no call).
const requireAuth = (restrictUnderReview = false) => createAuth({ restrictUnderReview });
const customerAuth = (restrictUnderReview = false) => createAuth({ role: 'customer', restrictUnderReview });
const expertAuth = (restrictUnderReview = false) => createAuth({ role: 'expert', restrictUnderReview });
const adminAuth = createAuth({ role: 'admin' });

module.exports = {
    requireAuth,
    customerAuth,
    expertAuth,
    getFullUserData,
    getUserData,
    adminAuth
};
