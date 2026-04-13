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
    },
    { timestamps: true }
);

module.exports = mongoose.model("MeetingThread", meetingThreadSchema);
