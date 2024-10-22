const mongoose = require("mongoose");

const friendInvitationSchema = new mongoose.Schema(
    {
        // User sending the invitation
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // User who is being invited
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        events: [{type: mongoose.Schema.Types.ObjectId, ref: "Event"}]
    },
    { timestamps: true }
);

module.exports = mongoose.model("FriendInvitation", friendInvitationSchema);
