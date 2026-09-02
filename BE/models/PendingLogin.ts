const mongoose = require("mongoose");

const pendingLoginSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        code: { type: Number },
        failedAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date },
        validUntil: {
            type: Date,
            default: () => new Date(Date.now() + 60 * 1000) // Now + 60 seconds
          },
    },
    { timestamps: true }
);

// TTL index to automatically delete documents 24 hours (86400 seconds) after createdAt
pendingLoginSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("PendingLogin", pendingLoginSchema);
