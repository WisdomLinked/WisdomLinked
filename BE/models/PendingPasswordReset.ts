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
        code: { type: Number }
    },
    { timestamps: true }
);

module.exports = mongoose.model("PasswordReset", pendingPasswordResetSchema);
