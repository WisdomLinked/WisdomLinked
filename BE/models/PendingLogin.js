const mongoose = require("mongoose");

const pendingLoginSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        code: { type: Number }
    },
    { timestamps: true }
);

module.exports = mongoose.model("PendingLogin", pendingLoginSchema);
