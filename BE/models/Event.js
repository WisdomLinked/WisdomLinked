const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        expert: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        start: { type: Date },
        end: { type: Date },
        duration: {type: Number },
        title: { type: String },
        status: { type: String, default: 'pending' },
        paidBy: { type: String },
        price: { type: Number },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
