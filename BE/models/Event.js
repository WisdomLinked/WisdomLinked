const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
            expert: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
            customer: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
            start: {type: Date},
            end: {type: Date},
            duration: {type: Number},
            totalTimeSpent: {type: Number, default: 0},
            title: {type: String},
            status: {type: String, default: 'pending'},
            paidBy: {type: String},
            price: {type: Number},
            createdBy: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
            feedbacks: [{ type: mongoose.Schema.Types.Mixed }],
            // Zoom meeting details (only one meeting per event)
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
    {timestamps: true}
);


module.exports = mongoose.model("Event", eventSchema);
