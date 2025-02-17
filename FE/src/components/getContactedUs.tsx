import React, { useEffect, useState } from "react";
import { doGetContactedUs, sendEmailToUser, toggleActionedStatus } from "../api/api";
import { DateRangePicker, createStaticRanges } from "react-date-range";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

interface ContactedUsItem {
    _id: string;
    name: string;
    email: string;
    countryCode?: string;
    contactNumber?: string;
    issue?: string;
    actioned: string;
    createdAt: string;
}

function formatDateYYYY_MM_DD(dateObj: Date): string {
    const yyyy = dateObj.getFullYear();
    const mm = `0${dateObj.getMonth() + 1}`.slice(-2);
    const dd = `0${dateObj.getDate()}`.slice(-2);
    return `${yyyy}-${mm}-${dd}`;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const currentDate = new Date().getDate();

const customStaticRanges = createStaticRanges([
    {
        label: "Last month",
        range: () => ({
            startDate: new Date(currentYear, currentMonth - 2, currentDate - 1),
            endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
        }),
    },
    {
        label: "Last quarter",
        range: () => ({
            startDate: new Date(currentYear, currentMonth - 4, currentDate - 1),
            endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
        }),
    },
    {
        label: "Last 6 months",
        range: () => ({
            startDate: new Date(currentYear, currentMonth - 7, currentDate - 1),
            endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
        }),
    },
    {
        label: "Last year",
        range: () => ({
            startDate: new Date(currentYear - 1, currentMonth - 1, currentDate - 1),
            endDate: new Date(currentYear, currentMonth - 1, currentDate - 1),
        }),
    },
]);

export default function GetContactedUs() {
    const [contactedUsList, setContactedUsList] = useState<ContactedUsItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [filterName, setFilterName] = useState("");
    const [filterEmail, setFilterEmail] = useState("");

    const [filterActioned, setFilterActioned] = useState("");

    const [sortBy, setSortBy] = useState("name"); // "name" or "createdAt"
    const [sortOrder, setSortOrder] = useState("asc"); // "asc" or "desc"

    const [datePickerShow, setDatePickerShow] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const [selectionRange, setSelectionRange] = useState({
        startDate: new Date(),
        endDate: new Date(),
        key: "selection",
    });

    const [adminMessages, setAdminMessages] = useState<{ [key: string]: string }>({});

    const handleSelect = (ranges: any) => {
        const { startDate, endDate } = ranges.selection;
        setDateFrom(formatDateYYYY_MM_DD(startDate));
        setDateTo(formatDateYYYY_MM_DD(endDate));
        setSelectionRange({ startDate, endDate, key: "selection" });
    };

    const clearDateRange = () => {
        setDateFrom("");
        setDateTo("");
        setSelectionRange({
            startDate: new Date(),
            endDate: new Date(),
            key: "selection",
        });
    };

    const fetchContactedUs = async () => {
        try {
            setIsLoading(true);
            const filters: any = {
                sortBy,
                sortOrder,
            };

            if (filterName.trim()) {
                filters.name = filterName.trim();
            }
            if (filterEmail.trim()) {
                filters.email = filterEmail.trim();
            }
            if (dateFrom && dateTo) {
                filters.dateFrom = dateFrom;
                filters.dateTo = dateTo;
            }

            if (filterActioned) {
                filters.actioned = filterActioned;
            }

            const res = await doGetContactedUs(filters);
            if (res && res.status === "SUCCESS" && res.data) {
                setContactedUsList(res.data);
            } else {
                setContactedUsList([]);
            }
        } catch (error) {
            console.error(error);
            setContactedUsList([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContactedUs();
    }, [filterName, filterEmail, dateFrom, dateTo, sortBy, sortOrder, filterActioned]);

    const handleToggleActioned = async (id: string) => {
        try {
            const res = await toggleActionedStatus(id);
            if (res && res.actioned) {
                setContactedUsList((prev) =>
                    prev.map((item) => {
                        if (item._id === id) {
                            return { ...item, actioned: res.actioned };
                        }
                        return item;
                    })
                );
            }
        } catch (error) {
            console.error("Error toggling actioned status:", error);
        }
    };

    const createEmailTemplate = (adminRawMessage: string) => {
        return `
Hello from WisdomLink.io,

Thank you for reaching out to us. Whether you’re seeking academic guidance or offering your expertise, we appreciate your interest.

Here's our response to your inquiry:

${adminRawMessage}

If you have any further questions or need more assistance, please let us know.

Warm Regards,
The WisdomLink.io Team
        `.trim();
    };

    const handleSendEmail = async (id: string, email: string) => {
        try {
            const adminRawMessage = adminMessages[id] || "";

            if (!adminRawMessage.trim()) {
                alert("Please enter a message before sending.");
                return;
            }

            const finalMessage = createEmailTemplate(adminRawMessage);

            const res = await sendEmailToUser(email, finalMessage);
            if (res && res.status === "SUCCESS") {
                alert("Email sent successfully!");
                setAdminMessages((prev) => ({ ...prev, [id]: "" }));
            } else {
                alert("Failed to send email.");
            }
        } catch (error) {
            console.error("Error sending email:", error);
            alert("An error occurred while sending email.");
        }
    };

    return (
        <div className="min-h-screen p-6 bg-[#181818] text-white">
            {/* Inline style overrides for react-date-range */}
            <style>{`
                .rdrCalendarWrapper,
                .rdrDateRangeWrapper {
                    background-color: #252525 !important;
                    color: #ffffff !important;
                }
                .rdrDefinedRangesWrapper,
                .rdrStaticRangeLabel {
                    background-color: #252525 !important;
                    color: #ffffff !important;
                }
                .rdrStaticRangeLabel:hover {
                    background-color: #333333 !important;
                }
                .rdrMonthAndYearWrapper,
                .rdrMonthAndYearPickers select {
                    background-color: #252525 !important;
                    color: #ffffff !important;
                }
                .rdrWeekDay {
                    color: #bbbbbb !important;
                }
                .rdrSelected,
                .rdrInRange,
                .rdrStartEdge,
                .rdrEndEdge {
                    opacity: 0.9;
                }
                .rdrDayNumber span {
                    color: #ffffff !important;
                }
                .rdrDayPassive .rdrDayNumber span {
                    color: #555555 !important;
                }
            `}</style>

            <h2 className="text-2xl font-semibold text-[#31B099] mb-6">
                Contacted Us Records (Admin View)
            </h2>

            {/* Filters & Sorting */}
            <div className="flex flex-col lg:flex-row lg:space-x-4 space-y-4 lg:space-y-0 mb-4">
                {/* Filter by Name */}
                <div className="flex flex-col">
                    <label className="text-gray-300 mb-1">Search by Name:</label>
                    <input
                        className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#31B099]"
                        placeholder="Type a name"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                    />
                </div>

                {/* Filter by Email */}
                <div className="flex flex-col">
                    <label className="text-gray-300 mb-1">Search by Email:</label>
                    <input
                        className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#31B099]"
                        placeholder="Type an email"
                        value={filterEmail}
                        onChange={(e) => setFilterEmail(e.target.value)}
                    />
                </div>

                {/* Filter by Actioned (Yes/No/All) */}
                <div className="flex flex-col">
                    <label className="text-gray-300 mb-1">Filter by Actioned:</label>
                    <select
                        className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700"
                        value={filterActioned}
                        onChange={(e) => setFilterActioned(e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </div>

                {/* Date Range Picker */}
                <div className="flex flex-col relative">
                    <label className="text-gray-300 mb-1">Date Range:</label>
                    <div
                        className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none
                                   focus:ring-2 focus:ring-[#31B099] flex items-center justify-between cursor-pointer"
                        onClick={() => setDatePickerShow(!datePickerShow)}
                    >
                        {dateFrom && dateTo ? (
                            <span className="text-sm mr-2">
                                {dateFrom} ~ {dateTo}
                            </span>
                        ) : (
                            <span className="text-gray-400 text-sm mr-2">Select Range</span>
                        )}
                        {dateFrom && dateTo && (
                            <button
                                className="bg-[#31B099] text-black px-2 py-1 rounded mr-2 hover:bg-[#28a286] transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearDateRange();
                                }}
                            >
                                Clear
                            </button>
                        )}
                        <svg
                            className={`${datePickerShow ? "rotate-180" : ""} transition-all`}
                            width="14"
                            height="9"
                            viewBox="0 0 14 9"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M13.7812 1.46094C13.9375 1.58594 13.9375 1.83594 13.7812 1.99219L7.25 8.52344C7.09375 8.67969 6.875 8.67969 6.71875 8.52344L0.1875 1.99219C0.03125 1.83594 0.03125 1.58594 0.1875 1.46094L0.78125 0.835938C0.9375 0.679688 1.1875 0.679688 1.3125 0.835938L7 6.49219L12.6562 0.835938C12.7812 0.679688 13.0312 0.679688 13.1875 0.835938L13.7812 1.46094Z"
                                fill="currentColor"
                            />
                        </svg>
                    </div>
                    {datePickerShow && (
                        <>
                            <div
                                className="fixed top-0 left-0 w-full h-full z-10"
                                onClick={() => setDatePickerShow(false)}
                            />
                            <div
                                className="absolute z-20 top-[65px] lg:top-[60px] left-0 border border-gray-700"
                                style={{ minWidth: "300px", background: "#252525" }}
                            >
                                <DateRangePicker
                                    onChange={handleSelect}
                                    ranges={[selectionRange]}
                                    staticRanges={customStaticRanges}
                                    inputRanges={[]}
                                    direction="vertical"
                                    rangeColors={["#31B099"]}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Sort By */}
                <div className="flex flex-col">
                    <label className="text-gray-300 mb-1">Sort By:</label>
                    <select
                        className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="name">Name</option>
                        <option value="createdAt">Created At</option>
                    </select>
                </div>

                {/* Sort Order */}
                <div className="flex flex-col">
                    <label className="text-gray-300 mb-1">Order:</label>
                    <select
                        className="bg-[#252525] text-white px-3 py-2 rounded-md border border-gray-700"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    >
                        <option value="asc">ASC</option>
                        <option value="desc">DESC</option>
                    </select>
                </div>
            </div>

            {/* Data Display */}
            {isLoading ? (
                <p className="text-gray-400">Loading ContactedUs entries...</p>
            ) : contactedUsList.length === 0 ? (
                <p className="text-gray-400">No records found.</p>
            ) : (
                <div className="space-y-4">
                    {contactedUsList.map((item) => {
                        const isActionedYes = item.actioned === "No";
                        return (
                            <div
                                key={item._id}
                                className={`p-4 rounded-lg border border-gray-700 shadow-lg hover:shadow-[0_0_10px_2px_rgba(49,176,153,0.5)] transition-shadow ${
                                    isActionedYes ? "bg-[#333333]" : "bg-[#252525]"
                                }`}
                            >
                                <p className="text-gray-300">
                                    <strong className="text-white">Name:</strong> {item.name}
                                </p>
                                <p className="text-gray-300">
                                    <strong className="text-white">Email:</strong> {item.email}
                                </p>
                                <p className="text-gray-300">
                                    <strong className="text-white">Contact Number:</strong>{" "}
                                    {(item.countryCode || "") + " " + (item.contactNumber || "")}
                                </p>
                                {/* Reason row, highlighted green if Actioned: Yes */}
                                <p className="text-gray-300">
                                    <strong
                                        className={`mr-1 ${
                                            isActionedYes ? "text-[#31B099]" : "text-white"
                                        }`}
                                    >
                                        Reason:
                                    </strong>
                                    <span
                                        className={`${isActionedYes ? "text-[#31B099]" : ""}`}
                                    >
                                        {item.issue}
                                    </span>
                                </p>
                                <p className="text-gray-300">
                                    <strong className="text-white">Created At:</strong>{" "}
                                    {new Date(item.createdAt).toLocaleString()}
                                </p>
                                {/* Actioned row, highlighted green if Actioned: Yes */}
                                <p className="text-gray-300">
                                    <strong
                                        className={`mr-1 ${
                                            isActionedYes ? "text-[#31B099]" : "text-white"
                                        }`}
                                    >
                                        Actioned:
                                    </strong>
                                    <span
                                        className={`${isActionedYes ? "text-[#31B099]" : ""}`}
                                    >
                                        {item.actioned}
                                    </span>
                                </p>

                                {/* Toggle Actioned Button */}
                                <button
                                    onClick={() => handleToggleActioned(item._id)}
                                    className="mt-2 bg-[#31B099] text-black px-2 py-1 rounded font-semibold
                                               hover:bg-[#28a286] transition-colors"
                                >
                                    Toggle Actioned
                                </button>

                                {/* Textbox and Send Email Button for admin to contact user */}
                                <div className="mt-4">
                                    <label className="text-gray-300">Message to User:</label>
                                    <textarea
                                        className="block w-full mt-1 bg-[#1f1f1f] text-white p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#31B099]"
                                        rows={3}
                                        value={adminMessages[item._id] || ""}
                                        onChange={(e) =>
                                            setAdminMessages((prev) => ({
                                                ...prev,
                                                [item._id]: e.target.value,
                                            }))
                                        }
                                    />
                                    <button
                                        onClick={() => handleSendEmail(item._id, item.email)}
                                        className="mt-2 bg-[#31B099] text-black px-3 py-2 rounded font-semibold
                                                   hover:bg-[#28a286] transition-colors"
                                    >
                                        Send Email
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
