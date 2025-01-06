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
const { v4: uuidv4 } = require('uuid');
const utils = require('../services/utils')
const randomize = require('randomatic')

const getUniqueConfirmCode = async () => {
    try {
        let isDuplicated = true, confirmCode
        while (isDuplicated) {
            confirmCode = uuidv4()
            isDuplicated = await PendingUser.findOne({ 'confirmCode': { '$regex': `^${confirmCode}$`, $options: 'i' } })
        }
        return confirmCode
    } catch (error) {
        console.log('[getUniqueConfirmCode]', error.message)
    }
}

const getKeywordsAndServices = async (req, res) => {
    try {
        //console.log('OKOKOKOK')
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

const register = async (req, res) => {

    try {
        const role = !req.body.role ? null : JSON.parse(req.body.role)
        const username = !req.body.username ? null : JSON.parse(req.body.username)
        const title = !req.body.title ? null : JSON.parse(req.body.title)
        const description = !req.body.description ? null : JSON.parse(req.body.description)
        const keywords = !req.body.keywords ? null : JSON.parse(req.body.keywords)
        const services = !req.body.services ? null : JSON.parse(req.body.services)
        const country = !req.body.country ? null : JSON.parse(req.body.country)
        const state = !req.body.state ? null : JSON.parse(req.body.state)
        const city = !req.body.city ? null : JSON.parse(req.body.city)
        const phoneNumber = !req.body.phoneNumber ? null : JSON.parse(req.body.phoneNumber)
        const email = !req.body.email ? null : JSON.parse(req.body.email)
        const password = !req.body.password ? null : JSON.parse(req.body.password)
        const timeSlots = !req.body.timeSlots ? null : JSON.parse(req.body.timeSlots)

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
        let fileName = ''
        if (file) {
            const directory = path.join(__dirname, '../uploads/resumes');

            // Check if the directory exists
            if (!fs.existsSync(directory)) {
                // If the directory doesn't exist, create it
                fs.mkdirSync(directory, { recursive: true });
            }
            fileName = `${new Date().getTime()}_${file.originalname}`
            const filePath = path.join(__dirname, '../uploads/resumes', fileName);
            fs.writeFileSync(filePath, file.buffer);
        }

        let _keywords = []
        if (keywords?.length) {
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
        }

        // encrypt password
        const encryptedPassword = await bcrypt.hash(password, 10);

        const confirmCode = await getUniqueConfirmCode()

        const newPendingUser = new PendingUser({
            username,
            title,
            description,
            services,
            keywords: _keywords,
            country,
            state,
            city,
            phoneNumber,
            email: email.toLowerCase(),
            password: encryptedPassword,
            resume: file ? `uploads/resumes/${fileName}` : '',
            role,
            timeSlots,
            price: 10,
            confirmCode
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

const healthCheck = async (req, res) => {
    try {
        console.log("health check")
        res.status(200).send("OK Ready")
    } catch(err){
        console.log(err)
        return res.status(500).send(err.message)
    }
}

const resendConfirmEmail = async (req, res) => {
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

const verifyRegistration = async (req, res) => {
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
            email: email,
            password: pendingUser.password,
            resume: pendingUser.resume,
            role: pendingUser.role,
            timeSlots: pendingUser.timeSlots,
            price: pendingUser.price,
        });

        const user = await newUser.save()
        await createGeneralChatAndJoinGlobalChat(user._id)
        await pendingUser.delete()

        res.status(200).json({
            status: 'SUCCESS'
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await getFullUserData(email)

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }
        const passwordsMatch = await bcrypt.compare(password, user.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: "User is blocked" });
        }

        // const code = randomize('0', 6)
        const code = "123456"

        const loginRequest = await PendingLogin.findOne({ email: email })
        if (!loginRequest) {
            const newRequest = new PendingLogin({
                email,
                code
            })
            await newRequest.save()
        } else {
            loginRequest.code = code
            await loginRequest.save()
        }

        let text = `<div>Verify your login to TOE by the code <br/><b>${code}</b></div>`
        await utils.sendOTP(
            // process.env.NODE_ENV === 'development' ? 'varunsahni10134@gmail.com' : email,
            email,
            utils.getCurrentDateString(),
            text
        );

        return res.status(200).json({
            status: 'SUCCESS',
        });

    } catch (err) {
        return res.status(500).send(err.message);
    }
};

const confirmLoginByCode = async (req, res) => {
    try {
        const { email, password, code } = req.body;

        const loginRequest = await PendingLogin.findOne({ email: email })
        if (!loginRequest) {
            return res.status(200).json({ status: 'FAIL', error: "Login request not found" });
        }

        if (loginRequest.code !== Number(code)) {
            return res.status(200).json({ status: 'FAIL', error: "Incorrect code" });
        }

        if ((new Date().getTime() - loginRequest.updatedAt.getTime()) >= 60 * 1000) {
            return res.status(200).json({ status: 'FAIL', error: "Code was expired." });
        }

        const user = await getFullUserData(email)

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }
        const passwordsMatch = await bcrypt.compare(password, user.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid credentials. Please try again" });
        }

        if (user.status === 'blocked') {
            return res.status(200).json({ status: 'FAIL', error: "User is blocked" });
        }

        await loginRequest.delete()

        const token = await user.generateAuthToken()
        user.token = null
        user.password = null
        res.cookie('accessToken', token, { maxAge: process.env.COOKIE_EXPIRED_TIME, httpOnly: true })

        updateActiveRoomsOfUsers(user._id.toString(), user.groupChats)

        return res.status(200).json({
            status: "SUCCESS",
            userDetails: user
        });

    } catch (err) {
        return res.status(500).send(err.message);
    }
};

const passwordResetRequest = async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ email: email }).select('+password')

        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "Provided email not found." });
        }

        // const code = randomize('0', 6)
        const code = "123456"

        const encryptedPassword = await bcrypt.hash(password, 10);

        const pwdRequest = await PendingPasswordReset.findOne({ email: email })
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

const confirmPasswordResetByCode = async (req, res) => {
    try {
        const { email, password, code } = req.body;

        const request = await PendingPasswordReset.findOne({ email: email })
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

        const passwordsMatch = await bcrypt.compare(password, request.password);

        if (!passwordsMatch) {
            return res.status(200).json({ status: 'FAIL', error: "Invalid password. Please try again" });
        }

        user.password = request.password
        await user.save()

        await request.delete()

        return res.status(200).json({
            status: "SUCCESS"
        });

    } catch (err) {
        return res.status(500).send(err.message);
    }
};

const getMe = async (req, res) => {
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

const updateMissedChats = async (req, res) => {
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

const updateProfile = async (req, res) => {
    try {
        const { email } = req.user
        const { username, title, description, image, keywords, services, country, state, city, phoneNumber, price, joinPopupBlocked } = req.body;

        if (checkTitleNameInvalid('Username', username)) {
            throw new Error(checkTitleNameInvalid('Username', username))
        }

        const updates = {}
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

const updateResume = async (req, res) => {
    try {
        const email = !req.body.email ? null : JSON.parse(req.body.email)
        // check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({ status: 'FAIL', error: "User not found" });
        }

        const file = req.file
        if (file) {
            const directory = path.join(__dirname, '../uploads/resumes');

            // Check if the directory exists
            if (!fs.existsSync(directory)) {
                // If the directory doesn't exist, create it
                fs.mkdirSync(directory, { recursive: true });
            }
            const filename = `${new Date().getTime()}_${file.originalname}`
            const filePath = path.join(__dirname, '../uploads/resumes', filename);
            fs.writeFileSync(filePath, file.buffer);

            if (user.resume) {
                try {
                    // delete old resume file
                    fs.unlinkSync(path.join(__dirname, `../${user.resume}`))
                } catch (err) {
                    console.log(err.message)
                }
            }

            user.resume = `uploads/resumes/${filename}`
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

const handleSubmit = async (req, res) => {
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

const leaveFeedback = async (req, res) => {
    try {
        const { userId, role } = req.user
        const { otherUserId, description, rating } = req.body

        const otherUser = await User.findById(otherUserId)

        if (!otherUser) {
            throw new Error("No user found for feedback")
        }

        if (role === otherUser.role) {
            throw new Error('Not available to leave feedback to the same role.')
        }

        otherUser.feedbacks.push({
            rating,
            description,
            otherUserId: userId,
            date: new Date()
        })

        if (role === 'customer') {
            let rating = 0
            for (let i = 0; i < otherUser.feedbacks.length; i++) {
                console.log(otherUser.feedbacks[i])
                rating += otherUser.feedbacks[i].rating
            }
            rating = (rating / otherUser.feedbacks.length).toFixed(2)
            console.log(rating)
            otherUser.rating = rating
        }

        await otherUser.save()

        res.status(200).send('SUCCESS')
    } catch (err) {
        console.log(err)
        return res.status(500).send(err.message);
    }
}


const getTimeZone = async (req,res) => {
    const { lat, lng } = req.query
    const apiKey = process.env.TIMEZONE_API_KEY;
    console.log("inside gettimezone",req.body)
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
        res.status(200).send({response:data})
    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(500).send(error.message);
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
    healthCheck,
    getTimeZone
}
