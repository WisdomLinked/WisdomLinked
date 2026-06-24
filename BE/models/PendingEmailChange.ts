const mongoose = require("mongoose");

const pendingEmailChangeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        currentEmail: { type: String, required: true },
        newEmail: { type: String, required: true },
        confirmCode: { type: String, required: true },
        failedAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date },
    },
    { timestamps: true }
);

pendingEmailChangeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("PendingEmailChange", pendingEmailChangeSchema);
