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
    },
    {timestamps: true}
);


module.exports = mongoose.model("Event", eventSchema);
