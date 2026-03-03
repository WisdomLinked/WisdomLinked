const mongoose = require("mongoose");

const appStateSchema = new mongoose.Schema(
    {
        stripeMode: { type: String, default: 'test' },
    },
    { timestamps: true }
);

module.exports = mongoose.model("AppState", appStateSchema);
