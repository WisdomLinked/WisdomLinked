import React, { useEffect, useState } from "react";
import { getUserFeedbacks, doFilterUsers } from "../api/api";
import { useAppDispatch } from "../store";

interface UserType {
    _id: string;
    email: string;
    username: string;
}

interface FeedbackItem {
    event: { _id: string; title: string };
    groupChat: { _id: string; name: string };
    eventType: string;
    start: string;
    end: string;
    totalTimeSpent: number;
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

    const [users, setUsers] = useState<UserType[]>([]);
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");

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

    const filteredUsers = users.filter((u) => {
        if (!searchTerm) {
            return true;
        }
        const lowerSearch = searchTerm.toLowerCase();
        return (
            u.username.toLowerCase().includes(lowerSearch) ||
            u.email.toLowerCase().includes(lowerSearch)
        );
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (!value) {
            setSelectedUserId("");
            setFeedbacks([]);
        }
    };

    const handleSelectUser = async (user: UserType) => {
        try {
            setSearchTerm(`${user.username} (${user.email})`);
            setSelectedUserId(user._id);
            setIsLoadingFeedbacks(true);

            const data = await getUserFeedbacks(user._id);
            setFeedbacks(data?.result || []);
        } catch (err) {
            console.log(err);
            setFeedbacks([]);
        } finally {
            setIsLoadingFeedbacks(false);
        }
    };

    const handleClear = () => {
        setSearchTerm("");
        setSelectedUserId("");
        setFeedbacks([]);
    };

    return (
        <div className="w-full min-h-full pt-10 overflow-y-auto bg-wl-page text-wl-ink px-[18px] pb-10">
            <div className="w-full max-w-[900px] mx-auto flex flex-col items-center">
            <h2 className="text-center text-2xl font-semibold text-wl-brand mb-8 w-full">
                User Feedbacks
            </h2>

            <div className="mb-6 w-full max-w-md">
                <label className="text-wl-muted block mb-2 text-sm text-center">Search and Select User:</label>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                    <div className="relative w-full min-w-[200px] flex-1">
                        <input
                            type="text"
                            className="w-full bg-white text-wl-ink px-3 py-2 rounded-[15px] border border-lightgrey focus:outline-none focus:ring-2 focus:ring-wl-brand/30 transition-all placeholder:text-grey"
                            placeholder="Type user name or email"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            disabled={isLoadingUsers}
                        />

                        {filteredUsers.length > 0 && (
                            <div className="absolute z-10 w-full bg-white mt-1 rounded-xl border border-lightgrey shadow-md max-h-48 overflow-y-auto">
                                {filteredUsers.map((user) => (
                                    <div
                                        key={user._id}
                                        onClick={() => handleSelectUser(user)}
                                        className="px-3 py-2 hover:bg-wl-brandSoft cursor-pointer text-sm text-left"
                                    >
                                        {user.username} ({user.email})
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleClear}
                        className="shrink-0 px-5 py-2 rounded-xl border border-wl-brand text-white bg-wl-brand hover:brightness-95 transition-all font-medium text-sm disabled:opacity-50"
                        disabled={isLoadingUsers}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {isLoadingFeedbacks ? (
                <p className="text-wl-muted text-center w-full">Loading feedbacks...</p>
            ) : feedbacks.length === 0 && selectedUserId ? (
                <p className="text-wl-muted text-center w-full">No feedback found for this user.</p>
            ) : (
                <div className="space-y-4 w-full">
                    {feedbacks.map((fb, idx) => (
                        <div
                            key={idx}
                            className="p-4 rounded-2xl border border-wl-line bg-white shadow-[0_10px_30px_rgba(35,76,106,0.06)] text-left"
                        >
                            {fb.eventType === "event" && fb.event && (
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Individual Event Name:</strong>{" "}
                                    {fb.event.title || "N/A"}
                                </p>
                            )}
                            {fb.eventType === "seminar" && fb.groupChat && (
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Seminar Name:</strong>{" "}
                                    {fb.groupChat.name || "N/A"}
                                </p>
                            )}

                            <p className="text-wl-ink/90">
                                <strong className="text-wl-brand">Rating:</strong> {fb.rating}
                            </p>

                            <p className="text-wl-ink/90">
                                <strong className="text-wl-brand">Feedback:</strong> {fb.description}
                            </p>

                            <p className="text-wl-ink/90">
                                <strong className="text-wl-brand">Event Start:</strong>{" "}
                                {fb.start ? new Date(fb.start).toLocaleString() : "N/A"}
                            </p>
                            <p className="text-wl-ink/90">
                                <strong className="text-wl-brand">Event End:</strong>{" "}
                                {fb.end ? new Date(fb.end).toLocaleString() : "N/A"}
                            </p>

                            <p className="text-wl-ink/90">
                                <strong className="text-wl-brand">Total Time Spent:</strong>{" "}
                                {fb.totalTimeSpent} minute(s)
                            </p>

                            {fb.otherUser ? (
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Other User:</strong>{" "}
                                    {fb.otherUser.username} (Role: {fb.otherUser.role})
                                </p>
                            ) : (
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Other User:</strong> Unknown
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}