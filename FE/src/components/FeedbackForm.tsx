import React, { useState } from "react";
import { doUpdateMeetingAnalytics } from "../api/api"; // Adjust the import path as needed
import { useAppSelector } from "../store";

interface FeedbackFormProps {
    _id: string;                   // MeetingAnalytics ID (same as event/groupchat ID)
    type: "event" | "groupchat";   // Type of the meeting
    onClose: () => void;           // Callback to close the form after submission
    joinTime: string;              // User's join time passed as a prop
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ _id, type, onClose, joinTime }) => {
    const { auth: { userDetails } } = useAppSelector((state) => state);

    const [rating, setRating] = useState<number>(0); // Rating (0–5)
    const [feedback, setFeedback] = useState<string>(""); // Feedback comment

    const handleSubmit = async () => {
        if (rating < 0 || rating > 5) {
            alert("Please provide a rating between 0 and 5.");
            return;
        }

        if (!feedback.trim()) {
            alert("Feedback cannot be empty.");
            return;
        }

        try {
            const currentTime = new Date().toISOString(); // Current UTC time
            const updateData: any = {
                _id,                  // MeetingAnalytics ID
                type,                 // Type of meeting (event/groupchat)
                userId: userDetails.userId, // User ID from the store
                role: userDetails.role,     // Role of the user (e.g., customer, expert)
                rating,               // User-provided rating
                feedback,             // User-provided feedback
                joinTime,             // User's join time
                leftTime: currentTime // User's leave time
            };

            // Call the API to update MeetingAnalytics
            console.log("Updating Meeting Analytics:", updateData);
            const response = await doUpdateMeetingAnalytics(updateData);
            console.log("Meeting Analytics updated successfully:", response);

            alert("Feedback submitted successfully!");

            // Trigger onClose callback if provided
            if (onClose) {
                onClose();
            }
        } catch (error) {
            console.error("Error updating Meeting Analytics:", error);
            alert("Failed to submit feedback. Please try again.");
        }
    };

    return (
        <div className="p-4 bg-midgrey-1 text-white rounded-md w-[300px]">
            <h3 className="text-xl mb-2">Please leave feedback</h3>
            <label className="block mb-1">Rating (0-5):</label>
            <input
                type="number"
                min={0}
                max={5}
                className="mb-2 w-full border rounded text-black px-2"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
            />
            <label className="block mb-1">Comment:</label>
            <textarea
                className="mb-2 w-full border rounded text-black px-2 py-1"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
            />
            <button
                className="bg-green text-white px-4 py-2 rounded"
                onClick={handleSubmit}
            >
                Submit
            </button>
        </div>
    );
};

export default FeedbackForm;