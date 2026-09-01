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
        image: { type: String },
        keywords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Keyword" }],
        customKeywords: [{ type: String }],
        services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
        tags: [{ type: String }],
        purposeOther: { type: String },
        start: { type: Date },
        end: { type: Date },
        duration: { type: Number },
        price: { type: Number },
        paidBy: { type: String },
        maxAttendees: { type: Number },
        currency: { type: String, default: "USD" },
        timezone: { type: String },
        isRecurring: { type: Boolean, default: false },
        // Legacy label, still written whenever the rule matches one of these
        // shapes so surfaces reading it keep rendering. The rule itself lives in
        // recurrenceUnit/recurrenceInterval below.
        recurrenceFrequency: {
            type: String,
            enum: ["weekly", "biweekly", "monthly"],
            default: undefined,
        },
        recurrenceUnit: {
            type: String,
            enum: ["day", "week", "month"],
            default: undefined,
        },
        recurrenceInterval: { type: Number, default: undefined },
        // Weekly rules only: the days of the week the seminar runs on, 0 = Sunday.
        // Empty means "the same weekday as the first session".
        recurrenceWeekdays: [{ type: Number }],
        // How the expert bounded the series: a number of sessions, an end date,
        // or neither (which falls back to a one-year horizon).
        recurrenceCount: { type: Number, default: undefined },
        recurrenceUntil: { type: Date, default: undefined },
        seriesId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupChat",
            default: null,
        },
        type: {
            type: String,
            enum: ["seminar", "individual", "community"],
            default: "seminar",
        },
        status: {type: String, enum: ["draft", "pending", "active", "cancelled"], default: 'pending'},
        decisionNote: { type: String, default: '' },
        decisionNoteAt: { type: Date, default: null },
        decisionNoteReadAt: { type: Date, default: null },
        decisionDeadline: { type: Date, default: null },
        holdCaptureBefore: { type: Date, default: null },
        paymentMode: { type: String, enum: ["card", "wallet"], default: "card" },
        paymentDeadline: { type: Date, default: null },
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
        coModerators: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
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

groupChatSchema.index({ rcChannelId: 1 }, { sparse: true });

module.exports = mongoose.model("GroupChat", groupChatSchema);
