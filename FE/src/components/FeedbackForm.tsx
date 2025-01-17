import React, { useState, useEffect } from "react";
import { doUpdateMeetingAnalytics } from "../api/api"; // adjust path as needed
import { useAppSelector } from "../store";

interface FeedbackFormProps {
    type: "event" | "groupchat";
    referenceId: string;            // eventId or groupchatId
    onClose: () => void;           // callback if you want to close the form after submission
    joinTime: string;              // user's join time passed as a prop
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ type, referenceId, onClose, joinTime }) => {
    const { auth: { userDetails } } = useAppSelector((state) => state);

    const [rating, setRating] = useState<number>(0);
    const [feedback, setFeedback] = useState<string>("");

    const handleSubmit = async () => {
        try {
            const currentTime = new Date().toISOString(); // Get current time in UTC
            const updateData: any = {
                type,
                referenceId,
                userId: userDetails.userId,
                role: userDetails.role,
                rating,
                feedback,
                joinTime,
                leftTime: currentTime
            };

            // If the user is an expert, include expert-specific fields
            if (userDetails.role === "expert") {
                updateData.expertJoinTime = joinTime;
                updateData.expertLeftTime = currentTime;
            }

            await doUpdateMeetingAnalytics(updateData);

            if (onClose) {
                onClose();
            }
            alert("Feedback submitted!");
        } catch (error) {
            console.error(error);
            alert("Failed to submit feedback");
        }
    };

    return (
        <div className="p-4 bg-midgrey-1 text-white rounded-md w-[300px]">
            <h3 className="text-xl mb-2">Please leave feedback</h3>
            <label className="block mb-1">
                Rating:
            </label>
            <input
                type="number"
                min={0}
                max={5}
                className="mb-2 w-full border rounded text-black px-2"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
            />
            <label className="block mb-1">
                Comment:
            </label>
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