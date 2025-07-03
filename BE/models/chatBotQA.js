const mongoose = require("mongoose");

const chatBotQASchema = new mongoose.Schema(
    {
        question: { type: String },
        answer: { type: String },
        role: { type: String, enum: ["customer", "expert","user"], default: "user" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ChatBotQA", chatBotQASchema);