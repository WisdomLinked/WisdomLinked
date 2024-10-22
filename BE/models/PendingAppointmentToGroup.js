const mongoose = require("mongoose");

const pendingAppointmentToGroupSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        groupChatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GroupChat",
            required: true,
        },
        paidBy: { type: String}
    },
    { timestamps: true }
);

module.exports = mongoose.model("PendingAppointmentToGroup", pendingAppointmentToGroupSchema);
