import { Request, Response } from 'express';
const User = require("../models/User");
const PendingUser = require("../models/PendingUser");
const jwt = require("jsonwebtoken");
const PendingLogin = require("../models/PendingLogin");
const PendingPasswordReset = require("../models/PendingPasswordReset");
const Keyword = require("../models/Keyword")
const Service = require("../models/Service")
const bcrypt = require("bcryptjs");
const fs = require('fs')
const path = require('path');
const { getFullUserData } = require("../middlewares/requireAuth");
const { createGeneralChatAndJoinGlobalChat } = require("./groupChat.controller");
const { checkTitleNameInvalid } = require('../services/global')
const { sendEmailNewUserAccountApproval } = require('../services/notifications')
import { v4 as uuidv4 } from 'uuid';
import { syncUserToRocketChat } from '../services/rocketchat.service';
const utils = require('../services/utils')
const randomize = require('randomatic');
const Event = require("../models/Event");
const ContactedUs = require("../models/ContactedUs");
const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { uploadImageToStorage } = require("../services/imageUploadService");
const {
    pickUploadedProfileFilename,
    normalizeProfileImageRef,
} = require("../utils/profileImageFilename");
import {
    AUTH_INVALID_CREDENTIALS,
    AUTH_USER_BLOCKED,
    AUTH_EMAIL_MISSING,
    AUTH_OAUTH_LOGIN_REQUIRED,
    AUTH_LOGIN_REQUEST_EXPIRED,
    AUTH_INCORRECT_CODE,
    AUTH_CODE_EXPIRED,
    AUTH_PASSWORD_RESET_EXPIRED,
    AUTH_PASSWORD_RESET_INVALID_CODE,
    AUTH_PASSWORD_WEAK,
    AUTH_PASSWORD_SAME_AS_OLD,
    AUTH_REGISTRATION_NOT_FOUND,
    AUTH_VERIFICATION_EXPIRED,
    AUTH_INVALID_VERIFICATION_CODE,
    AUTH_USER_NOT_FOUND,
    AUTH_PROFILE_PHOTO_REQUIRED,
    AUTH_PROFILE_PHOTO_UPLOAD_FAILED,
    AUTH_OAUTH_PASSWORD_RESET_UNAVAILABLE,
    AUTH_EMAIL_NOT_FOUND,
} from '../utils/authUserFacingCopy';
import { HTTP_GENERIC_ERROR } from '../utils/httpUserFacingCopy';


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const normalizeSpacesHost = (v: string = ''): string =>
    String(v || '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/g, '')
        .trim();

const spacesEndpointHost = normalizeSpacesHost(process.env.DO_SPACES_ENDPOINT || '');
const spacesPublicBaseHost = normalizeSpacesHost(process.env.DO_SPACES_PUBLIC_BASE_URL || '');

const doEndpoint = spacesEndpointHost ? `https://${spacesEndpointHost}` : undefined;

const s3 = new S3Client({
    endpoint: doEndpoint,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || '',
        secretAccessKey: process.env.DO_SPACES_SECRET || '',
    },
    forcePathStyle: false,
});

const buildSpacesPublicUrl = (key: string): string => {
    const bucket = String(process.env.DO_SPACES_BUCKET || '').trim();
    if (!bucket) return '';
    // Supports either:
    // - DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
    // - DO_SPACES_PUBLIC_BASE_URL=wisdomlinked-store.nyc3.digitaloceanspaces.com (or full https URL)
    const endpointAlreadyBucketHost = spacesEndpointHost.startsWith(`${bucket}.`);
    const host =
        spacesPublicBaseHost ||
        (endpointAlreadyBucketHost ? spacesEndpointHost : `${bucket}.${spacesEndpointHost}`);
    return host ? `https://${host}/${key}` : '';
};

const checkRateLimit = (record: any) => {
    if (!record) return null;
    if (record.lockUntil && record.lockUntil > new Date()) {
        const minutes = Math.ceil((record.lockUntil.getTime() - new Date().getTime()) / 60000);
        return `Too many failed attempts. Please try again in ${minutes} minutes.`;
    }
    return null;
}

const handleFailedAttempt = async (record: any) => {
    if (!record) return;
    record.failedAttempts = (record.failedAttempts || 0) + 1;
    if (record.failedAttempts >= 50) {
        record.lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    } else if (record.failedAttempts >= 6) {
        record.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    }
    await record.save();
}

const resetFailedAttempts = async (record: any) => {
    if (!record) return;
    if (record.failedAttempts > 0 || record.lockUntil) {
        record.failedAttempts = 0;
        record.lockUntil = null;
        await record.save();
    }
}

const getUniqueConfirmCode = async () => {
    try {
        let isDuplicated = true, confirmCode;
        console.log('[getUniqueConfirmCode] Generating unique code...');
        while (isDuplicated) {
            confirmCode = uuidv4();
            if (!confirmCode) {
                console.error('[getUniqueConfirmCode] uuidv4() returned undefined, using fallback!');
                confirmCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            }
            isDuplicated = await PendingUser.findOne({ 'confirmCode': { '$regex': `^${confirmCode}$`, $options: 'i' } });
        }
        console.log('[getUniqueConfirmCode] Generated:', confirmCode);
        return confirmCode;
    } catch (error) {
        console.error('[getUniqueConfirmCode] CRITICAL ERROR:', error.message);
        // Return a random string as last resort if Mongo fails or uuid fails
        return Math.random().toString(36).substring(2, 15);
    }
}

export const getArrayField = (req: Request, key: string) => {
    let val = req.body[key] || req.body[`${key}[]`];
    if (!val) return null;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        if (val.trim().startsWith('[') && val.trim().endsWith(']')) {
            try { return JSON.parse(val); } 
            catch (e) {
                try {
                    const innerString = val.trim().slice(1, -1);
                    const items = innerString.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
                    return items.filter(i => i.length > 0);
                } catch (err) { return [val]; }
            }
        }
        return [val]; 
    }
    return [val];
};

const getKeywordsAndServices = async (req: Request, res: Response) => {
    try {
        const keywords = await Keyword.find()
        const services = await Service.find()
        return res.status(200).json({
            keywords: keywords,
            services: services,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const register = async (req: Request, res: Response) => {

    try {
        const safeParse = (val) => {
            if (!val) return null;
            try {
                // Attempt to parse standard JSON
                return JSON.parse(val);
            } catch (e) {
                // If it fails, check if it's a string looking like an array (common with multipart form data) e.g. "['Study abroad']" or "[1, 2]"
                if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
                    try {
                        // Very naive approach to extract items inside the brackets.
                        // Ideally the frontend should send proper JSON stringified arrays or multiple form fields.
                        // Here we remove the brackets, split by comma, and clean up quotes.
                        const innerString = val.slice(1, -1);
                        // This regex handles single or double quotes, and trims whitespace
                        const items = innerString.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
                        // Filter out empty items in case it was "[]"
                        return items.filter(i => i.length > 0);
                    } catch (innerError) {
                        return val;
                    }
                }
                return val;
            }
        };

        const role = safeParse(req.body.role)
        const username = safeParse(req.body.username)
        const title = safeParse(req.body.title)
        const description = safeParse(req.body.description)
        const country = safeParse(req.body.country)
        const state = safeParse(req.body.state)
        const city = safeParse(req.body.city)
        const phoneNumber = safeParse(req.body.phoneNumber)
        const email = safeParse(req.body.email)
        const password = safeParse(req.body.password)
        const timeSlots = safeParse(req.body.timeSlots)
        const specialNote = safeParse(req.body.specialNote)
        const timeZone = safeParse(req.body.timeZone) || 'UTC'
        
        const keywords = getArrayField(req, 'keywords');
        const services = getArrayField(req, 'services');

        if (checkTitleNameInvalid('Username', username)) {
            return res.status(200).json({ status: 'FAIL', error: checkTitleNameInvalid('Username', username) });
        }

        // check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            const roleName = existingUser.role === 'customer' ? 'student' : (existingUser.role || 'user');
            return res.status(200).json({ status: 'FAIL', error: `This email is already registered as a ${roleName} account.` });
        }

        // check if user exists in pending list
        const existingPendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
        if (existingPendingUser) {
            // Delete the stale pending record and allow them to re-register to get un-stuck
            await PendingUser.deleteOne({ _id: existingPendingUser._id });
        }

        const file = req.file
        let resumeUrl = file ? await uploadFileToS3(file, 'resumes') : '';

        let _keywords = [];
        if (keywords && Array.isArray(keywords)) {
            for (let i = 0; i < keywords.length; i++) {
                // The new frontend passes an array of strings, while the old one passed objects. 
                // We handle both gracefully to prevent Mongoose 8 CastErrors.
                const keywordValue = typeof keywords[i] === 'string' ? keywords[i] : keywords[i].value;
                if (!keywordValue) continue;

                const existingKeyword = await Keyword.findOne({ value: { $regex: new RegExp(`^${keywordValue}$`, 'i') } });
                if (existingKeyword) {
                    _keywords.push(existingKeyword._id);
                } else {
                    const newKeyword = await Keyword.create({ value: keywordValue, label: keywordValue });
                    _keywords.push(newKeyword._id);
                }
            }
        }

        let _services = [];
        if (services && Array.isArray(services)) {
            for (let i = 0; i < services.length; i++) {
                const serviceValue = typeof services[i] === 'string' ? services[i] : services[i].value;
                if (!serviceValue) continue;

                // Match dynamically, because the frontend might send "Study abroad" 
                // but the DB has "Study abroad consultation"
                const existingService = await Service.findOne({ value: { $regex: new RegExp(`^${serviceValue}`, 'i') } });
                if (existingService) {
                    _services.push(existingService._id);
                } else {
                    const newService = await Service.create({ value: serviceValue, label: serviceValue });
                    _services.push(newService._id);
                }
            }
        }

        // encrypt password
        const encryptedPassword = await bcrypt.hash(String(password), 10);

        const confirmCode = await getUniqueConfirmCode()

        const newPendingUser = new PendingUser({
            username,
            title,
            description,
            services: _services,
            keywords: _keywords,
            country,
            state,
            city,
            phoneNumber,
            email: email.toLowerCase(),
            password: encryptedPassword,
            resume: resumeUrl,
            role,
            timeSlots,
            price: 10,
            confirmCode,
            timeZone,
            ...(specialNote && { specialNote })
        });

        // create user document and save in database
        await newPendingUser.save();

        // await createGeneralChatAndJoinGlobalChat(user._id)
        // user = await getFullUserData(user.email)
        // const token = await user.generateAuthToken()
        // user.token = null
        // user.password = null
        // res.cookie('accessToken', token, { maxAge: process.env.COOKIE_EXPIRED_TIME, httpOnly: true })

        // SEND EMAIL TO CUSTOMER


        let confirmLink = `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #234C6A 0%, #456882 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 2px;">WISDOMLINKED</h1>
            </div>
            <div style="padding: 32px 24px;">
                <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 12px 0;">Welcome! Verify Your Email</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">Thank you for registering with WisdomLinked. Please click the button below to verify your email address and activate your account.</p>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${process.env.FE_URL}/verification/${email}/${confirmCode}" style="display: inline-block; background: linear-gradient(135deg, #234C6A 0%, #456882 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">Verify My Email</a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">If you didn't create an account with WisdomLinked, you can safely ignore this email.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} WisdomLinked. All rights reserved.</p>
            </div>
        </div>`
        await utils.sendMagicLink(
            email,
            utils.getCurrentDateString(),
            confirmLink
        );

        res.status(200).json({
            status: 'SUCCESS',
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const healthCheck = async (req: Request, res: Response) => {
    try {
        res.status(200).send("OK Ready")
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR)
    }
}

const resendConfirmEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.body

        // check if user exists
        const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
        if (!pendingUser) {
            throw new Error('Pending registration request not found')
        }

        const lockError = checkRateLimit(pendingUser);
        if (lockError) {
            return res.status(200).json({ status: 'FAIL', error: lockError });
        }

        // SEND EMAIL TO CUSTOMER
        let confirmLink = `<div>Verify your registration to Wisdom Linked by clicking the confirmation link below:<br/><a href="${process.env.FE_URL}/verification/${email}/${pendingUser.confirmCode}">Verify Email</a></div>`
        await utils.sendMagicLink(
            // process.env.NODE_ENV === 'development' ? 'varunsahni10134@gmail.com' : email,
            email,
            utils.getCurrentDateString(),
            confirmLink
        );

        res.status(200).json({
            status: 'SUCCESS'
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const verifyRegistration = async (req: Request, res: Response) => {
    try {
        const { email, confirmCode } = req.body

        // check if user exists
        const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
        if (!pendingUser) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_REGISTRATION_NOT_FOUND });
        }

        const lockError = checkRateLimit(pendingUser);
        if (lockError) {
            return res.status(200).json({ status: 'FAIL', error: lockError });
        }

        if (pendingUser.confirmCode !== confirmCode) {
            await handleFailedAttempt(pendingUser);
            return res.status(200).json({ status: 'FAIL', error: AUTH_INVALID_VERIFICATION_CODE });
        }

        await resetFailedAttempts(pendingUser);

        if ((new Date().getTime() - pendingUser.updatedAt.getTime()) >= 24 * 3600 * 1000) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_VERIFICATION_EXPIRED });
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
            email: email.toLowerCase(),
            password: pendingUser.password,
            resume: pendingUser.resume,
            role: pendingUser.role,
            timeSlots: pendingUser.timeSlots,
            price: pendingUser.price,
            timeZone: pendingUser.timeZone || 'UTC',
            ...(pendingUser.specialNote && { specialNote: pendingUser.specialNote })
        });

        const user = await newUser.save()
        await createGeneralChatAndJoinGlobalChat(user._id)
        await pendingUser.deleteOne()

        // Sync user to Rocket.Chat (fire-and-forget)
        syncUserToRocketChat({
            email: user.email,
            username: user.username,
            name: user.username,
        })
            .then((rcUserId) => {
                if (!rcUserId) {
                    console.warn('RC sync returned no user id (registration):', user.email);
                }
            })
            .catch(err => console.error('RC sync failed (registration):', err.message));

        //
        sendEmailNewUserAccountApproval(user.username)

        const token = jwt.sign(
            { email: user.email.toString() },
            process.env.JWT_SECRET,
            { expiresIn: process.env.COOKIE_EXPIRED_TIME || '24h' }
        );
        user.token = token;
        await user.save();
        
        user.token = null;
        user.password = null;
        
        res.cookie('accessToken', token, {
            maxAge: Number(process.env.COOKIE_EXPIRED_TIME) || 86400000,
            httpOnly: true
        });


        res.status(200).json({
            status: 'SUCCESS',
            userDetails: user
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const checkVerificationStatus = async (req: Request, res: Response) => {
    try {
        const email = String(req.query.email || '');
        if (!email) return res.status(200).json({ status: 'FAIL', error: AUTH_EMAIL_MISSING });

        // If user is in User collection, they are verified
        const user = await getFullUserData(email);
        if (user) {
            const token = jwt.sign(
                { email: user.email.toString() },
                process.env.JWT_SECRET,
                { expiresIn: process.env.COOKIE_EXPIRED_TIME || '24h' }
            );
            user.token = token;
            await user.save();
            
            user.token = null;
            user.password = null;

            res.cookie('accessToken', token, {
                maxAge: Number(process.env.COOKIE_EXPIRED_TIME) || 86400000,
                httpOnly: true
            });

            return res.status(200).json({ status: 'VERIFIED', userDetails: user });
        }

        // If in PendingUser, still pending
        const pending = await PendingUser.findOne({ email: email.toLowerCase() });
        if (pending) {
            return res.status(200).json({ status: 'PENDING' });
        }

        return res.status(200).json({ status: 'NOT_FOUND' });
    } catch (err: any) {
        console.error(err);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await getFullUserData(email)
        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_INVALID_CREDENTIALS });
        }

        if (!user.password) {
            const provider = user.oauthProvider ? (user.oauthProvider.charAt(0).toUpperCase() + user.oauthProvider.slice(1)) : 'Google';
            return res.status(200).json({ status: 'FAIL', error: AUTH_OAUTH_LOGIN_REQUIRED(provider) });
        }

        const passwordsMatch = await bcrypt.compare(String(password), user.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_INVALID_CREDENTIALS });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: AUTH_USER_BLOCKED });
        }

        // const code = randomize('0', 6)
        const code = "123456"

        let loginRequest = await PendingLogin.findOne({ email: { $regex: new RegExp(`^${utils.escapeRegExp(email)}$`, 'i') } })
        if (!loginRequest) {
            loginRequest = new PendingLogin({
                email,
                code,
            })
        } else {
            const lockError = checkRateLimit(loginRequest);
            if (lockError) {
                return res.status(200).json({ status: 'FAIL', error: lockError });
            }
            loginRequest.code = code
            loginRequest.validUntil = new Date(Date.now() + 60 * 1000)
        }
        try {
            await loginRequest.save()
        } catch (err) {
            console.error("Unable to save login request: ", err.message)
        }

        let text = `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #234C6A 0%, #456882 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 2px;">WISDOMLINKED</h1>
            </div>
            <div style="padding: 32px 24px;">
                <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 12px 0;">Login Verification</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">Use the code below to verify your login to WisdomLinked. This code will expire in 60 seconds.</p>
                <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 16px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #234C6A;">${code}</span>
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">If you didn't attempt to log in, please secure your account by changing your password immediately.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} WisdomLinked. All rights reserved.</p>
            </div>
        </div>`
        await utils.sendOTP(
            email,
            utils.getCurrentDateString(),
            text
        );

        return res.status(200).json({
            status: 'SUCCESS',
        });

    } catch (err) {
        console.error(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const confirmLoginByCode = async (req: Request, res: Response) => {
    try {

        const { email, password, code } = req.body;
        const loginRequest = await PendingLogin.findOne({ email: { $regex: new RegExp(`^${utils.escapeRegExp(email)}$`, 'i') } })
        if (!loginRequest) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_LOGIN_REQUEST_EXPIRED });
        }

        const lockError = checkRateLimit(loginRequest);
        if (lockError) {
            return res.status(200).json({ status: 'FAIL', error: lockError });
        }

        if (loginRequest.code !== Number(code)) {
            await handleFailedAttempt(loginRequest);
            return res.status(200).json({ status: 'FAIL', error: AUTH_INCORRECT_CODE });
        }

        await resetFailedAttempts(loginRequest);

        if ((new Date() >= loginRequest.validUntil)) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_CODE_EXPIRED });
        }

        const user = await getFullUserData(email)

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_INVALID_CREDENTIALS });
        }
        const passwordsMatch = await bcrypt.compare(String(password), user.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_INVALID_CREDENTIALS });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: AUTH_USER_BLOCKED });
        }

        await loginRequest.deleteOne()

        // Timezone is captured once at signup (register/verifyRegistration); logins never touch it.

        const token = await user.generateAuthToken()
        user.token = null
        user.password = null
        res.cookie('accessToken', token, { maxAge: Number(process.env.COOKIE_EXPIRED_TIME) || 86400000, httpOnly: true })

        // Ensure user exists in Rocket.Chat (fire-and-forget)
        syncUserToRocketChat({
            email: user.email,
            username: user.username,
            name: user.username,
        })
            .then((rcUserId) => {
                if (!rcUserId) {
                    console.warn('RC sync returned no user id (login):', user.email);
                }
            })
            .catch(err => console.error('RC sync failed (login):', err.message));


        return res.status(200).json({
            status: "SUCCESS",
            userDetails: user
        });

    } catch (err) {
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const passwordResetRequest = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ email: { $regex: new RegExp(`^${utils.escapeRegExp(email)}$`, 'i') } }).select('+password')

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_EMAIL_NOT_FOUND });
        }

        if (!user.password) {
            const provider = user.oauthProvider ? (user.oauthProvider.charAt(0).toUpperCase() + user.oauthProvider.slice(1)) : 'Google';
            return res.status(200).json({ status: 'FAIL', error: AUTH_OAUTH_PASSWORD_RESET_UNAVAILABLE(provider) });
        }

        // const code = randomize('0', 6)
        const code = "123456"

        // The new password is supplied at confirm time (confirmPasswordResetByCode),
        // so it is optional here. When omitted we only (re)issue the OTP code.
        const encryptedPassword = password
            ? await bcrypt.hash(String(password), 10)
            : undefined;

        const pwdRequest = await PendingPasswordReset.findOne({ email: { $regex: new RegExp(`^${utils.escapeRegExp(email)}$`, 'i') } })
        if (!pwdRequest) {
            const newRequest = new PendingPasswordReset({
                email,
                ...(encryptedPassword ? { password: encryptedPassword } : {}),
                code
            })
            await newRequest.save()
        } else {
            const lockError = checkRateLimit(pwdRequest);
            if (lockError) {
                return res.status(200).json({ status: 'FAIL', error: lockError });
            }
            pwdRequest.code = code
            if (encryptedPassword) pwdRequest.password = encryptedPassword
            await pwdRequest.save()
        }

        let text = `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #234C6A 0%, #456882 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: 2px;">WISDOMLINKED</h1>
            </div>
            <div style="padding: 32px 24px;">
                <h2 style="color: #1e293b; font-size: 22px; margin: 0 0 12px 0;">Password Reset Request</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">We received a request to reset your WisdomLinked account password. Use the code below to proceed.</p>
                <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 16px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #234C6A;">${code}</span>
                </div>
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">This code expires in 60 seconds. If you didn't request a password reset, please ignore this email.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} WisdomLinked. All rights reserved.</p>
            </div>
        </div>`
        await utils.sendPasswordResetOTP(
            email,
            text
        );

        res.status(200).json({
            status: 'SUCCESS',
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const verifyPasswordResetOTP = async (req: Request, res: Response) => {
    try {
        const { email, code } = req.body;

        const pwdRequest = await PendingPasswordReset.findOne({ email: { $regex: new RegExp(`^${utils.escapeRegExp(email)}$`, 'i') } });
        if (!pwdRequest) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_PASSWORD_RESET_EXPIRED });
        }

        const lockError = checkRateLimit(pwdRequest);
        if (lockError) {
            return res.status(200).json({ status: 'FAIL', error: lockError });
        }

        if (pwdRequest.code !== Number(code)) {
            await handleFailedAttempt(pwdRequest);
            return res.status(200).json({ status: 'FAIL', error: AUTH_PASSWORD_RESET_INVALID_CODE });
        }

        await resetFailedAttempts(pwdRequest);

        if ((new Date().getTime() - pwdRequest.updatedAt.getTime()) >= 60 * 1000) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_CODE_EXPIRED });
        }

        return res.status(200).json({ status: 'SUCCESS' });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const confirmPasswordResetByCode = async (req: Request, res: Response) => {
    try {
        const { email, password, code } = req.body;

        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_PASSWORD_WEAK });
        }

        const request = await PendingPasswordReset.findOne({ email: { $regex: new RegExp(`^${utils.escapeRegExp(email)}$`, 'i') } })
        if (!request) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_PASSWORD_RESET_EXPIRED });
        }

        const lockError = checkRateLimit(request);
        if (lockError) {
            return res.status(200).json({ status: 'FAIL', error: lockError });
        }

        if (request.code !== Number(code)) {
            await handleFailedAttempt(request);
            return res.status(200).json({ status: 'FAIL', error: AUTH_INCORRECT_CODE });
        }

        await resetFailedAttempts(request);

        if ((new Date().getTime() - request.updatedAt.getTime()) >= 60 * 1000) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_CODE_EXPIRED });
        }

        const user = await getFullUserData(email)

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_INVALID_CREDENTIALS });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: AUTH_USER_BLOCKED });
        }

        const isSameAsOld = await bcrypt.compare(String(password), user.password);
        if (isSameAsOld) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_PASSWORD_SAME_AS_OLD });
        }

        const salt = await bcrypt.genSalt(10);
        const cryptPassword = await bcrypt.hash(password, salt);

        user.password = cryptPassword;
        await user.save()

        await request.deleteOne()

        return res.status(200).json({
            status: "SUCCESS"
        });

    } catch (err) {
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};

const getMe = async (req: any, res: Response) => {
    try {
        const { userId, email } = req.user
        const user = await getFullUserData(email)
        return res.status(200).json({
            me: {
                userId: user._id.toString(),
                ...user._doc,
                password: null,
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const updateMissedChats = async (req: any, res: Response) => {
    try {
        const { email } = req.user
        const { id, count } = req.body
        console.log(email, id, count)
        const me = await User.findOne({ email: email })
        let missedChats = me.missedChats || {}
        missedChats[id] = count
        await User.findOneAndUpdate({ email: email }, { missedChats: missedChats }, { new: true })
        return res.status(200).send('SUCCESS')
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const updateProfile = async (req: any, res: Response) => {
    try {
        const { email } = req.user
        
        const safeParse = (val) => {
            if (!val) return null;
            try { return JSON.parse(val); } catch (e) {
                if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
                    try {
                        const innerString = val.slice(1, -1);
                        const items = innerString.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
                        return items.filter(i => i.length > 0);
                    } catch (innerError) { return val; }
                }
                return val;
            }
        };

        const username = safeParse(req.body.username) || req.body.username;
        const title = safeParse(req.body.title) || req.body.title;
        const description = safeParse(req.body.description) || req.body.description;
        const image = safeParse(req.body.image) || req.body.image;
        const keywords = getArrayField(req, 'keywords') || safeParse(req.body.keywords) || req.body.keywords;
        const services = getArrayField(req, 'services') || safeParse(req.body.services) || req.body.services;
        const country = safeParse(req.body.country) || req.body.country;
        const state = safeParse(req.body.state) || req.body.state;
        const city = safeParse(req.body.city) || req.body.city;
        const phoneNumber = safeParse(req.body.phoneNumber) || req.body.phoneNumber;
        const price = safeParse(req.body.price) || req.body.price;
        const joinPopupBlocked = safeParse(req.body.joinPopupBlocked) || req.body.joinPopupBlocked;
        const appointmentDurationsRaw =
            getArrayField(req, 'appointmentDurations') ||
            safeParse(req.body.appointmentDurations) ||
            req.body.appointmentDurations;

        if (username && checkTitleNameInvalid('Username', username)) {
            throw new Error(checkTitleNameInvalid('Username', username))
        }

        const updates: Record<string, any> = {}
        if (username) {
            updates.username = username
        }
        if (title !== undefined && title !== null) {
            updates.title = title
        }
        if (description !== undefined && description !== null) {
            updates.description = description
        }
        const normalizedImage = normalizeProfileImageRef(image);
        if (normalizedImage) {
            updates.image = normalizedImage;
        }
        if (services && Array.isArray(services)) {
            let _services = [];
            for (let i = 0; i < services.length; i++) {
                const serviceValue = typeof services[i] === 'string' ? services[i] : services[i].value;
                if (!serviceValue) continue;

                const existingService = await Service.findOne({ value: { $regex: new RegExp(`^${serviceValue}`, 'i') } });
                if (existingService) {
                    _services.push(existingService._id);
                } else {
                    const newService = await Service.create({ value: serviceValue, label: serviceValue });
                    _services.push(newService._id);
                }
            }
            updates.services = _services;
        }

        if (price !== undefined && price !== null) {
            updates.price = price
        }

        if (appointmentDurationsRaw !== undefined && appointmentDurationsRaw !== null) {
            const { parseAppointmentDurationsInput } = require("../utils/appointmentDurations");
            updates.appointmentDurations = parseAppointmentDurationsInput(appointmentDurationsRaw);
        }
        
        const file = req.file
        if (file) {
            // If they had an old resume, delete it
            const me = await User.findOne({ email: email });
            if (me && me.resume) {
                const oldKey = me.resume.replace(`https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT.replace('https://', '')}/`, '');
                deleteFileFromS3(oldKey);
            }
            updates.resume = await uploadFileToS3(file, 'resumes');
        }

        if (keywords && Array.isArray(keywords)) {
            let _keywords = [];
            for (let i = 0; i < keywords.length; i++) {
                const keywordValue = typeof keywords[i] === 'string' ? keywords[i] : keywords[i].value;
                if (!keywordValue) continue;

                const existingKeyword = await Keyword.findOne({ value: { $regex: new RegExp(`^${keywordValue}$`, 'i') } });
                if (existingKeyword) {
                    _keywords.push(existingKeyword._id);
                } else {
                    const newKeyword = await Keyword.create({ value: keywordValue, label: keywordValue });
                    _keywords.push(newKeyword._id);
                }
            }
            updates.keywords = _keywords;
        }
        if (country !== undefined && country !== null) {
            updates.country = country
        }
        if (state !== undefined && state !== null) {
            updates.state = state
        }
        if (city !== undefined && city !== null) {
            updates.city = city
        }
        if (phoneNumber !== undefined && phoneNumber !== null) {
            updates.phoneNumber = phoneNumber
        }
        if (joinPopupBlocked !== undefined && joinPopupBlocked !== null) {
            updates.joinPopupBlocked = joinPopupBlocked
        }
        if (req.body.specialNote !== undefined && req.body.specialNote !== null) {
            const raw =
                typeof req.body.specialNote === 'string'
                    ? req.body.specialNote
                    : String(req.body.specialNote);
            updates.specialNote = raw.slice(0, 5000);
        }

        const timeZone = safeParse(req.body.timeZone) || req.body.timeZone;
        if (timeZone && typeof timeZone === 'string') {
            updates.timeZone = timeZone;
        }

        const notificationPreferences =
            safeParse(req.body.notificationPreferences) || req.body.notificationPreferences;
        if (notificationPreferences && typeof notificationPreferences === 'object') {
            const prefKeys = ['email', 'push', 'seminarReminders', 'sessionReminders', 'marketing'];
            for (const key of prefKeys) {
                if (typeof notificationPreferences[key] === 'boolean') {
                    updates[`notificationPreferences.${key}`] = notificationPreferences[key];
                }
            }
        }
        // synthetic wechat_<id>@wechat.local placeholder email (WeChat returns no email).
        // Allow them to set a real one here. Only placeholder accounts may change their
        // email via this endpoint, so normal users can't repoint their account.
        const { isWeChatPlaceholderEmail } = require('../services/wechatOAuth');
        const newEmailRaw = safeParse(req.body.email) || req.body.email;
        if (
            typeof newEmailRaw === 'string' &&
            newEmailRaw.trim() &&
            isWeChatPlaceholderEmail(email) &&
            !isWeChatPlaceholderEmail(newEmailRaw)
        ) {
            const newEmail = newEmailRaw.trim().toLowerCase();
            if (!/^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)+$/.test(newEmail)) {
                return res.status(400).json({ status: 'FAIL', error: 'Please enter a valid email address.' });
            }
            // v1: block when the email already belongs to another account (no auto-merge).
            const existing = await User.findOne({ email: { $eq: newEmail } });
            if (existing) {
                return res.status(409).json({
                    status: 'FAIL',
                    error: 'This email is already in use. Please sign in to that account instead.',
                });
            }
            updates.email = newEmail;
        }

        // [User Model] -- add more updating fields based on the user model
        await User.findOneAndUpdate({ email: email }, updates, { new: true })

        // If the email changed (WeChat bind-email), the email-keyed session token is now
        // stale — re-issue it so the user stays logged in under the new email.
        const updatedEmail = updates.email && updates.email !== email ? updates.email : email;
        const safeUpdatedEmail = typeof updatedEmail === 'string' ? updatedEmail.trim() : null;
        if (safeUpdatedEmail && safeUpdatedEmail !== email) {
            const updatedUser = await User.findOne({ email: { $eq: safeUpdatedEmail } });
            if (updatedUser) {
                const newToken = await updatedUser.generateAuthToken();
                res.cookie('accessToken', newToken, {
                    maxAge: Number(process.env.COOKIE_EXPIRED_TIME) || 86400000,
                    httpOnly: true,
                });
            }
        }

        const result = await getFullUserData(updatedEmail)
        result.password = null
        result.token = null
        return res.status(200).json({
            result: result,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const updateResume = async (req: Request, res: Response) => {
    try {
        const email = !req.body.email ? null : JSON.parse(req.body.email)
        // check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: AUTH_USER_NOT_FOUND });
        }

        const file = req.file
        if (file) {
            // Delete old resume from DO Spaces if it exists
            if (user.resume) {
                const oldKey = user.resume.replace(`https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT.replace('https://', '')}/`, '');
                deleteFileFromS3(oldKey);
            }

            // Update user document
            const resumeUrl = await uploadFileToS3(file, 'resumes');
            user.resume = resumeUrl;
            await user.save()
        }
        return res.status(200).json({
            status: 'SUCCESS',
            newResume: user.resume,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const uploadChatFile = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        const chatFileUrl = await uploadFileToS3(file, 'chatFiles');
        return res.status(200).json({
            status: 'SUCCESS',
            chatFile: chatFileUrl,
            fileName: file.originalname,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const uploadFileToS3 = async (file: any, folder: string) => {
    try {
        if (!file || !file.buffer) throw new Error('No file payload to upload');
        const timestamp = Date.now();
        const safeName = String(file.originalname || 'file')
            .replace(/[^\w.\-]/g, '_')
            .replace(/_+/g, '_');
        const key = `${folder}/${timestamp}_${safeName}`;

        await s3.send(new PutObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
            Body: file.buffer,
            ACL: 'public-read',
            ContentType: file.mimetype,
        }));

        const fileUrl = buildSpacesPublicUrl(key);
        if (!fileUrl) throw new Error('DO Spaces public URL is not configured');
        return fileUrl;
    } catch (err: any) {
        console.log('Error uploading file', err.message);
        throw new Error(err.message || 'Could not upload file');
    }
}

const deleteFileFromS3 = async (key: string) => {
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
        }));
    } catch (err: any) {
        console.log('Error deleting file', err.message);
    }
}

const handleSubmit = async (req: Request, res: Response) => {
    try {
        const email = !req.body.email ? null : JSON.parse(req.body.email)
        const name = !req.body.name ? null : JSON.parse(req.body.name)
        const demand = !req.body.demand ? null : JSON.parse(req.body.demand)

        const file = req.file
        const directory = path.join(__dirname, '../uploads/docs');

        // Check if the directory exists
        if (!fs.existsSync(directory)) {
            // If the directory doesn't exist, create it
            fs.mkdirSync(directory, { recursive: true });
        }
        const filePath = path.join(__dirname, '../uploads/docs', `${new Date().getTime()}_${file.originalname}`);
        fs.writeFileSync(filePath, file.buffer);

        res.status(200).send('SUCCESS')
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}

const leaveFeedback = async (req: any, res: Response) => {
    try {
        const { userId, role } = req.user
        const { eventId = null, groupChatId = null, eventType, start, end, totalTimeSpent, otherUserId, description, rating } = req.body

        const otherUser = await User.findById(otherUserId)

        if (!otherUser) {
            throw new Error("No user found for feedback")
        }

        if (role === otherUser.role) {
            throw new Error('Not available to leave feedback to the same role.')
        }

        otherUser.feedbacks.push({
            eventId,
            groupChatId,
            eventType,
            start,
            end,
            totalTimeSpent,
            rating,
            description,
            otherUserId: userId,
            date: new Date()
        })

        let userRating = 0
        for (let i = 0; i < otherUser.feedbacks.length; i++) {

            userRating += otherUser.feedbacks[i].rating
        }
        userRating = parseFloat((rating / otherUser.feedbacks.length).toFixed(2))

        otherUser.rating = userRating

        await otherUser.save()

        res.status(200).send('SUCCESS')
    } catch (err) {
        console.log(err)
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
}


const getTimeZone = async (req: Request, res: Response) => {
    const { lat, lng } = req.query
    const apiKey = process.env.TIMEZONE_API_KEY;
    try {
        const response = await fetch(`https://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=position&lat=${lat}&lng=${lng}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.status === 'OK') {

        } else {
            console.error('Error:', data.message);
        }
        res.status(200).send({ response: data })
    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(500).send(HTTP_GENERIC_ERROR);
    }
};


const submitContactForm = async (req: Request, res: Response) => {
    try {
        const { name, email, countryCode, contactNumber, issue } = req.body;

        // Basic validation check
        if (!name || !email) {
            return res.status(400).json({ message: "Name and Email are required." });
        }

        // Create and save new contact entry
        const contactEntry = new ContactedUs({
            name,
            email,
            countryCode,
            contactNumber,
            issue,
        });
        await contactEntry.save();

        // Send email notification to admin
        try {
            await utils.sendContactDetails('admin@wisdomlinked.com', name, email, issue);
        } catch (emailErr: any) {
            console.error('Contact form email failed:', emailErr.message);
        }

        return res.status(200).json({ message: "Contact form submitted successfully." });
    } catch (error) {
        console.error("Error saving contact form:", error);
        return res.status(500).json({ message: "An error occurred while submitting contact form." });
    }
};


const sendEmailToAdmin = async (req: Request, res: Response) => {
    try {
        const { message } = req.body;

        // Basic validation
        if (!message) {
            return res.status(400).json({
                status: "FAILED",
                message: "Message is required."
            });
        }

        const msg = {
            to: "admin@wisdomlinked.com",
            from: {
                name: "WisdomLinked Admin",
                email: "admin@wisdomlinked.com",
            },
            subject: "Message from WisdomLinked.com",
            text: message,
        };

        try {
            const response = await sgMail.send(msg);
            console.log("Email sent to admin via SendGrid:", response[0].statusCode);
            return res.status(200).json({
                status: "SUCCESS",
                message: "Email sent successfully.",
            });
        } catch (error) {
            console.error("Error sending email to admin via SendGrid:", error.message);
            return res.status(500).json({
                status: "FAILED",
                message: "Error sending email.",
            });
        }
    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({
            status: "FAILED",
            message: "An error occurred while sending email."
        });
    }
};

const logout = async (req: Request, res: Response) => {
    try {
        res.clearCookie('accessToken', {
            httpOnly: true,
            path: '/'
        });
        return res.status(200).json({
            status: "SUCCESS"
        });
    } catch (err) {
        return res.status(500).send("Internal Server Error");
    }
}

/** Multipart profile photo: upload to storage and persist filename on the authenticated user. */
const uploadProfilePhoto = async (req: any, res: Response) => {
    try {
        const { email } = req.user;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: AUTH_PROFILE_PHOTO_REQUIRED });
        }

        const uploadResult = await uploadImageToStorage(file);
        const filename = pickUploadedProfileFilename(uploadResult, file.originalname);
        if (!filename) {
            return res.status(500).json({
                error: AUTH_PROFILE_PHOTO_UPLOAD_FAILED,
                details: uploadResult,
            });
        }

        await User.findOneAndUpdate({ email }, { image: filename }, { new: true });
        const result = await getFullUserData(email);
        if (!result) {
            return res.status(404).json({ error: AUTH_USER_NOT_FOUND });
        }
        result.password = null;
        result.token = null;

        return res.status(200).json({
            result,
            filename,
            message: "Profile photo updated.",
        });
    } catch (err: any) {
        console.log("[uploadProfilePhoto]", err?.message || err);
        return res.status(500).json({ error: err?.message || "Failed to upload profile photo." });
    }
};

module.exports = {
    login,
    logout,
    register,
    getMe,
    updateMissedChats,
    updateProfile,
    uploadProfilePhoto,
    getKeywordsAndServices,
    handleSubmit,
    leaveFeedback,
    resendConfirmEmail,
    verifyRegistration,
    checkVerificationStatus,
    confirmLoginByCode,
    passwordResetRequest,
    verifyPasswordResetOTP,
    confirmPasswordResetByCode,
    updateResume,
    uploadChatFile,
    healthCheck,
    getTimeZone,
    submitContactForm,
    sendEmailToAdmin,
    uploadFileToS3,
}

