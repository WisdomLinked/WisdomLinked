const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("./PendingAppointmentToGroup");

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
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        /** 1:1 DM threads (Rocket.Chat IM); not used for community/group sessions. */
        directConversations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Conversation" }],
        groupChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" }],
        generalChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" }],
        pendingGroupChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "PendingAppointmentToGroup" }],
        missedChats: { type: mongoose.Schema.Types.Mixed },
        events: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
        keywords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Keyword" }],
        customKeywords: [{ type: String }],
        services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
        joinPopupBlocked: { type: Boolean, default: false },
        feedbacks: [{ type: mongoose.Schema.Types.Mixed }],
        status: { type: String, default: 'review' },
        timeZone: { type: String, default: 'UTC' },

        notificationPreferences: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            seminarReminders: { type: Boolean, default: true },
            sessionReminders: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false },
        },
        isActive: { type: Boolean, default: true },
        isAdHocCustomer: { type: Boolean, default: false },
        token: { type: String, select: false },
        password: { type: String, select: false },

        // OAUTH ---------------
        oauthProvider: { type: String }, // 'google' | 'wechat' | 'facebook' | 'twitter'
        // For WeChat (no email returned), oauthId holds unionid (preferred) or openid.
        oauthId: { type: String },

        // EXPERT -------------
        title: { type: String },
        resume: { type: String },
        description: { type: String },
        timeSlots: [{ type: Number }],
        dailyTimeSlots: [{ type: Number }],
        /** How `timeSlots` should be interpreted on the student side:
         *  'common' = same recurring slots every day (uses `timeSlots`);
         *  'daily'  = per-weekday slots taken from `weeklyTimeSlots`. */
        availabilityMode: { type: String, enum: ['common', 'daily'], default: 'common' },
        /** Per-weekday half-hour slot indices (expert-local), used when availabilityMode === 'daily'. */
        weeklyTimeSlots: {
            Mon: { type: [Number], default: undefined },
            Tue: { type: [Number], default: undefined },
            Wed: { type: [Number], default: undefined },
            Thu: { type: [Number], default: undefined },
            Fri: { type: [Number], default: undefined },
            Sat: { type: [Number], default: undefined },
            Sun: { type: [Number], default: undefined },
        },
        /** YYYY-MM-DD dates when expert is not accepting bookings (whole day) */
        blockedBookingDates: [{ type: String }],
        /** Per-date blocked half-hour slot indices (expert-local), e.g. { "2026-07-03": [28, 29] } */
        blockedBookingSlots: { type: Map, of: [Number], default: undefined },
        /** Minimum hours before session start that students may book (24, 48, or 72). */
        bookingNoticeHours: { type: Number, default: 24 },
        /** Session lengths (minutes) this expert offers for 1:1 bookings: 30, 60, and/or 90. */
        appointmentDurations: { type: [Number], default: [30, 60, 90] },
        price: [{ type: Number, default: 5 }],
        rating: { type: Number, default: 0 },
        specialNote: { type: String },

        // STUDENT ACADEMIC BACKGROUND (optional, recommended) ---------------
        degreeSought: { type: String },
        intendedIntake: { type: String },
        currentUniversity: { type: String },
        gpa: { type: String },
        rankingPercentile: { type: String },
        /** Comma-separated list of target universities the student is aiming for. */
        targetUniversities: { type: String },
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
