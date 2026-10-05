const mongoose = require("mongoose");

const roomReadSchema = new mongoose.Schema(
    {
        /** Rocket.Chat room id (`rcChannelId`) — the same key both DMs and group chats use. */
        roomId: { type: String, required: true },

        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

        lastReadAt: { type: Date, required: true },
    },
    { timestamps: true }
);

roomReadSchema.index({ roomId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("RoomRead", roomReadSchema);
