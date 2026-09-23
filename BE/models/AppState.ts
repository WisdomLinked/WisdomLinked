const mongoose = require("mongoose");

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
