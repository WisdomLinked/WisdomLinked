import { Request, Response, NextFunction } from 'express';
const jwt = require("jsonwebtoken");
const UserModel = require('../models/User')
const { authCookieOptions } = require('../config/authCookie')

const config = process.env;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getFullUserData = async (email) => {
    return await UserModel.findOne({
        email: { $regex: new RegExp(`^${escapeRegExp(email)}$`, 'i') }
    })
        .select("+password")
        .populate([
            {
                path: "friends",
            },
            {
                path: "directConversations",
                populate: {
                    path: "participants",
                    select: "email username image role status",
                },
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
                        path: 'coModerators',
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
                    {
                        path: 'coModerators',
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

const requireAuth = (restrictUnderReview = false) => async (req, res, next) => {
    try {
        const { accessToken } = req.cookies
        if (!accessToken) {
            throw new Error("cookie has been expired");
        }
        const decodedAccessToken = jwt.verify(accessToken, process.env.JWT_SECRET)
        const now = Math.floor((new Date()).getTime() / 1000)
        if (now >= decodedAccessToken.exp)
            throw new Error("Cookie Expired");

        const user = await UserModel.findOne({
            email: decodedAccessToken.email
        })
            .select("+token")
        if (!user)
            throw new Error("Unregistered user");

        if (!(user.token))
            throw new Error("Invalid cookie");

        if (user.status === 'blocked') {
            throw new Error("User is blocked");
        }

        if (restrictUnderReview && user.status === 'review') {
            throw new Error("Unable to use under review")
        }

        const decodedUserToken = jwt.verify(user.token, process.env.JWT_SECRET)

        if (decodedUserToken.email !== decodedAccessToken.email)
            throw new Error("Invalid cookie");

        if (now >= decodedUserToken.exp)
            throw new Error("server side cookie has been expired.");

        const newToken = await user.generateAuthToken()
        res.cookie('accessToken', newToken, authCookieOptions());

        req.user = {
            userId: user._id.toString(),
            ...user._doc,
            password: null,
            token: null
        }
        next();
    } catch (err) {
        console.log(err);
        return res.status(401).send(err.message);
    }
};

const customerAuth = (restrictUnderReview = false) => async (req, res, next) => {
    try {

        const { accessToken } = req.cookies
        if (!accessToken) {
            throw new Error("cookie has been expired");
        }
        const decodedAccessToken = jwt.verify(accessToken, process.env.JWT_SECRET)
        const now = Math.floor((new Date()).getTime() / 1000)
        if (now >= decodedAccessToken.exp)
            throw new Error("Cookie Expired");

        const user = await UserModel.findOne({
            email: decodedAccessToken.email
        })
            .select("+token")

        if (!user)
            throw new Error("Unregistered user");

        if (user.role !== 'customer')
            throw new Error("No customer permission")

        if (!(user.token))
            throw new Error("Invalid cookie");

        if (user.status === 'blocked') {
            throw new Error("User is blocked");
        }

        if (restrictUnderReview && user.status === 'review') {
            throw new Error("Unable to use under review")
        }

        const decodedUserToken = jwt.verify(user.token, process.env.JWT_SECRET)

        if (decodedUserToken.email !== decodedAccessToken.email)
            throw new Error("Invalid cookie");

        if (now >= decodedUserToken.exp)
            throw new Error("server side cookie has been expired.");

        const newToken = await user.generateAuthToken()
        res.cookie('accessToken', newToken, authCookieOptions());
        req.user = {
            userId: user._id.toString(),
            ...user._doc,
            password: null,
            token: null
        }
        next();
    } catch (err) {
        console.log(err);
        return res.status(401).send(err.message);
    }
};

const expertAuth = (restrictUnderReview = false) => async (req, res, next) => {
    try {

        const { accessToken } = req.cookies
        if (!accessToken) {
            throw new Error("cookie has been expired");
        }
        const decodedAccessToken = jwt.verify(accessToken, process.env.JWT_SECRET)
        const now = Math.floor((new Date()).getTime() / 1000)
        if (now >= decodedAccessToken.exp)
            throw new Error("Cookie Expired");

        const user = await UserModel.findOne({
            email: decodedAccessToken.email
        })
            .select("+token")

        if (!user)
            throw new Error("Unregistered user");

        if (user.role !== 'expert')
            throw new Error("No expert permission")

        if (!(user.token))
            throw new Error("Invalid cookie");

        if (user.status === 'blocked') {
            throw new Error("User is blocked");
        }

        if (restrictUnderReview && user.status === 'review') {
            throw new Error("Unable to use under review")
        }

        const decodedUserToken = jwt.verify(user.token, process.env.JWT_SECRET)

        if (decodedUserToken.email !== decodedAccessToken.email)
            throw new Error("Invalid cookie");

        if (now >= decodedUserToken.exp)
            throw new Error("server side cookie has been expired.");

        const newToken = await user.generateAuthToken()
        res.cookie('accessToken', newToken, authCookieOptions());
        req.user = {
            userId: user._id.toString(),
            ...user._doc,
            password: null,
            token: null
        }
        next();
    } catch (err) {
        console.log(err);
        return res.status(401).send(err.message);
    }
};

const adminAuth = async (req, res, next) => {
    try {

        const { accessToken } = req.cookies
        if (!accessToken) {
            throw new Error("cookie has been expired");
        }
        const decodedAccessToken = jwt.verify(accessToken, process.env.JWT_SECRET)
        const now = Math.floor((new Date()).getTime() / 1000)
        if (now >= decodedAccessToken.exp)
            throw new Error("Cookie Expired");

        const user = await UserModel.findOne({
            email: decodedAccessToken.email
        })
            .select("+token")

        if (!user)
            throw new Error("Unregistered user");

        if (user.role !== 'admin')
            throw new Error("No admin permission")

        if (!(user.token))
            throw new Error("Invalid cookie");

        const decodedUserToken = jwt.verify(user.token, process.env.JWT_SECRET)

        if (decodedUserToken.email !== decodedAccessToken.email)
            throw new Error("Invalid cookie");

        if (now >= decodedUserToken.exp)
            throw new Error("server side cookie has been expired.");

        const newToken = await user.generateAuthToken()
        res.cookie('accessToken', newToken, authCookieOptions());
        req.user = {
            userId: user._id.toString(),
            ...user._doc,
            password: null,
            token: null
        }
        next();
    } catch (err) {
        console.log(err);
        return res.status(401).send(err.message);
    }
};

module.exports = {
    requireAuth,
    customerAuth,
    expertAuth,
    getFullUserData,
    adminAuth
};
