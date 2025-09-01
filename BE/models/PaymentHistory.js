const mongoose = require("mongoose");

const PaymentHistorySchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
        // 'charge' (normal), 'refund' (admin refund), 'adhoc' (ad‑hoc charge)
        paymentType: { type: String, default: 'charge' },
        amount: { type: Number },
        currency: { type: String, default: 'usd' },
        description: { type: String },
        paymentIntent: { type: String },
        adminNote: { type: String, default: '' },
        retriedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentHistory", default: null },
        refundId: { type: String, default: '' },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        expert: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pendingAppointmentToGroup: { type: mongoose.Schema.Types.ObjectId, ref: "PendingAppointmentToGroup" },
        groupChat: { type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" },
        event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PaymentHistory", PaymentHistorySchema);
