const mongoose = require("mongoose");

// Define schema for participant feedback
const feedbackSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["expert", "customer"], required: true },
        rating: { type: Number, default: 0 },
        feedback: { type: String, default: "" },
        joinTime: { type: Date, default: null },
        leftTime: { type: Date, default: null },
    },
    { _id: false }
);

// Define schema for MeetingAnalytics
const meetingAnalyticsSchema = new mongoose.Schema(
    {
        _id: { type: mongoose.Schema.Types.ObjectId, required: true },

        // This can be "event" or "groupchat"
        type: {
            type: String,
            enum: ["event", "groupchat"],
            required: true
        },

        // The admin (host/expert) for this meeting
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

        // Feedback from each participant, including the expert
        participantsFeedback: [feedbackSchema],

        // Total meeting time in seconds (or milliseconds), adjustable as needed
        totalMeetingTime: { type: Number, default: 0 },

    },
    { timestamps: true }
);

module.exports = mongoose.model("MeetingAnalytics", meetingAnalyticsSchema);
