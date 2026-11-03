const mongoose = require("mongoose");

const attemptStateSchema = new mongoose.Schema(
    {
        failures: { type: Number, default: 0 },
        lockUntil: { type: Date, default: null },
        lastFailedAt: { type: Date, default: null },
    },
    { _id: false }
);

const loginAttemptSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        password: { type: attemptStateSchema, default: () => ({}) },
        otp: { type: attemptStateSchema, default: () => ({}) },
    },
    { timestamps: true }
);

loginAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
