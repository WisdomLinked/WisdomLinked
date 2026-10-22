const mongoose = require("mongoose");

const termsVersionSchema = new mongoose.Schema(
    {
        audience: {
            type: String,
            enum: ["shared", "expert", "customer"],
            required: true,
        },
        version: { type: Number, required: true },
        /** Sanitized HTML the signer was shown. The content hash is of this exact string. */
        html: { type: String, required: true },
        contentHash: { type: String, required: true },
        docx: { type: Buffer, required: true, select: false },
        docxSha256: { type: String, required: true },
        originalFilename: { type: String, required: true },
        publisher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        publishedAt: { type: Date, required: true },
    },
    { timestamps: true }
);

termsVersionSchema.index({ audience: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("TermsVersion", termsVersionSchema);
