import React, { useState } from "react";
import { doUpdateMeetingAnalytics } from "../api/api";

interface FeedbackFormProps {
    _id: string;                   // MeetingAnalytics ID (same as event/groupchat ID)
    type: "event" | "groupchat";   // Type of the meeting
    userId: string;                // User ID
    role: string;                  // Role of the user
    onClose: () => void;           // Callback to close the form after submission
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ _id, type, userId, role, onClose }) => {
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
            const updateData = {
                _id,         // MeetingAnalytics ID
                type,        // Type of meeting (event/groupchat)
                userId,      // User ID passed as prop
                role,        // Role passed as prop
                rating,      // User-provided rating
                feedback,    // User-provided feedback
            };

            // Debugging: Log the payload
            console.log("Sending feedback data:", updateData);

            // Call the API to update MeetingAnalytics
            const response = await doUpdateMeetingAnalytics(updateData);

            if (response && response.success) { // Assuming `response.success` indicates success
                console.log("Meeting Analytics updated successfully:", response);
                alert("Feedback submitted successfully!");
                onClose(); // Trigger onClose callback if provided
            } else {
                // Handle API errors if the response indicates failure
                console.error("API response error:", response);
                alert(
                    response?.message || "Failed to submit feedback. Please try again."
                );
            }
        } catch (error) {
            // Log and display the error for debugging
            console.error("Error updating Meeting Analytics:", error);
            alert("An error occurred while submitting feedback. Please try again.");
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
