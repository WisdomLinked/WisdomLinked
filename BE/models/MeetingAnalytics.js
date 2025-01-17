const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["expert", "customer"], required: true },
    rating: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    joinTime: { type: Date, default: null },
    leftTime: { type: Date, default: null },
}, { _id : false });

const meetingAnalyticsSchema = new mongoose.Schema({
    // whether this record belongs to an individual event or a groupchat
    type: {
        type: String,
        enum: ["event", "groupchat"],
        required: true
    },

    // this will be the same as either the Event _id or the GroupChat _id
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    // host or expert for this meeting
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // feedback from each participant, including the expert
    participantsFeedback: [feedbackSchema],

    // timestamps for expert/host
    expertJoinTime: { type: Date, default: null },
    expertLeftTime: { type: Date, default: null },

    // in case the expert joins again multiple times, you can store these times or
    // just accumulate them. For simplicity, a single totalMeetingTime
    totalMeetingTime: { type: Number, default: 0 }, // in milliseconds or seconds

}, { timestamps: true });

module.exports = mongoose.model("MeetingAnalytics", meetingAnalyticsSchema);


