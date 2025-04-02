const mongoose = require("mongoose");

const pendingLoginSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        code: { type: Number },
        lastCodeGeneratedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PendingLogin", pendingLoginSchema);
