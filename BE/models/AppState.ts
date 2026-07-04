const mongoose = require("mongoose");

const appStateSchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
        seminarApprovalDeadlineHours: { type: Number, default: 24 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("AppState", appStateSchema);
