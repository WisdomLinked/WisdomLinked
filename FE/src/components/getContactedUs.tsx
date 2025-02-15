import React, { useEffect, useState } from "react";
import { doGetContactedUs } from "../api/api";
import { DateRangePicker, createStaticRanges } from "react-date-range";

// Import default styles
import "react-date-range/dist/styles.css";
// Overwrite default theme with partial dark theme
// (We also pass a `theme` prop below for further color overrides)
import "react-date-range/dist/theme/default.css";

interface ContactedUsItem {
    _id: string;
    name: string;
    email: string;
    countryCode?: string;
    contactNumber?: string;
    issue?: string;
    createdAt: string;
}

// Utility to format date for the backend
function formatDateYYYY_MM_DD(dateObj: Date): string {
    const yyyy = dateObj.getFullYear();
    const mm = `0${dateObj.getMonth() + 1}`.slice(-2);
    const dd = `0${dateObj.getDate()}`.slice(-2);
    return `${yyyy}-${mm}-${dd}`;
}

// Some custom static ranges
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
    // State
    const [contactedUsList, setContactedUsList] = useState<ContactedUsItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [filterName, setFilterName] = useState("");
    const [filterEmail, setFilterEmail] = useState("");

    // Sorting
    const [sortBy, setSortBy] = useState("name");     // "name" or "createdAt"
    const [sortOrder, setSortOrder] = useState("asc"); // "asc" or "desc"

    // Date Range
    const [datePickerShow, setDatePickerShow] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // For <DateRangePicker>
    const [selectionRange, setSelectionRange] = useState({
        startDate: new Date(),
        endDate: new Date(),
        key: "selection",
    });

    // Handler when user picks date range
    const handleSelect = (ranges: any) => {
        const { startDate, endDate } = ranges.selection;
        setDateFrom(formatDateYYYY_MM_DD(startDate));
        setDateTo(formatDateYYYY_MM_DD(endDate));
        setSelectionRange({ startDate, endDate, key: "selection" });
    };

    // Clear date range
    const clearDateRange = () => {
        setDateFrom("");
        setDateTo("");
        setSelectionRange({
            startDate: new Date(),
            endDate: new Date(),
            key: "selection",
        });
    };

    // Fetch data from backend
    const fetchContactedUs = async () => {
        try {
            setIsLoading(true);
            const filters: any = {
                sortBy,
                sortOrder,
            };
            // Add filters if provided
            if (filterName.trim()) {
                filters.name = filterName.trim();
            }
            if (filterEmail.trim()) {
                filters.email = filterEmail.trim();
            }
            if (dateFrom && dateTo) {
                // Provide date range to backend
                filters.dateFrom = dateFrom; // e.g. "2025-02-15"
                filters.dateTo = dateTo;     // e.g. "2025-02-20"
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

    // Re-fetch whenever filters / sorts / date range changes
    useEffect(() => {
        fetchContactedUs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterName, filterEmail, dateFrom, dateTo, sortBy, sortOrder]);

    return (
        <div className="min-h-screen p-6 bg-[#181818] text-white">
            <h2 className="text-2xl font-semibold text-[#31B099] mb-6">
                ContactedUs Records
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

                        {/* Clear button if date range is set */}
                        {dateFrom && dateTo && (
                            <button
                                className="bg-[#31B099] text-black px-2 py-1 rounded mr-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearDateRange();
                                }}
                            >
                                Clear
                            </button>
                        )}
                        {/* Arrow icon */}
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
                            {/* overlay to close */}
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
                                    // Pass a theme object to override default (white) background:
                                    // theme={{
                                    //     background: "#252525",
                                    //     text: "#ffffff",
                                    //     selectionColor: "#31B099",
                                    //     fontFamily: "inherit",
                                    // }}
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
                    {contactedUsList.map((item) => (
                        <div
                            key={item._id}
                            className="p-4 rounded-lg border border-gray-700 bg-[#252525] shadow-lg"
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
                            <p className="text-gray-300">
                                <strong className="text-white">Reason:</strong> {item.issue}
                            </p>
                            <p className="text-gray-300">
                                <strong className="text-white">Created At:</strong>{" "}
                                {new Date(item.createdAt).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
