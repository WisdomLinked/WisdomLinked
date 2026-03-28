const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        username: { type: String },
        phoneNumber: { type: String },
        country: { type: mongoose.Schema.Types.Mixed },
        state: { type: mongoose.Schema.Types.Mixed },
        city: { type: mongoose.Schema.Types.Mixed },
        image: { type: String },
        role: { type: String, required: true, default: 'customer' },
        friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
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

        confirmCode: { type: String },
        failedAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date },
        password: { type: String, required: [true, "can't be blank"] },

        // EXPERT -------------
        title: { type: String },
        resume: { type: String },
        description: { type: String },
        timeSlots: [{ type: Number }],
        dailyTimeSlots: [{ type: Number }],
        price: [{ type: Number, default: 5 }],
        rating: { type: Number, default: 0 },
        specialNote: { type: String },
    },
    { timestamps: true }
);

// TTL index to automatically delete documents 24 hours (86400 seconds) after createdAt
pendingUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("PendingUser", pendingUserSchema);
