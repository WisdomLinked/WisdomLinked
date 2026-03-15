import { Request, Response } from 'express';
const User = require("../models/User");
const PendingUser = require("../models/PendingUser");
const PendingLogin = require("../models/PendingLogin");
const PendingPasswordReset = require("../models/PendingPasswordReset");
const Keyword = require("../models/Keyword")
const Service = require("../models/Service")
const bcrypt = require("bcryptjs");
const fs = require('fs')
const path = require('path');
const { updateActiveRoomsOfUsers } = require("../socket/activeRooms");
const { getFullUserData } = require("../middlewares/requireAuth");
const { createGeneralChatAndJoinGlobalChat } = require("./groupChat.controller");
const { checkTitleNameInvalid } = require('../services/global')
const { sendEmailNewUserAccountApproval } = require('../services/notifications')
import { v4 as uuidv4 } from 'uuid';
const utils = require('../services/utils')
const randomize = require('randomatic');
const Event = require("../models/Event");
const ContactedUs = require("../models/ContactedUs");
const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const doEndpoint = (process.env.DO_SPACES_ENDPOINT || '').startsWith('https://') 
    ? process.env.DO_SPACES_ENDPOINT 
    : `https://${process.env.DO_SPACES_ENDPOINT}`;

const s3 = new S3Client({
    endpoint: doEndpoint,
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || '',
        secretAccessKey: process.env.DO_SPACES_SECRET || '',
    },
    forcePathStyle: false,
});

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
        return res.status(500).send(err.message);
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
        const keywords = safeParse(req.body.keywords)
        const services = safeParse(req.body.services)
        const country = safeParse(req.body.country)
        const state = safeParse(req.body.state)
        const city = safeParse(req.body.city)
        const phoneNumber = safeParse(req.body.phoneNumber)
        const email = safeParse(req.body.email)
        const password = safeParse(req.body.password)
        const timeSlots = safeParse(req.body.timeSlots)
        const specialNote = safeParse(req.body.specialNote)

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
        console.log('[register] Email:', email);
        console.log('[register] confirmCode:', confirmCode);
        console.log('[register] FE_URL:', process.env.FE_URL);

        let confirmLink = `<div>Verify your registration to TOE by the confirmation Link <br/>${process.env.FE_URL}/verification/${email}/${confirmCode}</div>`
        await utils.sendOTP(
            // process.env.NODE_ENV === 'development' ? 'varunsahni10134@gmail.com' : email,
            email,
            utils.getCurrentDateString(),
            confirmLink
        );

        res.status(200).json({
            status: 'SUCCESS',
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
};

const healthCheck = async (req: Request, res: Response) => {
    try {
        console.log("health check")
        res.status(200).send("OK Ready")
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message)
    }
}

const resendConfirmEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.body

        // check if user exists
        const pendingUser = await PendingUser.find({ email: email.toLowerCase() });
        if (!pendingUser) {
            throw new Error('Pending registration request not found')
        }

        // SEND EMAIL TO CUSTOMER
        let confirmLink = `<div>Verify your registration to TOE by the confirmation Link <br/>${process.env.FE_URL}/verification/${email}/${pendingUser.confirmCode}</div>`
        await utils.sendOTP(
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
        return res.status(500).send(err.message);
    }
};

const verifyRegistration = async (req: Request, res: Response) => {
    try {
        const { email, confirmCode } = req.body

        // check if user exists
        const pendingUser = await PendingUser.findOne({ email: email.toLowerCase(), confirmCode: confirmCode });
        if (!pendingUser) {
            return res.status(200).json({ status: 'FAIL', error: 'Pending registration request not found' });
        }

        if ((new Date().getTime() - pendingUser.updatedAt.getTime()) >= 24 * 3600 * 1000) {
            return res.status(200).json({ status: 'FAIL', error: "Verification email was expired." });
        }

        console.log(pendingUser, '/////')

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
            ...(pendingUser.specialNote && { specialNote: pendingUser.specialNote })
        });

        const user = await newUser.save()
        await createGeneralChatAndJoinGlobalChat(user._id)
        await pendingUser.deleteOne()

        //
        sendEmailNewUserAccountApproval(user.username)

        res.status(200).json({
            status: 'SUCCESS'
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
};

const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await getFullUserData(email)
        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }
        const passwordsMatch = await bcrypt.compare(String(password), user.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: "User is blocked" });
        }

        // const code = randomize('0', 6)
        const code = "123456"

        let loginRequest = await PendingLogin.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
        if (!loginRequest) {
            loginRequest = new PendingLogin({
                email,
                code,
            })
        } else {
            loginRequest.code = code
            loginRequest.validUntil = new Date(Date.now() + 60 * 1000)
        }
        try {
            await loginRequest.save()
        } catch (err) {
            console.error("Unable to save login request: ", err.message)
        }

        let text = `<div>Verify your login to TOE by the code <br/><b>${code}</b></div>`
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
        return res.status(500).send(err.message);
    }
};

const confirmLoginByCode = async (req: Request, res: Response) => {
    try {

        const { email, password, code, timeZone } = req.body;
        const loginRequest = await PendingLogin.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
        if (!loginRequest) {
            return res.status(200).json({ status: 'FAIL', error: "Login request not found or expired. Please request a new code" });
        }

        if (loginRequest.code !== Number(code)) {
            return res.status(200).json({ status: 'FAIL', error: "Incorrect code" });
        }

        if ((new Date() >= loginRequest.validUntil)) {
            return res.status(200).json({ status: 'FAIL', error: "Code expired. Please request a new code." });
        }

        const user = await getFullUserData(email)

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }
        const passwordsMatch = await bcrypt.compare(String(password), user.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: "User is blocked" });
        }

        await loginRequest.deleteOne()

        if (user.timeZone !== timeZone) {
            user.timeZone = timeZone
            await user.save()
        }

        const token = await user.generateAuthToken()
        user.token = null
        user.password = null
        res.cookie('accessToken', token, { maxAge: Number(process.env.COOKIE_EXPIRED_TIME) || 86400000, httpOnly: true })

        updateActiveRoomsOfUsers(user._id.toString(), user.groupChats)

        return res.status(200).json({
            status: "SUCCESS",
            userDetails: user
        });

    } catch (err) {
        return res.status(500).send(err.message);
    }
};

const passwordResetRequest = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).select('+password')

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Provided email not found." });
        }

        // const code = randomize('0', 6)
        const code = "123456"

        const encryptedPassword = await bcrypt.hash(String(password), 10);

        const pwdRequest = await PendingPasswordReset.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
        if (!pwdRequest) {
            const newRequest = new PendingPasswordReset({
                email,
                password: encryptedPassword,
                code
            })
            await newRequest.save()
        } else {
            pwdRequest.code = code
            pwdRequest.password = encryptedPassword
            await pwdRequest.save()
        }

        let text = `<div>Verify your reset password request to TOE by the code <br/><b>${code}</b></div>`
        await utils.sendOTP(
            // process.env.NODE_ENV === 'development' ? 'varunsahni10134@gmail.com' : email,
            email,
            utils.getCurrentDateString(),
            text
        );

        res.status(200).json({
            status: 'SUCCESS',
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
};

const confirmPasswordResetByCode = async (req: Request, res: Response) => {
    try {
        const { email, password, code } = req.body;

        const request = await PendingPasswordReset.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
        if (!request) {
            return res.status(200).json({ status: 'FAIL', error: "Password reset request not found" });
        }

        if (request.code !== Number(code)) {
            return res.status(200).json({ status: 'FAIL', error: "Incorrect code" });
        }

        if ((new Date().getTime() - request.updatedAt.getTime()) >= 60 * 1000) {
            return res.status(200).json({ status: 'FAIL', error: "Code was expired." });
        }

        const user = await getFullUserData(email)

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: "User is blocked" });
        }

        const passwordsMatch = await bcrypt.compare(String(password), request.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid password. Please try again" });
        }

        user.password = request.password
        await user.save()

        await request.deleteOne()

        return res.status(200).json({
            status: "SUCCESS"
        });

    } catch (err) {
        return res.status(500).send(err.message);
    }
};

const getMe = async (req: any, res: Response) => {
    try {
        const { userId, email } = req.user
        const user = await getFullUserData(email)
        updateActiveRoomsOfUsers(userId, user.groupChats)
        return res.status(200).json({
            me: {
                userId: user._id.toString(),
                ...user._doc,
                password: null,
            }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
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
        return res.status(500).send(err.message);
    }
}

const updateProfile = async (req: any, res: Response) => {
    try {
        const { email } = req.user
        const { username, title, description, image, keywords, services, country, state, city, phoneNumber, price, joinPopupBlocked } = req.body;

        if (checkTitleNameInvalid('Username', username)) {
            throw new Error(checkTitleNameInvalid('Username', username))
        }

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
        if (keywords) {
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
            updates.keywords = keywords
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
        // [User Model] -- add more updating fields based on the user model
        await User.findOneAndUpdate({ email: email }, updates, { new: true })
        const result = await getFullUserData(email)
        result.password = null
        result.token = null
        return res.status(200).json({
            result: result,
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}

const updateResume = async (req: Request, res: Response) => {
    try {
        const email = !req.body.email ? null : JSON.parse(req.body.email)
        // check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "User not found" });
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
        return res.status(500).send(err.message);
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
        return res.status(500).send(err.message);
    }
}

const uploadFileToS3 = async (file: any, folder: string) => {
    try {
        const timestamp = Date.now();
        const key = `${folder}/${timestamp}_${file.originalname}`;

        await s3.send(new PutObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
            Body: file.buffer,
            ACL: 'public-read',
            ContentType: file.mimetype,
        }));

        const fileUrl = `https://${process.env.DO_SPACES_BUCKET}.${(process.env.DO_SPACES_ENDPOINT || '').replace('https://', '')}/${key}`;
        return fileUrl;
    } catch (err: any) {
        console.log('Error uploading file', err.message);
        return '';
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
        return res.status(500).send(err.message);
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
            console.log(otherUser.feedbacks[i])
            userRating += otherUser.feedbacks[i].rating
        }
        userRating = parseFloat((rating / otherUser.feedbacks.length).toFixed(2))
        console.log(userRating)
        otherUser.rating = userRating

        await otherUser.save()

        res.status(200).send('SUCCESS')
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}


const getTimeZone = async (req: Request, res: Response) => {
    const { lat, lng } = req.query
    const apiKey = process.env.TIMEZONE_API_KEY;
    console.log("inside gettimezone", req.body)
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
            console.log('Time Zone:', data.zoneName);
            console.log('Local Time:', data.formatted);
        } else {
            console.error('Error:', data.message);
        }
        res.status(200).send({ response: data })
    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(500).send(error.message);
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

module.exports = {
    login,
    register,
    getMe,
    updateMissedChats,
    updateProfile,
    getKeywordsAndServices,
    handleSubmit,
    leaveFeedback,
    resendConfirmEmail,
    verifyRegistration,
    confirmLoginByCode,
    passwordResetRequest,
    confirmPasswordResetByCode,
    updateResume,
    uploadChatFile,
    healthCheck,
    getTimeZone,
    submitContactForm,
    sendEmailToAdmin,
    uploadFileToS3,
}

