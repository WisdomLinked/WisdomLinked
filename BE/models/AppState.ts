const mongoose = require("mongoose");

const appStateSchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
        seminarApprovalDeadlineHours: { type: Number, default: 24 },
        paymentWindowHours: { type: Number, default: 48 },
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
