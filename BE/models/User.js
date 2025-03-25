const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            unique: true,
            required: [true, "can't be blank"],
        },
        username: { type: String },
        phoneNumber: { type: String },
        country: { type: mongoose.Schema.Types.Mixed },
        state: { type: mongoose.Schema.Types.Mixed },
        city: { type: mongoose.Schema.Types.Mixed },
        image: { type: String },
        role: { type: String, required: true, default: 'customer' },
        friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        groupChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" }],
        generalChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "GroupChat" }],
        pendingGroupChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "PendingAppointmentToGroup" }],
        missedChats: { type: mongoose.Schema.Types.Mixed },
        events: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
        keywords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Keyword" }],
        services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
        joinPopupBlocked: { type: Boolean, default: false },
        feedbacks: [{ type: mongoose.Schema.Types.Mixed }],
        status: { type: String, default: 'review' },

        token: { type: String, select: false },
        password: { type: String, required: [true, "can't be blank"], select: false },
        profileImageUrl: { type: String, default: null, },

        // EXPERT -------------
        title: { type: String },
        resume: { type: String },
        description: { type: String },
        timeSlots: [{ type: Number }],
        dailyTimeSlots: [{ type: Number }],
        price: [{ type: Number, default: 5 }],
        rating: { type: Number, default: 0 },
    },
    { timestamps: true }
);

//*********GENERATE AUTH TOKEN WHEN USER IS CREATED**************** */
userSchema.methods.generateAuthToken = async function () {
    const user = this;
    const token = jwt.sign({ email: user.email.toString() }, process.env.JWT_SECRET, {
        expiresIn: process.env.COOKIE_EXPIRED_TIME,
    });
    user.token = token;
    await user.save();
    return token;
};

module.exports = mongoose.model("User", userSchema);
