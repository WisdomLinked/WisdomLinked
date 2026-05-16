const mongoose = require("mongoose");

const meetingThreadSchema = new mongoose.Schema(
    {
        // Parent conversation (DM) or groupChat this meeting belongs to
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
        },
        groupChatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupChat",
        },

        jitsiRoomName: {
            type: String,
            required: true,
        },

        // Who started the meeting
        startedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        delegatedModerators: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        joinEvents: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
                source: {
                    type: String,
                    default: "join-link",
                },
            },
        ],
        removedParticipants: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                removedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                reason: {
                    type: String,
                    default: "",
                },
                removedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        startedAt: {
            type: Date,
            default: Date.now,
        },
        endedAt: {
            type: Date,
        },
        duration: {
            type: Number, // seconds
            default: 0,
        },

        // Chat transcript captured during the Jitsi call
        transcript: [
            {
                author: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                authorName: String,
                content: String,
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        status: {
            type: String,
            enum: ["active", "ended"],
            default: "active",
        },
        lastHeartbeatAt: {
            type: Date,
        },
        lastReportedRemoteCount: {
            type: Number,
        },
        ratings: [
            {
                rater: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                target: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                score: { type: Number, min: 1, max: 5, required: true },
                comment: { type: String, default: "" },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("MeetingThread", meetingThreadSchema);
