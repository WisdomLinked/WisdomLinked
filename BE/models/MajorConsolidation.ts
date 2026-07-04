const mongoose = require("mongoose");

const majorConsolidationSchema = new mongoose.Schema(
    {
        target: { type: String, required: true },
        targetCreated: { type: Boolean, default: false },
        sources: [{ type: String }],
        usersUpdated: { type: Number, default: 0 },
        seminarsUpdated: { type: Number, default: 0 },
        performedBy: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("MajorConsolidation", majorConsolidationSchema);
