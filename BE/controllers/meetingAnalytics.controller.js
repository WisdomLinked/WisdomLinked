const MeetingAnalytics = require("../models/MeetingAnalytics");
const User = require("../models/User");

const createMeetingAnalytics = async (req, res) => {
    try {
        /*
            Expecting in req.body:
            {
                type: "event" or "groupchat",
                referenceId: eventId or groupChatId,
                admin: userIdOfExpert
            }
        */
        const { type, referenceId, admin } = req.body;

        // check if already created
        const alreadyExists = await MeetingAnalytics.findOne({
            type,
            referenceId
        });

        if (alreadyExists) {
            return res.status(200).json({
                success: true,
                message: "MeetingAnalytics document already exists",
                meetingAnalytics: alreadyExists
            });
        }

        // create new
        const newAnalytics = new MeetingAnalytics({
            type,
            referenceId,
            admin,
            participantsFeedback: [],
            expertJoinTime: null,
            expertLeftTime: null,
            totalMeetingTime: 0
        });
        await newAnalytics.save();

        return res.status(200).json({
            success: true,
            message: "MeetingAnalytics created successfully",
            meetingAnalytics: newAnalytics
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

const updateMeetingAnalytics = async (req, res) => {
    try {
        /*
            In req.body you can send anything relevant:
            {
                referenceId,
                type,
                userId,
                rating,
                feedback,
				role,
                joinTime,
                leftTime,
                expertJoinTime,
                expertLeftTime,
                totalMeetingTime
            }
        */
        const {
            type,
            referenceId,
            userId,
            rating,
            feedback,
            joinTime,
            leftTime,
            expertJoinTime,
            expertLeftTime,
            totalMeetingTime
        } = req.body;

        const analyticsDoc = await MeetingAnalytics.findOne({
            type,
            referenceId
        });

        if (!analyticsDoc) {
            return res.status(404).send("No MeetingAnalytics document found");
        }

        // If we have times for the expert, update them
        if (expertJoinTime) {
            analyticsDoc.expertJoinTime = expertJoinTime;
        }
        if (expertLeftTime) {
            analyticsDoc.expertLeftTime = expertLeftTime;
        }
        if (typeof totalMeetingTime === "number") {
            // accumulate or replace
            analyticsDoc.totalMeetingTime = totalMeetingTime;
        }

        // If we have rating/feedback for a particular participant
        if (userId) {
            const idx = analyticsDoc.participantsFeedback.findIndex(
                (item) => item.userId.toString() === userId.toString()
            );
            if (idx > -1) {
                // update existing
                if (rating !== undefined) analyticsDoc.participantsFeedback[idx].rating = rating;
                if (feedback !== undefined) analyticsDoc.participantsFeedback[idx].feedback = feedback;
                if (role) analyticsDoc.participantsFeedback[idx].role = role;
                if (joinTime) analyticsDoc.participantsFeedback[idx].joinTime = joinTime;
                if (leftTime) analyticsDoc.participantsFeedback[idx].leftTime = leftTime;
            } else {
                // add new
                analyticsDoc.participantsFeedback.push({
                    userId,
                    role,
                    rating: rating || 0,
                    feedback: feedback || "",
                    joinTime: joinTime || null,
                    leftTime: leftTime || null
                });
            }
        }

        await analyticsDoc.save();

        return res.status(200).json({
            success: true,
            meetingAnalytics: analyticsDoc
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

const getMeetingAnalytics = async (req, res) => {
    try {
        /*
            req.body = {
                type: "event" or "groupchat",
                referenceId: ...
            }
        */
        const { type, referenceId } = req.body;
        const analyticsDoc = await MeetingAnalytics.findOne({ type, referenceId })
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
        console.log(err);
        return res.status(500).send(err.message);
    }
};

module.exports = {
    createMeetingAnalytics,
    updateMeetingAnalytics,
    getMeetingAnalytics
};
