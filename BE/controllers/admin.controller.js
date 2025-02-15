const User = require("../models/User");
const Event = require("../models/Event");
const PaymentHistory = require("../models/PaymentHistory");
const Conversation = require("../models/Conversation");
const GroupChat = require("../models/GroupChat");
const Keyword = require("../models/Keyword");
const ContactedUs = require("../models/ContactedUs");
const nodemailer = require("nodemailer");

const { getFullUserData } = require('../middlewares/requireAuth')

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
        // feedbacks array
        const feedbacks = user.feedbacks || [];
        // Enrich each feedback with other user info
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

        // Name Filter (case-insensitive)
        if (name) {
            query = query.where("name", new RegExp(name, "i"));
        }

        // Email Filter (case-insensitive)
        if (email) {
            query = query.where("email", new RegExp(email, "i"));
        }

        // Date Range Filter (INCLUSIVE)
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

        // Sorting with Case-Insensitive Collation
        query = query.collation({ locale: "en", strength: 2 });

        if (sortBy) {
            const order = sortOrder && sortOrder.toLowerCase() === "desc" ? -1 : 1;
            query = query.sort({ [sortBy]: order });
        }

        // Execute Query
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

        // If actioned is "Yes", switch to "No". Otherwise switch to "Yes".
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

const sendEmailToUser = async (req, res) => {
    try {
        const { email, message } = req.body;

        // Basic validation
        if (!email || !message) {
            return res.status(400).json({
                status: "FAILED",
                message: "Email and message are required."
            });
        }

        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",      // same as Python's smtp.gmail.com
            port: 587,                   // TLS port
            secure: false,               // use TLS rather than SSL
            auth: {
                user: process.env.GOOGLE_EMAIL,
                pass: process.env.GOOGLE_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        let mailOptions = {
            from: process.env.GOOGLE_EMAIL,
            to: email,
            subject: "Message from WisdomLink.io",
            text: message
        };

        // Send the mail
        await transporter.sendMail(mailOptions);

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
    sendEmailToUser
}
