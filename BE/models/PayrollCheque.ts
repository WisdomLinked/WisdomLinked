const mongoose = require("mongoose");

const PayrollChequeSchema = new mongoose.Schema(
    {
        expert: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        year: { type: Number, required: true },
        month: { type: Number, required: true, min: 1, max: 12 },
        amountCents: { type: Number, required: true },
        chequeNumber: { type: String, required: true },
        chequeDate: { type: Date, required: true },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
);

PayrollChequeSchema.index({ expert: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("PayrollCheque", PayrollChequeSchema);
