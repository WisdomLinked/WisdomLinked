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
//
//     return (
//         <div className="min-h-screen p-6 bg-[#181818] text-white">
//             {/* Page Title */}
//             <h2 className="text-2xl font-semibold text-[#31B099] mb-6">
//                 User Feedbacks
//             </h2>
//
//             {/* Single input for searching and selecting a user */}
//             <div className="relative mb-6 max-w-sm">
//                 <label className="text-gray-300 block mb-2">Search and Select User:</label>
//                 <input
//                     type="text"
//                     className="w-full bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#31B099] transition-all"
//                     placeholder="Type user name or email"
//                     value={searchTerm}
//                     onChange={handleSearchChange}
//                     disabled={isLoadingUsers}
//                 />
//
//                 {/* Dropdown list for all or filtered users */}
//                 {filteredUsers.length > 0 && (
//                     <div className="absolute z-10 w-full bg-[#252525] mt-1 rounded-md border border-gray-700 max-h-48 overflow-y-auto">
//                         {filteredUsers.map((user) => (
//                             <div
//                                 key={user._id}
//                                 onClick={() => handleSelectUser(user)}
//                                 className="px-3 py-2 hover:bg-[#31B099] cursor-pointer"
//                             >
//                                 {user.username} ({user.email})
//                             </div>
//                         ))}
//                     </div>
//                 )}
//             </div>
//
//             {/* Feedback List */}
//             {isLoadingFeedbacks ? (
//                 <p className="text-gray-400">Loading feedbacks...</p>
//             ) : feedbacks.length === 0 && selectedUserId ? (
//                 <p className="text-gray-400">No feedback found for this user.</p>
//             ) : (
//                 <div className="space-y-4">
//                     {feedbacks.map((fb, idx) => (
//                         <div
//                             key={idx}
//                             className="p-4 rounded-lg border border-gray-700 bg-[#252525] shadow-lg hover:shadow-[#31B099] transition-shadow"
//                         >
//                             {/* Conditional display based on eventType */}
//                             {fb.eventType === "event" && fb.event && (
//                                 <p className="text-gray-300">
//                                     <strong className="text-white">Individual Event Name:</strong>{" "}
//                                     {fb.event.title || "N/A"}
//                                 </p>
//                             )}
//                             {fb.eventType === "seminar" && fb.groupChat && (
//                                 <p className="text-gray-300">
//                                     <strong className="text-white">Seminar Name:</strong>{" "}
//                                     {fb.groupChat.name || "N/A"}
//                                 </p>
//                             )}
//
//                             {/* Rating */}
//                             <p className="text-gray-300">
//                                 <strong className="text-[#31B099]">Rating:</strong> {fb.rating}
//                             </p>
//
//                             {/* Feedback Description */}
//                             <p className="text-gray-300">
//                                 <strong className="text-white">Feedback:</strong> {fb.description}
//                             </p>
//
//                             {/* Date of Feedback */}
//                             <p className="text-gray-300">
//                                 <strong className="text-white">Date:</strong>{" "}
//                                 {fb.date ? new Date(fb.date).toLocaleString() : "N/A"}
//                             </p>
//
//                             {/* Other User Info */}
//                             {fb.otherUser ? (
//                                 <p className="text-gray-300">
//                                     <strong className="text-[#31B099]">Other User:</strong>{" "}
//                                     {fb.otherUser.username} (Role: {fb.otherUser.role})
//                                 </p>
//                             ) : (
//                                 <p className="text-gray-300">
//                                     <strong className="text-[#31B099]">Other User:</strong> Unknown
//                                 </p>
//                             )}
//                         </div>
//                     ))}
//                 </div>
//             )}
//         </div>
//     );
// }

    return (
        <div className="min-h-screen p-6 bg-[#181818] text-white">
            {/* Page Title */}
            <h2 className="text-2xl font-semibold text-[#31B099] mb-6">
                User Feedbacks
            </h2>

            {/* Single input for searching and selecting a user */}
            <div className="relative mb-6 max-w-sm">
                <label className="text-gray-300 block mb-2">Search and Select User:</label>
                <input
                    type="text"
                    className="w-full bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#31B099] transition-all"
                    placeholder="Type user name or email"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    disabled={isLoadingUsers}
                />

                {/* Dropdown list for users */}
                {filteredUsers.length > 0 && (
                    <div className="absolute z-10 w-full bg-[#252525] mt-1 rounded-md border border-gray-700 max-h-48 overflow-y-auto">
                        {filteredUsers.map((user) => (
                            <div
                                key={user._id}
                                onClick={() => handleSelectUser(user)}
                                className="px-3 py-2 hover:bg-[#31B099] cursor-pointer"
                            >
                                {user.username} ({user.email})
                            </div>
                        ))}
                    </div>
                )}
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
                            {/* Conditional display based on eventType */}
                            {fb.eventType === "event" && fb.event && (
                                <p className="text-gray-300">
                                    <strong className="text-white">Individual Event Name:</strong>{" "}
                                    {fb.event.title || "N/A"}
                                </p>
                            )}
                            {fb.eventType === "seminar" && fb.groupChat && (
                                <p className="text-gray-300">
                                    <strong className="text-white">Seminar Name:</strong>{" "}
                                    {fb.groupChat.name || "N/A"}
                                </p>
                            )}

                            {/* Rating */}
                            <p className="text-gray-300">
                                <strong className="text-[#31B099]">Rating:</strong> {fb.rating}
                            </p>

                            {/* Feedback Description */}
                            <p className="text-gray-300">
                                <strong className="text-white">Feedback:</strong> {fb.description}
                            </p>

                            {/* Event Start and End Times (formatted) */}
                            <p className="text-gray-300">
                                <strong className="text-white">Event Start:</strong>{" "}
                                {fb.start ? new Date(fb.start).toLocaleString() : "N/A"}
                            </p>
                            <p className="text-gray-300">
                                <strong className="text-white">Event End:</strong>{" "}
                                {fb.end ? new Date(fb.end).toLocaleString() : "N/A"}
                            </p>

                            {/* Total Time Spent */}
                            <p className="text-gray-300">
                                <strong className="text-white">Total Time Spent:</strong> {fb.totalTimeSpent} minute(s)
                            </p>

                            {/* Other User Info */}
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
