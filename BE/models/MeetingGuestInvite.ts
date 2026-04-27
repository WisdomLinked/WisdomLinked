const mongoose = require("mongoose");

const meetingGuestInviteSchema = new mongoose.Schema(
    {
        meetingThreadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MeetingThread",
            required: true,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

meetingGuestInviteSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("MeetingGuestInvite", meetingGuestInviteSchema);

