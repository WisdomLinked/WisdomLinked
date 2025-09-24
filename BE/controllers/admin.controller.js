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
        const { email, sortBy, sort, stripeMode, paymentType, status, dateFrom, dateTo, numPerPage, currentPage } = req.body
        const query = PaymentHistory.find()
        const countQuery = PaymentHistory.count()

        if (email) {
            const emailFilter = String(email).trim();
            const users = await User.find({ email: { $regex: emailFilter, $options: 'i' } })
            if (!users || users.length === 0) {
                return res.status(200).json({ result: [], totalCount: 0 })
            }
            const expertIds = []
            const customerIds = []
            for (const u of users) {
                if (u.role === 'expert') expertIds.push(u._id.toString())
                if (u.role === 'customer') customerIds.push(u._id.toString())
            }
            if (expertIds.length && customerIds.length) {
                query.where({ $or: [{ expert: { $in: expertIds } }, { customer: { $in: customerIds } }] })
                countQuery.where({ $or: [{ expert: { $in: expertIds } }, { customer: { $in: customerIds } }] })
            } else if (expertIds.length) {
                query.where({ expert: { $in: expertIds } })
                countQuery.where({ expert: { $in: expertIds } })
            } else if (customerIds.length) {
                query.where({ customer: { $in: customerIds } })
                countQuery.where({ customer: { $in: customerIds } })
            } else {
                // No matching roles found
                return res.status(200).json({ result: [], totalCount: 0 })
            }
        }

        // Always populate for consistent UI rendering
        query.populate(['expert', 'customer'])

        if (stripeMode) {
            query.where({ stripeMode })
            countQuery.where({ stripeMode })
        }

        if (paymentType) {
            query.where({ paymentType })
            countQuery.where({ paymentType })
        }

        if (status) {
            if (Array.isArray(status) && status.length) {
                query.where({ status: { $in: status } })
                countQuery.where({ status: { $in: status } })
            } else if (typeof status === 'string' && status) {
                query.where({ status })
                countQuery.where({ status })
            }
        }

        // Build inclusive date range filter once to avoid overwriting
        if (dateFrom || dateTo) {
            const createdAt = {}
            if (dateFrom) {
                // Inclusive start of day
                const from = new Date(dateFrom);
                createdAt['$gte'] = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
            }
            if (dateTo) {
                // Inclusive end of day
                const to = new Date(dateTo);
                createdAt['$lte'] = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
            }
            query.where({ createdAt })
            countQuery.where({ createdAt })
        }

        // Dynamic sorting
        const sortField = sortBy || 'createdAt'
        const sortOrderValue = (String(sort).toUpperCase() === 'ASC') ? 1 : -1
        query.sort({ [sortField]: sortOrderValue })

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

// Export payment histories as CSV based on filters
const exportPaymentHistories = async (req, res) => {
    try {
        // Accept filters via query params for a GET request
        const { email, stripeMode, paymentType, status, dateFrom, dateTo, sortBy, sortOrder } = req.query;

        const query = PaymentHistory.find();

        if (email) {
            const emailFilter = String(email).trim();
            const users = await User.find({ email: { $regex: emailFilter, $options: 'i' } });
            if (!users || users.length === 0) {
                // Return empty CSV with headers
                const headers = [
                    'Date',
                    'Amount',
                    'Currency',
                    'Expert Email',
                    'Customer Email',
                    'Payment Type',
                    'Status',
                    'Mode',
                    'Payment Intent',
                    'Description'
                ].join(',') + '\n';
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="payments_export.csv"`);
                return res.status(200).send(headers);
            }
            const expertIds = [];
            const customerIds = [];
            for (const u of users) {
                if (u.role === 'expert') expertIds.push(u._id.toString());
                if (u.role === 'customer') customerIds.push(u._id.toString());
            }
            if (expertIds.length && customerIds.length) {
                query.where({ $or: [{ expert: { $in: expertIds } }, { customer: { $in: customerIds } }] });
            } else if (expertIds.length) {
                query.where({ expert: { $in: expertIds } });
            } else if (customerIds.length) {
                query.where({ customer: { $in: customerIds } });
            } else {
                const headers = [
                    'Date',
                    'Amount',
                    'Currency',
                    'Expert Email',
                    'Customer Email',
                    'Payment Type',
                    'Status',
                    'Mode',
                    'Payment Intent',
                    'Description'
                ].join(',') + '\n';
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="payments_export.csv"`);
                return res.status(200).send(headers);
            }
        }

        if (stripeMode) {
            query.where({ stripeMode });
        }

        if (paymentType) {
            query.where({ paymentType });
        }

        if (status) {
            let statuses = status;
            if (typeof statuses === 'string') {
                // Support comma-separated list
                statuses = statuses.includes(',') ? statuses.split(',') : [statuses];
            }
            if (Array.isArray(statuses) && statuses.length) {
                query.where({ status: { $in: statuses } });
            } else if (typeof statuses === 'string' && statuses) {
                query.where({ status: statuses });
            }
        }

        if (dateFrom || dateTo) {
            const createdAt = {};
            if (dateFrom) {
                const from = new Date(dateFrom);
                createdAt['$gte'] = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
            }
            if (dateTo) {
                const to = new Date(dateTo);
                createdAt['$lte'] = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
            }
            query.where({ createdAt });
        }

        // Sorting
        const _sortField = (sortBy && typeof sortBy === 'string') ? sortBy : 'createdAt';
        const _sortOrder = (sortOrder === 'ASC') ? 1 : -1;
        query.sort({ [_sortField]: _sortOrder });

        // Ensure related user emails are available
        query.populate(['expert', 'customer']);

        const histories = await query.exec();

        // Build CSV
        const headers = [
            'Date',
            'Amount',
            'Currency',
            'Expert Email',
            'Customer Email',
            'Payment Type',
            'Status',
            'Mode',
            'Payment Intent',
            'Description'
        ];

        const escapeCsv = (val) => {
            if (val === undefined || val === null) return '';
            const str = String(val).replace(/\r?\n|\r/g, ' ');
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const rows = histories.map((h) => {
            const date = h.createdAt ? new Date(h.createdAt).toISOString() : '';
            const amount = (typeof h.amount === 'number') ? (h.amount / 100).toFixed(2) : '';
            const currency = h.currency || '';
            const expertEmail = (h.expert && h.expert.email) ? h.expert.email : '';
            const customerEmail = (h.customer && h.customer.email) ? h.customer.email : '';
            const paymentTypeVal = h.paymentType || '';
            const statusVal = h.status || '';
            const mode = h.stripeMode || '';
            const paymentIntent = h.paymentIntent || '';
            const description = h.description || '';
            return [
                date,
                amount,
                currency,
                expertEmail,
                customerEmail,
                paymentTypeVal,
                statusVal,
                mode,
                paymentIntent,
                description
            ].map(escapeCsv).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n') + '\n';

        // Filename hint
        const safeEmail = email ? String(email).replace(/[^a-zA-Z0-9._-]/g, '_') : 'all';
        const safeFrom = dateFrom ? String(dateFrom).replace(/[^0-9-]/g, '') : '';
        const safeTo = dateTo ? String(dateTo).replace(/[^0-9-]/g, '') : '';
        const filenameParts = ['payments'];
        if (safeEmail) filenameParts.push(safeEmail);
        if (safeFrom || safeTo) filenameParts.push(`${safeFrom || 'from'}_${safeTo || 'to'}`);
        const filename = filenameParts.join('_') + '.csv';

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch (err) {
        console.log(err);
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


module.exports = {
    filterUsers,
    getFullUserDataByEmail,
    updateProfileOfUser,
    filterPaymentHistories,
    exportPaymentHistories,
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
    registerUserByAdmin
}
