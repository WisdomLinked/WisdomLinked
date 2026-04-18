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
    },
    { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
