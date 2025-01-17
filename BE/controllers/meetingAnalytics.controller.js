const MeetingAnalytics = require("../models/MeetingAnalytics");

// Create a new MeetingAnalytics document if it doesn't exist
const createMeetingAnalytics = async (req, res) => {
    try {
        const { type, _id, admin } = req.body;

        // Check if a document with this ID already exists
        const alreadyExists = await MeetingAnalytics.findById(_id);
        if (alreadyExists) {
            return res.status(200).json({
                success: true,
                message: "MeetingAnalytics document already exists",
                meetingAnalytics: alreadyExists
            });
        }

        // Create a new document
        const newAnalytics = new MeetingAnalytics({
            _id,
            type,
            admin,
            participantsFeedback: [],
        });
        await newAnalytics.save();

        return res.status(200).json({
            success: true,
            message: "MeetingAnalytics created successfully",
            meetingAnalytics: newAnalytics
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

// Update existing MeetingAnalytics with participant feedback or total time
const updateMeetingAnalytics = async (req, res) => {
    try {
        const { _id, userId, rating, feedback, joinTime } = req.body;

        const analyticsDoc = await MeetingAnalytics.findById(_id);
        if (!analyticsDoc) {
            return res.status(404).send("No MeetingAnalytics document found");
        }

        // Update feedback for a specific user
        if (userId) {
            const idx = analyticsDoc.participantsFeedback.findIndex(
                (item) => item.userId.toString() === userId.toString()
            );
            if (idx > -1) {
                if (rating !== undefined) analyticsDoc.participantsFeedback[idx].rating = rating;
                if (feedback !== undefined) analyticsDoc.participantsFeedback[idx].feedback = feedback;
                if (joinTime) analyticsDoc.participantsFeedback[idx].joinTime = joinTime;
            } else {
                analyticsDoc.participantsFeedback.push({
                    userId,
                    role: "participant",
                    rating: rating || 0,
                    feedback: feedback || "",
                    joinTime: joinTime || null
                });
            }
        }

        await analyticsDoc.save();

        return res.status(200).json({
            success: true,
            meetingAnalytics: analyticsDoc
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

// Retrieve MeetingAnalytics by _id
const getMeetingAnalytics = async (req, res) => {
    try {
        const { _id } = req.body;

        const analyticsDoc = await MeetingAnalytics.findById(_id)
            .populate("admin", "email username")
            .populate("participantsFeedback.userId", "email username");

        if (!analyticsDoc) {
            return res.status(404).send("No MeetingAnalytics document found");
        }

        return res.status(200).json({
            success: true,
            meetingAnalytics: analyticsDoc
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};

module.exports = {
    createMeetingAnalytics,
    updateMeetingAnalytics,
    getMeetingAnalytics
};
