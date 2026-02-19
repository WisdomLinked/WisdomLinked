const mongoose = require("mongoose");

const groupChatSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            unique: false,
            required: [true, "can't be blank"],
        },
        description: {
            type: String,
        },
        keywords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Keyword" }],
        services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
        start: { type: Date },
        end: { type: Date },
        duration: { type: Number },
        price: { type: Number },
        paidBy: { type: String },
        type: {
            type: String,
            enum: ["seminar", "individual", "community"],
            default: "seminar",
        },
        status: {type: String, enum: ["pending", "active", "cancelled"], default: 'pending'},
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        totalTimeSpent: {type: Number, default: 0},
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],

        // creator of the group
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        isOpenToAll: {
            type: Boolean,
            default: false,
        },

        messages: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Message",
                required: true,
            },
        ],
        // Zoom meeting details (only one meeting per group chat)
        zoomMeeting: {
            meetingId: { type: String },
            meetingNumber: { type: String },
            joinUrl: { type: String },
            startUrl: { type: String }, // Host URL (for first person to join)
            password: { type: String },
            hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // First person to click becomes host
            createdAt: { type: Date },
            expiresAt: { type: Date }, // Meeting expiration (typically 24 hours after creation)
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("GroupChat", groupChatSchema);
