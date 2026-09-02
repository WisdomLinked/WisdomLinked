import { Request, Response } from 'express';
const MeetingAnalytics = require("../models/MeetingAnalytics");
import { safeErrorMessage } from '../utils/httpUserFacingCopy';

// Create a new MeetingAnalytics document if it doesn't exist
const createMeetingAnalytics = async (req, res) => {
    try {
        const { type, admin } = req.body;
        const _id = String(req.body?._id ?? '');

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
        return res.status(500).send(safeErrorMessage(err));
    }
};

// Update existing MeetingAnalytics with participant feedback or total time
const updateMeetingAnalytics = async (req, res) => {
    try {
        const { userId, role, rating, feedback } = req.body;
        const _id = String(req.body?._id ?? '');

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
                // Update existing feedback
                if (rating !== undefined) analyticsDoc.participantsFeedback[idx].rating = rating;
                if (feedback !== undefined) analyticsDoc.participantsFeedback[idx].feedback = feedback;
            } else {
                // Add new feedback entry with the correct role
                analyticsDoc.participantsFeedback.push({
                    userId,
                    role, // Use the role passed in the request
                    rating: rating || 0,
                    feedback: feedback || "",
                });
            }
        }

        await analyticsDoc.save();

        return res.status(200).json({
            success: true,
            meetingAnalytics: analyticsDoc,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send(safeErrorMessage(err));
    }
};


// Retrieve MeetingAnalytics by _id
const getMeetingAnalytics = async (req, res) => {
    try {
        const _id = String(req.body?._id ?? '');

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
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = {
    createMeetingAnalytics,
    updateMeetingAnalytics,
    getMeetingAnalytics
};
