const mongoose = require("mongoose");

const PaymentHistorySchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
        paymentType: { type: String, default: 'charge' },
        amount: { type: Number },
        currency: { type: String, default: 'usd' },
        description: { type: String },
        paymentIntent: { type: String },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        expert: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pendingAppointmentToGroup: { type: mongoose.Schema.Types.ObjectId, ref: "PendingAppointmentToGroup" },
        groupChat: { type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" },
        event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PaymentHistory", PaymentHistorySchema);
