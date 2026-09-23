import React, { useEffect, useRef, useState } from "react";
import { getUserFeedbacks, doFilterUsers, getAllFeedbacks } from "../api/api";
import Pagination from "./Pagination";
import ClearableInput from "./ui/ClearableInput";

interface UserType {
    _id: string;
    email: string;
    username: string;
}

interface FeedbackItem {
    event?: { _id: string; title: string } | null;
    groupChat?: { _id: string; name: string } | null;
    eventType?: string;
    start?: string;
    end?: string;
    totalTimeSpent?: number;
    rating: number;
    description: string;
    date?: string;
    otherUserId?: string;
    otherUser: {
        _id: string;
        username: string;
        role: string;
        image?: string;
        email?: string;
    } | null;
    userEmail?: string;
    userUsername?: string;
    userRole?: string;
    meetingKind?: "seminar" | "individual" | "community" | "unknown";
    meetingName?: string | null;
}

function personLine(
    name?: string | null,
    email?: string | null,
    role?: string | null,
): string {
    const who = email || name || "—";
    return role ? `${who} (${role})` : who;
}

function sessionHeading(fb: FeedbackItem): string {
    const name = fb.meetingName || fb.groupChat?.name || null;
    switch (fb.meetingKind) {
        case "seminar":
            return name ? `Seminar: ${name}` : "Seminar";
        case "community":
            return name ? `Community: ${name}` : "Community";
        case "individual":
            return "1:1 Appointment";
        default:
            break;
    }
    if (fb.eventType === "seminar" && fb.groupChat) return `Seminar: ${fb.groupChat.name || "N/A"}`;
    if (fb.eventType === "event" && fb.event) return "1:1 Appointment";
    return "Session";
}

const TYPEAHEAD_PAGE_SIZE = 12;
const ALL_PAGE_SIZE = 20;

function FeedbackCard({ fb }: { fb: FeedbackItem }) {
    return (
        <div className="p-4 rounded-2xl border border-wl-line bg-white shadow-[0_10px_30px_rgba(35,76,106,0.06)] text-left">
            <p className="text-wl-ink/90 mb-1">
                <strong className="text-wl-brand">{sessionHeading(fb)}</strong>
            </p>
            {fb.otherUser ? (
                <p className="text-wl-ink/90">
                    <strong className="text-wl-brand">Given by:</strong>{" "}
                    {personLine(fb.otherUser.username, fb.otherUser.email, fb.otherUser.role)}
                </p>
            ) : null}
            <p className="text-wl-ink/90">
                <strong className="text-wl-brand">Given to:</strong>{" "}
                {personLine(fb.userUsername, fb.userEmail, fb.userRole)}
            </p>
            <p className="text-wl-ink/90">
                <strong className="text-wl-brand">Rating:</strong> {fb.rating}
            </p>
            <p className="text-wl-ink/90">
                <strong className="text-wl-brand">Feedback:</strong> {fb.description || "—"}
            </p>
            {fb.date || fb.start ? (
                <p className="text-wl-ink/90">
                    <strong className="text-wl-brand">Date:</strong>{" "}
                    {new Date(fb.date || fb.start || "").toLocaleString()}
                </p>
            ) : null}
        </div>
    );
}

export default function Feedback() {
    const [users, setUsers] = useState<UserType[]>([]);
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [allFeedbacks, setAllFeedbacks] = useState<FeedbackItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);
    const [isLoadingAll, setIsLoadingAll] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [allPage, setAllPage] = useState(0);
    const [allTotalCount, setAllTotalCount] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    const loadAll = async (page: number) => {
        try {
            setIsLoadingAll(true);
            setAllPage(page);
            const res = await getAllFeedbacks({ numPerPage: ALL_PAGE_SIZE, currentPage: page });
            setAllFeedbacks(Array.isArray(res?.result) ? res.result : []);
            setAllTotalCount(res?.totalCount || 0);
        } catch (err) {
            console.log(err);
            setAllFeedbacks([]);
            setAllTotalCount(0);
        } finally {
            setIsLoadingAll(false);
        }
    };

    useEffect(() => {
        loadAll(0);
    }, []);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const searchUsers = async (term: string) => {
        const q = term.trim();
        if (q.length < 2) {
            setUsers([]);
            setIsSearching(false);
            return;
        }
        try {
            setIsSearching(true);
            const looksLikeEmail = q.includes("@");
            const response = await doFilterUsers({
                email: looksLikeEmail ? q : "",
                username: looksLikeEmail ? "" : q,
                sortBy: "createdAt",
                sortOrder: "DESC",
                currentPage: 0,
                numPerPage: TYPEAHEAD_PAGE_SIZE,
            });
            if (response && Array.isArray(response.result)) {
                setUsers(response.result);
                setShowDropdown(true);
            } else {
                setUsers([]);
            }
        } catch (err) {
            console.log(err);
            setUsers([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setSelectedUserId("");
        setFeedbacks([]);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()) {
            setUsers([]);
            setShowDropdown(false);
            return;
        }
        debounceRef.current = setTimeout(() => searchUsers(value), 300);
    };

    const handleSelectUser = async (user: UserType) => {
        try {
            setSearchTerm(`${user.username} (${user.email})`);
            setSelectedUserId(user._id);
            setShowDropdown(false);
            setUsers([]);
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
        setUsers([]);
        setShowDropdown(false);
    };

    return (
        <div className="w-full min-h-full pt-10 overflow-y-auto bg-wl-page text-wl-ink px-[18px] pb-10">
            <div className="w-full max-w-[900px] mx-auto flex flex-col items-center">
                <h2 className="text-center text-2xl font-semibold text-wl-brand mb-2 w-full">
                    Feedback
                </h2>
                <p className="text-sm text-wl-muted mb-8 text-center">
                    Platform-wide feedback by default. Optionally filter to a single user.
                </p>

                <div className="mb-6 w-full max-w-md">
                    <label className="text-wl-muted block mb-2 text-sm text-center">
                        Filter by user (optional):
                    </label>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        <div className="relative w-full min-w-[200px] flex-1" ref={wrapRef}>
                            <ClearableInput
                                type="text"
                                placeholder="Type name or email (min 2 characters)"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onFocus={() => {
                                    if (users.length > 0 && !selectedUserId) setShowDropdown(true);
                                }}
                            />

                            {showDropdown && !selectedUserId && (
                                <div className="absolute z-10 w-full bg-white mt-1 rounded-xl border border-lightgrey shadow-md max-h-48 overflow-y-auto">
                                    {isSearching ? (
                                        <div className="px-3 py-2 text-sm text-wl-muted">Searching…</div>
                                    ) : users.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-wl-muted">No users found.</div>
                                    ) : (
                                        users.map((user) => (
                                            <div
                                                key={user._id}
                                                onClick={() => handleSelectUser(user)}
                                                className="px-3 py-2 hover:bg-wl-brandSoft cursor-pointer text-sm text-left"
                                            >
                                                {user.username} ({user.email})
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleClear}
                            className="shrink-0 px-5 py-2 rounded-xl border border-wl-brand text-white bg-wl-brand hover:brightness-95 transition-all font-medium text-sm"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {selectedUserId ? (
                    isLoadingFeedbacks ? (
                        <p className="text-wl-muted text-center w-full">Loading feedbacks...</p>
                    ) : feedbacks.length === 0 ? (
                        <p className="text-wl-muted text-center w-full">No feedback found for this user.</p>
                    ) : (
                        <div className="space-y-4 w-full">
                            {feedbacks.map((fb, idx) => (
                                <FeedbackCard key={idx} fb={fb} />
                            ))}
                        </div>
                    )
                ) : isLoadingAll ? (
                    <p className="text-wl-muted text-center w-full">Loading all feedback…</p>
                ) : allFeedbacks.length === 0 ? (
                    <p className="text-wl-muted text-center w-full">No feedback yet.</p>
                ) : (
                    <>
                        <div className="space-y-4 w-full">
                            {allFeedbacks.map((fb, idx) => (
                                <FeedbackCard key={idx} fb={fb} />
                            ))}
                        </div>
                        {allTotalCount > ALL_PAGE_SIZE ? (
                            <Pagination
                                currentPage={allPage}
                                totalCount={allTotalCount}
                                pageSize={ALL_PAGE_SIZE}
                                onPage={loadAll}
                            />
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
