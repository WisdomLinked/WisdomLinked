const mongoose = require("mongoose");

const pendingLoginSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        code: { type: Number },
        validUntil: {
            type: Date,
            default: () => new Date(Date.now() + 60 * 1000), // Now + 60 seconds
            expires: 0 // Remove the document after it is invalid
          },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PendingLogin", pendingLoginSchema);
