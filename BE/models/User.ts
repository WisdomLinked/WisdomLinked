const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        username: { type: String },
        /** Sanitized Rocket.Chat login name derived from email (see rocketchat.service). */
        rocketChatUsername: { type: String, sparse: true },
        phoneNumber: { type: String },
        country: { type: mongoose.Schema.Types.Mixed },
        state: { type: mongoose.Schema.Types.Mixed },
        city: { type: mongoose.Schema.Types.Mixed },
        image: { type: String },
        role: { type: String, required: true, default: 'customer' },
        friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        /** 1:1 DM threads (Rocket.Chat IM); not used for community/group sessions. */
        directConversations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Conversation" }],
        groupChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" }],
        generalChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" }],
        pendingGroupChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "PendingAppointmentToGroup" }],
        missedChats: { type: mongoose.Schema.Types.Mixed },
        events: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
        keywords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Keyword" }],
        services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
        joinPopupBlocked: { type: Boolean, default: false },
        feedbacks: [{ type: mongoose.Schema.Types.Mixed }],
        status: { type: String, default: 'review' },
        timeZone: { type: String, default: 'UTC' },
        isActive: { type: Boolean, default: true },
        isAdHocCustomer: { type: Boolean, default: false },
        token: { type: String, select: false },
        password: { type: String, select: false },

        // OAUTH ---------------
        oauthProvider: { type: String }, // 'google' | 'facebook' | 'twitter'
        oauthId: { type: String },

        // EXPERT -------------
        title: { type: String },
        resume: { type: String },
        description: { type: String },
        timeSlots: [{ type: Number }],
        dailyTimeSlots: [{ type: Number }],
        /** YYYY-MM-DD dates when expert is not accepting bookings (whole day) */
        blockedBookingDates: [{ type: String }],
        /** Minimum hours before session start that students may book (24, 48, or 72). */
        bookingNoticeHours: { type: Number, default: 24 },
        /** Session lengths (minutes) this expert offers for 1:1 bookings: 30, 60, and/or 90. */
        appointmentDurations: { type: [Number], default: [30, 60, 90] },
        price: [{ type: Number, default: 5 }],
        rating: { type: Number, default: 0 },
        specialNote: { type: String },
    },
    { timestamps: true }
);

//*********GENERATE AUTH TOKEN WHEN USER IS CREATED**************** */
userSchema.methods.generateAuthToken = async function () {
    const user = this;
    const token = jwt.sign({ email: user.email.toString() }, process.env.JWT_SECRET, {
        expiresIn: process.env.COOKIE_EXPIRED_TIME ? process.env.COOKIE_EXPIRED_TIME : '24h',
    });
    user.token = token;
    await user.save();
    return token;
};

module.exports = mongoose.model("User", userSchema);
