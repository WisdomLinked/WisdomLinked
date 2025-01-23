const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
    {
        userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
        role: {type: String, enum: ["expert", "customer"], required: true},
        rating: {type: Number, default: 0},
        feedback: {type: String, default: ""},
    },
    {timestamps: true}
);

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
        feedback: {type: [feedbackSchema], default: []},
    },
    {timestamps: true}
);


module.exports = mongoose.model("Event", eventSchema);
