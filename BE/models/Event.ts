const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
            expert: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
            customer: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
            confirmedAt: {type: Date, default: null},
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
            /** See GroupChat.remindersSent — same contract, claimed atomically. */
            remindersSent: [{ type: String }],
    },
    {timestamps: true}
);

// Mirrors the GroupChat index: the reminder sweep filters on status + start.
eventSchema.index({ status: 1, start: 1 });


module.exports = mongoose.model("Event", eventSchema);
