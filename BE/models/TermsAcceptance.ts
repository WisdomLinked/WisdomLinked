const mongoose = require("mongoose");

const termsAcceptanceSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        audience: {
            type: String,
            enum: ["shared", "expert", "customer"],
            required: true,
        },
        version: { type: Number, required: true },
        /** SHA-256 of the sanitized HTML this person was shown. */
        contentHash: { type: String, required: true },
        signedAt: { type: Date, required: true },
        ip: { type: String, default: "" },
        userAgent: { type: String, default: "" },
        typedName: { type: String, default: "" },
        /** PNG data URL when they drew a signature. Empty when they only typed a name. */
        signaturePng: { type: String, default: "" },
    },
    { timestamps: true }
);

termsAcceptanceSchema.index({ user: 1, audience: 1, version: 1 }, { unique: true });
termsAcceptanceSchema.index({ audience: 1, version: 1, signedAt: -1 });

module.exports = mongoose.model("TermsAcceptance", termsAcceptanceSchema);
