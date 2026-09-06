const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema(
    {
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        actorEmail: { type: String },
        action: { type: String, required: true, index: true },
        targetType: { type: String },
        targetId: { type: String },
        targetEmail: { type: String },
        meta: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
