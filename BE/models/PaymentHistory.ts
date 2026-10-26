const mongoose = require("mongoose");

const PaymentHistorySchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
        paymentType: { type: String, default: 'charge' },
        amount: { type: Number },
        // Snapshot of the quote used for this charge. Old rows omit these.
        sessionType: { type: String, enum: ['seminar', 'oneToOne'] },
        advertisedCents: { type: Number },
        platformFeeCents: { type: Number },
        taxCents: { type: Number },
        commissionCents: { type: Number },
        expertNetCents: { type: Number },
        expertCommissionPercent: { type: Number },
        studentFeePercent: { type: Number },
        studentFeeCapDollars: { type: Number },
        taxPercent: { type: Number },
        freeSessionPlatformFeeDollars: { type: Number },
        currency: { type: String, default: 'usd' },
        description: { type: String },
        paymentIntent: { type: String },
        receiptUrl: { type: String },
        receiptNumber: { type: String },
        balanceTransaction: { type: String },
        cardBrand: { type: String },
        cardLast4: { type: String },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded', 'withheld', 'released'],
            default: 'completed'
        },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        expert: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        pendingAppointmentToGroup: { type: mongoose.Schema.Types.ObjectId, ref: "PendingAppointmentToGroup" },
        groupChat: { type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" },
        event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
        checkoutSessionId: { type: String },
        linkExpiresAt: { type: Date },
    },
    { timestamps: true }
);

PaymentHistorySchema.index(
    { paymentIntent: 1 },
    {
        unique: true,
        partialFilterExpression: {
            paymentType: 'charge',
            paymentIntent: { $type: 'string' },
        },
    }
);

module.exports = mongoose.model("PaymentHistory", PaymentHistorySchema);
