const mongoose = require("mongoose");

const pricingGroupSchema = new mongoose.Schema(
    {
        expertCommissionPercent: { type: Number, default: 20 },
        studentFeePercent: { type: Number, default: 3 },
        studentFeeCapDollars: { type: Number, default: 5 },
        taxPercent: { type: Number, default: 0 },
        freeSessionPlatformFeeDollars: { type: Number, default: 1 },
        // Read at cancel time. Missing values use the type default in normalizePricingRates.
        cancellationRefund: {
            type: String,
            enum: ['full', 'keep_platform_fee', 'processing_fee'],
        },
    },
    { _id: false }
);

const appStateSchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
        seminarApprovalDeadlineHours: { type: Number, default: 24 },
        paymentWindowHours: { type: Number, default: 48 },
        /**
         * When the session-reminder sweep first ran in this environment.
         *
         * Written once, never updated. Reminder marks that passed before it are
         * not owed: on the deploy that introduces the sweep, every existing
         * session has an empty remindersSent, and without this the first tick
         * would email everyone starting within 24h at once.
         *
         * A persisted timestamp rather than a boot-time check, so a restart
         * cannot re-suppress a reminder that is legitimately due.
         */
        reminderSweepActivatedAt: { type: Date, default: null },
        unreadEmailSweepActivatedAt: { type: Date, default: null },
        // Next checkout only. Missing groups fall back to the calculator defaults.
        pricing: {
            seminar: { type: pricingGroupSchema, default: undefined },
            oneToOne: { type: pricingGroupSchema, default: undefined },
        },
        announcement: {
            id: { type: String, default: '' },
            message: { type: String, default: '' },
            link: { type: String, default: '' },
            linkLabel: { type: String, default: '' },
            active: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("AppState", appStateSchema);
