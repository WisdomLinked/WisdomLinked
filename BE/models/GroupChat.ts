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

        /** Rocket.Chat room id once the channel is synced (used for unread + realtime). */
        rcChannelId: {
            type: String,
            default: null,
        },

        /** Last real chat activity (RC message time). Used for community sidebar order — not bumped by RC sync alone. */
        lastMessageAt: {
            type: Date,
            default: null,
        },

        messages: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Message",
                required: true,
            },
        ],

        /**
         * Per-participant visibility for Rocket.Chat channel messages (same idea as DM Conversation).
         * messageIds = RC message ids hidden only for this user ("delete for me").
         */
        hiddenForParticipants: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                messageIds: [{ type: String }],
                clearedAt: { type: Date, default: null },
            },
        ],
        moderationNotes: [
            {
                action: { type: String, default: "remove_member" },
                by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                target: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                reason: { type: String, default: "" },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("GroupChat", groupChatSchema);
