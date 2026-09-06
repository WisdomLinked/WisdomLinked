import React, { useEffect, useState } from "react";
import { doGetContactedUs, sendEmailToUser, toggleActionedStatus } from "../api/api";
import { DateRangePicker, createStaticRanges } from "react-date-range";
import SelectionWithCheckBox from "./SelectionWithCheckBox";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { store } from '../store';
import { showErrorAlert, showSuccessAlert } from '../actions/alertActions';

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

const actionedOptions = [
    { value: "", label: "All" },
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
];

const sortByOptions = [
    { value: "name", label: "Name" },
    { value: "createdAt", label: "Created at" },
];

const sortOrderOptions = [
    { value: "asc", label: "Ascending" },
    { value: "desc", label: "Descending" },
];

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

    const handleSendEmail = async (id: string, email: string) => {
        try {
            const adminRawMessage = adminMessages[id] || "";

            if (!adminRawMessage.trim()) {
                store.dispatch(showErrorAlert('Please enter a message before sending.'));
                return;
            }

            const res = await sendEmailToUser(email, adminRawMessage);
            if (res && res.status === "SUCCESS") {
                store.dispatch(showSuccessAlert('Email sent successfully!'));
                setAdminMessages((prev) => ({ ...prev, [id]: "" }));
            } else {
                store.dispatch(showErrorAlert('Failed to send email.'));
            }
        } catch (error) {
            console.error("Error sending email:", error);
            store.dispatch(showErrorAlert('An error occurred while sending email.'));
        }
    };

    return (
        <div className="w-full min-h-full pt-10 overflow-y-auto bg-wl-page text-wl-ink px-[18px] pb-10">
            <style>{`
                .rdrCalendarWrapper,
                .rdrDateRangeWrapper {
                    background-color: #ffffff !important;
                    color: #1a2d3a !important;
                }
                .rdrDefinedRangesWrapper,
                .rdrStaticRangeLabel {
                    background-color: #f8f7f4 !important;
                    color: #234c6a !important;
                }
                .rdrStaticRangeLabel:hover {
                    background-color: #E8EEF4 !important;
                }
                .rdrMonthAndYearWrapper,
                .rdrMonthAndYearPickers select {
                    background-color: #ffffff !important;
                    color: #1a2d3a !important;
                }
                .rdrWeekDay {
                    color: #6C7278 !important;
                }
                .rdrSelected,
                .rdrInRange,
                .rdrStartEdge,
                .rdrEndEdge {
                    opacity: 0.95;
                }
                .rdrDayNumber span {
                    color: #1a2d3a !important;
                }
                .rdrDayPassive .rdrDayNumber span {
                    color: #9ca3af !important;
                }
            `}</style>

            <div className="w-full max-w-[1200px] mx-auto">
            <h2 className="text-center text-2xl font-semibold text-wl-brand mb-8">
                Contacted Us Records (Admin View)
            </h2>

            {/* Filters & Sorting — centered */}
            <div className="flex flex-wrap justify-center items-end gap-x-4 gap-y-5 mb-8">
                <div className="flex flex-col w-full min-w-[200px] max-w-[280px]">
                    <label className="text-wl-muted mb-1 text-sm text-center">Search by name</label>
                    <input
                        className="bg-white text-wl-ink h-[50px] px-4 rounded-[15px] border border-lightgrey focus:outline-none focus:ring-2 focus:ring-wl-brand/30 placeholder:text-grey text-[14px]"
                        placeholder="Type a name"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                    />
                </div>

                <div className="flex flex-col w-full min-w-[200px] max-w-[280px]">
                    <label className="text-wl-muted mb-1 text-sm text-center">Search by email</label>
                    <input
                        className="bg-white text-wl-ink h-[50px] px-4 rounded-[15px] border border-lightgrey focus:outline-none focus:ring-2 focus:ring-wl-brand/30 placeholder:text-grey text-[14px]"
                        placeholder="Type an email"
                        value={filterEmail}
                        onChange={(e) => setFilterEmail(e.target.value)}
                    />
                </div>

                <div className="flex flex-col w-full min-w-[200px] max-w-[260px]">
                    <label className="text-wl-muted mb-1 text-sm text-center">Filter by actioned</label>
                    <SelectionWithCheckBox
                        options={actionedOptions}
                        selectedOptions={
                            actionedOptions.find((o) => o.value === filterActioned) ?? actionedOptions[0]
                        }
                        set_selectedOptions={(opt: { value: string }) => setFilterActioned(opt.value)}
                        placeholder="Actioned status"
                        isMulti={false}
                    />
                </div>

                <div className="flex flex-col relative w-full min-w-[220px] max-w-[320px]">
                    <label className="text-wl-muted mb-1 text-sm text-center">Date range</label>
                    <div
                        className="bg-white text-wl-ink h-[50px] px-4 rounded-[15px] border border-lightgrey flex items-center justify-between cursor-pointer gap-2"
                        onClick={() => setDatePickerShow(!datePickerShow)}
                    >
                        {dateFrom && dateTo ? (
                            <span className="text-sm text-wl-ink truncate">
                                {dateFrom} ~ {dateTo}
                            </span>
                        ) : (
                            <span className="text-wl-muted text-sm">Select range</span>
                        )}
                        <div className="flex items-center shrink-0 gap-2">
                            {dateFrom && dateTo && (
                                <button
                                    type="button"
                                    className="bg-wl-brand text-white px-2 py-1 rounded-lg text-xs font-medium hover:brightness-95 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearDateRange();
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                            <svg
                                className={`${datePickerShow ? "rotate-180" : ""} transition-all text-wl-brand`}
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
                    </div>
                    {datePickerShow && (
                        <>
                            <div
                                className="fixed top-0 left-0 w-full h-full z-10"
                                onClick={() => setDatePickerShow(false)}
                            />
                            <div
                                className="absolute z-20 top-[58px] left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 border border-lightgrey rounded-xl shadow-lg bg-white overflow-hidden"
                                style={{ minWidth: "300px" }}
                            >
                                <DateRangePicker
                                    onChange={handleSelect}
                                    ranges={[selectionRange]}
                                    staticRanges={customStaticRanges}
                                    inputRanges={[]}
                                    direction="vertical"
                                    rangeColors={["#234C6A"]}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-col w-full min-w-[200px] max-w-[260px]">
                    <label className="text-wl-muted mb-1 text-sm text-center">Sort by</label>
                    <SelectionWithCheckBox
                        options={sortByOptions}
                        selectedOptions={sortByOptions.find((o) => o.value === sortBy) ?? sortByOptions[0]}
                        set_selectedOptions={(opt: { value: string }) => setSortBy(opt.value)}
                        placeholder="Sort field"
                        isMulti={false}
                    />
                </div>

                <div className="flex flex-col w-full min-w-[180px] max-w-[260px]">
                    <label className="text-wl-muted mb-1 text-sm text-center">Order</label>
                    <SelectionWithCheckBox
                        options={sortOrderOptions}
                        selectedOptions={
                            sortOrderOptions.find((o) => o.value === sortOrder) ?? sortOrderOptions[0]
                        }
                        set_selectedOptions={(opt: { value: string }) => setSortOrder(opt.value)}
                        placeholder="Order"
                        isMulti={false}
                    />
                </div>
            </div>

            {/* Data Display */}
            {isLoading ? (
                <p className="text-wl-muted text-center">Loading ContactedUs entries...</p>
            ) : contactedUsList.length === 0 ? (
                <p className="text-wl-muted text-center">No records found.</p>
            ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                    {contactedUsList.map((item) => {
                        const isActionedYes = item.actioned === "Yes";
                        return (
                            <div
                                key={item._id}
                                className={`p-4 rounded-2xl border border-wl-line shadow-sm transition-shadow ${
                                    isActionedYes ? "bg-emerald-50/80" : "bg-wl-card"
                                }`}
                            >
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Name:</strong> {item.name}
                                </p>
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Email:</strong> {item.email}
                                </p>
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Contact Number:</strong>{" "}
                                    {(item.countryCode || "") + " " + (item.contactNumber || "")}
                                </p>
                                {/* Reason row, highlighted green if Actioned: Yes */}
                                <p className="text-wl-ink/90">
                                    <strong
                                        className={`mr-1 ${
                                            isActionedYes ? "text-green" : "text-wl-brand"
                                        }`}
                                    >
                                        Reason:
                                    </strong>
                                    <span
                                        className={`${isActionedYes ? "text-green" : ""}`}
                                    >
                                        {item.issue}
                                    </span>
                                </p>
                                <p className="text-wl-ink/90">
                                    <strong className="text-wl-brand">Created At:</strong>{" "}
                                    {new Date(item.createdAt).toLocaleString()}
                                </p>
                                <p className="text-wl-ink/90">
                                    <strong
                                        className={`mr-1 ${
                                            isActionedYes ? "text-green" : "text-wl-brand"
                                        }`}
                                    >
                                        Actioned:
                                    </strong>
                                    <span
                                        className={`${isActionedYes ? "text-green" : ""}`}
                                    >
                                        {item.actioned}
                                    </span>
                                </p>

                                <button
                                    onClick={() => handleToggleActioned(item._id)}
                                    className="mt-2 bg-green text-white px-2 py-1 rounded font-semibold hover:brightness-95 transition-colors"
                                >
                                    Toggle Actioned
                                </button>

                                <div className="mt-4">
                                    <label className="text-wl-muted text-sm">Message to User:</label>
                                    <textarea
                                        className="block w-full mt-1 bg-wl-card text-wl-ink p-2 rounded-lg border border-wl-line focus:outline-none focus:ring-2 focus:ring-green/40"
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
                                        className="mt-2 bg-green text-white px-3 py-2 rounded font-semibold hover:brightness-95 transition-colors"
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
        </div>
    );
}
