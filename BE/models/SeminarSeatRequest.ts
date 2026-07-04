const mongoose = require("mongoose");

const seminarSeatRequestSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        groupChat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupChat",
            required: true,
        },
        expert: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        paymentIntent: { type: String },
        paymentHistory: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentHistory" },
        stripeMode: { type: String, default: 'test' },
        amount: { type: Number },
        currency: { type: String, default: 'usd' },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'expired'],
            default: 'pending',
        },
        decisionDeadline: { type: Date },
    },
    { timestamps: true }
);

seminarSeatRequestSchema.index({ groupChat: 1, status: 1 });
seminarSeatRequestSchema.index({ customer: 1, groupChat: 1 });

module.exports = mongoose.model("SeminarSeatRequest", seminarSeatRequestSchema);
