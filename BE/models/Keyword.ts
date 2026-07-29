const mongoose = require("mongoose");

const keywordSchema = new mongoose.Schema(
    {
        value: { type: String },
        label: { type: String },
        approved: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Keyword", keywordSchema);
