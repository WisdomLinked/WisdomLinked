import React, { useEffect, useState } from "react";
import { getUserFeedbacks, doFilterUsers } from "../api/api";
import { useAppDispatch } from "../store";

interface UserType {
    _id: string;
    email: string;
    username: string;
}

interface FeedbackItem {
    event: {_id: string, title: string},
    groupChat: {_id: string, name: string},
    rating: number;
    description: string;
    date: string;
    otherUserId: string;
    otherUser: {
        _id: string;
        username: string;
        role: string;
        image: string;
    } | null;
}

export default function Feedback() {
    const dispatch = useAppDispatch();
    const [selectedUserId, setSelectedUserId] = useState("");
    const [users, setUsers] = useState<UserType[]>([]);
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            const response = await doFilterUsers({});
            if (response && response.result) {
                setUsers(response.result);
            }
        } catch (err) {
            console.log(err);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleUserChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const userId = e.target.value;
        setSelectedUserId(userId);

        if (userId) {
            setIsLoadingFeedbacks(true);
            try {
                const data = await getUserFeedbacks(userId);
                setFeedbacks(data?.result || []);
            } catch (err) {
                console.log(err);
                setFeedbacks([]);
            } finally {
                setIsLoadingFeedbacks(false);
            }
        } else {
            setFeedbacks([]);
        }
    };

    return (
        <div className="min-h-screen p-6 bg-[#181818] text-white">
            {/* Title */}
            <h2 className="text-2xl font-semibold text-[#31B099] mb-6">
                User Feedbacks
            </h2>

            {/* User Selection */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center mb-6 gap-3">
                <label className="text-gray-300">Select User:</label>
                <select
                    className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#31B099] transition-all"
                    value={selectedUserId}
                    onChange={handleUserChange}
                    disabled={isLoadingUsers}
                >
                    {isLoadingUsers ? (
                        <option value="">Loading users...</option>
                    ) : (
                        <>
                            <option value="">-- Select --</option>
                            {users.map((u) => (
                                <option key={u._id} value={u._id}>
                                    {u.username} ({u.email})
                                </option>
                            ))}
                        </>
                    )}
                </select>
            </div>

            {/* Feedback List */}
            {isLoadingFeedbacks ? (
                <p className="text-gray-400">Loading feedbacks...</p>
            ) : feedbacks.length === 0 && selectedUserId ? (
                <p className="text-gray-400">No feedback found for this user.</p>
            ) : (
                <div className="space-y-4">
                    {feedbacks.map((fb, idx) => (
                        <div
                            key={idx}
                            className="p-4 rounded-lg border border-gray-700 bg-[#252525] shadow-lg hover:shadow-[#31B099] transition-shadow"
                        >
                            {fb.event && (
                                <p className="text-gray-300">
                                    <strong className="text-white">Event Name:</strong> {fb.event.title || "N/A"}
                                </p>
                            )}

                            {fb.groupChat && (
                                <p className="text-gray-300">
                                    <strong className="text-white">GroupChat Name:</strong> {fb.groupChat.name || "N/A"}
                                </p>
                            )}

                            <p className="text-gray-300">
                                <strong className="text-[#31B099]">Rating:</strong> {fb.rating}
                            </p>
                            <p className="text-gray-300">
                                <strong className="text-white">Feedback:</strong> {fb.description}
                            </p>
                            <p className="text-gray-300">
                                <strong className="text-white">Date:</strong>{" "}
                                {fb.date ? new Date(fb.date).toLocaleString() : "N/A"}
                            </p>
                            {fb.otherUser ? (
                                <p className="text-gray-300">
                                    <strong className="text-[#31B099]">Other User:</strong>{" "}
                                    {fb.otherUser.username} (Role: {fb.otherUser.role})
                                </p>
                            ) : (
                                <p className="text-gray-300">
                                    <strong className="text-[#31B099]">Other User:</strong> Unknown
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
