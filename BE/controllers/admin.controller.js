const { uploadFileToS3} = require("./auth.controller")
const User = require("../models/User");
const Event = require("../models/Event");
const PaymentHistory = require("../models/PaymentHistory");
const Conversation = require("../models/Conversation");
const GroupChat = require("../models/GroupChat");
const Keyword = require("../models/Keyword");
const ContactedUs = require("../models/ContactedUs");
const PendingUser = require("../models/PendingUser");
const PendingLogin = require("../models/PendingLogin");
const sgMail = require("@sendgrid/mail");
const adminEmail = "admin@wisdomlinked.com";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const nodemailer = require("nodemailer");

const { getFullUserData } = require('../middlewares/requireAuth')
const {checkTitleNameInvalid} = require("../services/global");
const { sendEmailUserAccountApproved } = require("../services/notifications");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { refundPaymentIntent, checkPaymentIntentSucceeded } = require("./stripe.controller");
const { appendPaymentHistory } = require("./payment.controller");

const filterUsers = async (req, res) => {
    try {
        const { username, email, role, sortBy, sortOrder, numPerPage, currentPage } = req.body
        let query = User.find({ role: { $ne: 'admin' } })
        let countQuery = User.count({ role: { $ne: 'admin' } })

        if (username) {
            query.where({ username: { '$regex': username, '$options': 'i' } })
            countQuery.where({ username: { '$regex': username, '$options': 'i' } })
        }
        if (email) {
            query.where({ email: { '$regex': email, '$options': 'i' } })
            countQuery.where({ email: { '$regex': email, '$options': 'i' } })
        }
        if (role) {
            query.where({ role: role })
            countQuery.where({ role: role })
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
        return res.status(500).send(err.message);
    }
}

const filterPaymentHistories = async (req, res) => {
    try {
        const { email, sortBy, stripeMode, paymentType, dateFrom, dateTo, numPerPage, currentPage } = req.body
        const query = PaymentHistory.find()
        const countQuery = PaymentHistory.count()

        if (email) {
            const user = await User.findOne({ email: email })
            if (!user) {
                return res.status(200).json({
                    result: [],
                    totalCount: 0
                })
            }
            query.where({ [user.role]: user._id.toString() })
            countQuery.where({ [user.role]: user._id.toString() })
        } else {
            query.populate(['expert', 'customer'])
        }

        if (stripeMode) {
            query.where({ stripeMode })
            countQuery.where({ stripeMode })
        }

        if (paymentType) {
            query.where({ paymentType })
            countQuery.where({ paymentType })
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
        return res.status(500).send(err.message);
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
        return res.status(500).send(err.message);
    }
}

const updateProfileOfUser = async (req, res) => {
    try {
        const { email, username, title, description, image, keywords, services, country, state, city, phoneNumber, price, joinPopupBlocked, status } = req.body;
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
        if (status) {
            updates.status = status
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
            console.log(keywords, _keywords)
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

        await User.findOneAndUpdate({ email: email }, updates, { new: true })
        const result = await getFullUserData(email)
        if (status &&  status === 'active') {
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
        return res.status(500).send(err.message);
    }
}

const getDirectChatHistory = async (req, res) => {
    try {
        const { senderId, receiverId, currentPage } = req.body
        let conversation = await Conversation.findOne({
            participants: { $all: [receiverId, senderId] },
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
        return res.status(500).send(err.message);
    }
}

const getGroupChatHistory = async (req, res) => {
    try {
        const { groupChatId, currentPage } = req.body
        const groupChat = await GroupChat.findById(groupChatId).populate({
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
        return res.status(500).send(err.message);
    }
}

const getUserFeedbacks = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send("userId is required");
        }
        const user = await User.findById(userId);
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
            if(feedback.eventId){
                eventData = await Event.findById(feedback.eventId).select("title");
            }

            let groupChatData = null;
            if(feedback.groupChatId){
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
        return res.status(500).send(err.message);
    }
};

const getContactedUs = async (req, res) => {
    try {
        const { name, email, dateFrom, dateTo, sortBy, sortOrder, actioned } = req.body;

        let query = ContactedUs.find({});

        if (name) {
            query = query.where("name", new RegExp(name, "i"));
        }

        if (email) {
            query = query.where("email", new RegExp(email, "i"));
        }

        if (dateFrom && dateTo) {
            const fromDate = new Date(dateFrom);
            fromDate.setUTCHours(0, 0, 0, 0); // Start of the day
            const toDate = new Date(dateTo);
            toDate.setUTCHours(23, 59, 59, 999); // End of the day

            query = query.where("createdAt").gte(fromDate).lte(toDate);
        }

        if (actioned) {
            query = query.where("actioned", actioned);
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
        return res.status(500).send(err.message);
    }
};

const toggleActionedStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const contactEntry = await ContactedUs.findById(id);

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

        const html = `
        <p>Greetings of the day!</p>
        <p>Your account has been successfully registered at Wisdom Linked.</p>
        <p>Below are your credentials:</p>
        <p>Email ID: ${email}</p>
        <p>Password: ${password}</p>
        <p>We look forward to having you explore our services.</p>
        <p>Best Regards,<br>Team WisdomLinked</p>
        `;

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

        const html = `
        <p>Hello from WisdomLink.io</p>
        <p>Thank you for reaching out to us. Whether you're seeking academic guidance or offering your expertise, we appreciate your interest.</p>
        <p><strong>Here's our response to your inquiry:</strong></p>
        <p>${message}</p>
        <p>If you have any further questions or need more assistance, please let us know.</p>
        <p>Best Regards,<br>Team WisdomLinked</p>
        `;

        const msg = {
            to: email,
            from: {
              name: "WisdomLinked Admin",
              email: adminEmail, 
            },
            subject: "Message from WisdomLink.io",
            html,
            replyTo: email, 
          };

        try {
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

const getPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await PendingUser.find();
        return res.status(200).json(pendingUsers);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const getPendingLogins = async (req, res) => {
    try {
        const pendingLogins = await PendingLogin.find();
        return res.status(200).json(pendingLogins);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const deletePendingUser = async (req, res) => {
    try {
        const { pendingUserId } = req.body;
        if (!pendingUserId) {
            return res.status(400).json({ message: "pendingUserId is required" });
        }
        await PendingUser.findByIdAndDelete(pendingUserId);
        return res.status(200).json({ message: "Pending User deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const deletePendingLogin = async (req, res) => {
    try {
        const { pendingLoginId } = req.body;
        if (!pendingLoginId) {
            return res.status(400).json({ message: "pendingLoginId is required" });
        }
        await PendingLogin.findByIdAndDelete(pendingLoginId);
        return res.status(200).json({ message: "Pending Login deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const convertPendingUserToUserByAdmin = async (req, res) => {
    try {
        const { pendingUserId } = req.body;
        if (!pendingUserId) {
            return res.status(400).json({ message: "pendingUserId is required" });
        }

        const pendingUser = await PendingUser.findById(pendingUserId);
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

        await PendingUser.findByIdAndDelete(pendingUserId);

        return res.status(200).json({ message: "Pending User converted to a regular User successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const registerUserByAdmin = async (req, res) => {
    try {
        // Parse incoming fields
        const role = !req.body.role ? null : req.body.role;
        const username = !req.body.username ? null : req.body.username;
        const title = !req.body.title ? null : req.body.title;
        const description = !req.body.description ? null : req.body.description;
        const keywords = !req.body.keywords ? null : req.body.keywords;
        const services = !req.body.services ? null : req.body.services;
        const country = !req.body.country ? null : req.body.country;
        const state = !req.body.state ? null : req.body.state;
        const city = !req.body.city ? null : req.body.city;
        const phoneNumber = !req.body.phoneNumber ? null : req.body.phoneNumber;
        const email = !req.body.email ? null : req.body.email;
        const password = !req.body.password ? null : req.body.password;
        const timeSlots = !req.body.timeSlots ? null : req.body.timeSlots;

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

        // Handle uploading a resume if file is present
        const file = req.file
        resumeUrl = file ? await uploadFileToS3(file, 'resumes') : '';

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


        let newUser = new User({
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
        return res.status(500).send(err.message);
    }
};


const refundPaymentByAdmin = async (req, res) => {
  try {
    const { payment_intent, stripeMode, amount, note } = req.body; 
    if (!payment_intent || !stripeMode) return res.status(400).json({ message: "payment_intent and stripeMode are required" });
    const refund = await refundPaymentIntent(payment_intent, amount, stripeMode);
    if (!refund) return res.status(400).json({ message: "Refund failed" });

    // Record as a refund in the history (negative amount)
    await appendPaymentHistory({
      stripeMode,
      paymentType: 'refund',
      amount: amount ? -Math.round(amount * 100) : 0, // 0 means full in Stripe record; amount optional
      currency: 'usd',
      description: `Admin refund for PI ${payment_intent}`,
      paymentIntent: payment_intent,
      refundId: refund.id,
      adminNote: note || '',
    });
    return res.status(200).json({ ok: true, refundId: refund.id });
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.message);
  }
};

const checkPaymentIntentStatus = async (req, res) => {
  try {
    const { payment_intent, stripeMode } = req.body;
    if (!payment_intent || !stripeMode) return res.status(400).json({ message: "payment_intent and stripeMode are required" });
    const pi = await checkPaymentIntentSucceeded(payment_intent, stripeMode);
    return res.status(200).json({ succeeded: !!pi, paymentIntent: pi || null });
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.message);
  }
};


module.exports = {
    filterUsers,
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
    getPendingUsers,
    getPendingLogins,
    deletePendingUser,
    deletePendingLogin,
    convertPendingUserToUserByAdmin,
    registerUserByAdmin,
    refundPaymentByAdmin,
    checkPaymentIntentStatus
}
