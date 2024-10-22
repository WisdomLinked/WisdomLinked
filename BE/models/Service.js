const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
    {
        value: { type: String },
        label: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
