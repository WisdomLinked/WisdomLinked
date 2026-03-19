const mongoose = require("mongoose");

const pendingPasswordResetSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        password: {
            type: String
        },
        code: { type: Number },
        failedAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date }
    },
    { timestamps: true }
);

// TTL index to automatically delete documents 24 hours (86400 seconds) after createdAt
pendingPasswordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("PasswordReset", pendingPasswordResetSchema);
