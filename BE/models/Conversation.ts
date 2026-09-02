const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
    {
        /** Rocket.Chat DM / channel room id — persisted for unread badges and delete. */
        rcChannelId: { type: String, default: null },

        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            }
        ],

        messages: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Message",
                required: true,
            }
        ],
        /**
         * Per-participant visibility state for Rocket.Chat DM messages.
         * - messageIds: message ids hidden only for this user ("delete for me")
         * - clearedAt: hide all messages created before this timestamp for this user ("delete thread for me")
         */
        hiddenForParticipants: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                messageIds: [{ type: String }],
                clearedAt: { type: Date, default: null },
            },
        ],
    },
    { timestamps: true }
);

conversationSchema.index({ rcChannelId: 1 }, { sparse: true });

module.exports = mongoose.model("Conversation", conversationSchema);
