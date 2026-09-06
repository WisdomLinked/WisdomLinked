import React, { useEffect, useRef, useState } from "react";
import { getUserFeedbacks, doFilterUsers, getAllFeedbacks } from "../api/api";
import Pagination from "./Pagination";

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
}

const TYPEAHEAD_PAGE_SIZE = 12;
const ALL_PAGE_SIZE = 20;

function FeedbackCard({ fb, showUser }: { fb: FeedbackItem; showUser?: boolean }) {
    return (
        <div className="p-4 rounded-2xl border border-wl-line bg-white shadow-[0_10px_30px_rgba(35,76,106,0.06)] text-left">
            {showUser ? (
                <p className="text-wl-ink/90 mb-1">
                    <strong className="text-wl-brand">From:</strong>{" "}
                    {fb.userUsername || "—"} ({fb.userEmail || "—"})
                    {fb.userRole ? ` · ${fb.userRole}` : ""}
                </p>
            ) : null}
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
                <strong className="text-wl-brand">Feedback:</strong> {fb.description || "—"}
            </p>
            {fb.date || fb.start ? (
                <p className="text-wl-ink/90">
                    <strong className="text-wl-brand">Date:</strong>{" "}
                    {new Date(fb.date || fb.start || "").toLocaleString()}
                </p>
            ) : null}
            {fb.otherUser ? (
                <p className="text-wl-ink/90">
                    <strong className="text-wl-brand">Counterpart:</strong>{" "}
                    {fb.otherUser.username} (Role: {fb.otherUser.role})
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
    const [allTotalPage, setAllTotalPage] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    const loadAll = async (page: number) => {
        try {
            setIsLoadingAll(true);
            setAllPage(page);
            const res = await getAllFeedbacks({ numPerPage: ALL_PAGE_SIZE, currentPage: page });
            setAllFeedbacks(Array.isArray(res?.result) ? res.result : []);
            const total = res?.totalCount || 0;
            const pages = total === 0 ? 0 : Math.ceil(total / ALL_PAGE_SIZE) - 1;
            setAllTotalPage(pages < 0 ? 0 : pages);
        } catch (err) {
            console.log(err);
            setAllFeedbacks([]);
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
                            <input
                                type="text"
                                className="w-full bg-white text-wl-ink px-3 py-2 rounded-[15px] border border-lightgrey focus:outline-none focus:ring-2 focus:ring-wl-brand/30 transition-all placeholder:text-grey"
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
                                <FeedbackCard key={idx} fb={fb} showUser />
                            ))}
                        </div>
                        {allTotalPage > 0 ? (
                            <div className="mt-6">
                                <Pagination
                                    currentPage={allPage}
                                    totalPage={allTotalPage}
                                    goPrev={() => loadAll(Math.max(0, allPage - 1))}
                                    goNext={() => loadAll(Math.min(allTotalPage, allPage + 1))}
                                    goFirst={() => loadAll(0)}
                                    goLast={() => loadAll(allTotalPage)}
                                />
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}
