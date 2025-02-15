import React, { useEffect, useState } from "react";
import { doGetContactedUs } from "../api/api";

interface ContactedUsItem {
    _id: string;
    name: string;
    email: string;
    countryCode?: string;
    contactNumber?: string;
    issue?: string;
    createdAt: string;
}

export default function GetContactedUs() {
    // local states
    const [contactedUsList, setContactedUsList] = useState<ContactedUsItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // filter by name
    const [filterName, setFilterName] = useState("");

    // sorting
    const [sortBy, setSortBy] = useState("name"); // 'name' or 'createdAt'
    const [sortOrder, setSortOrder] = useState("asc"); // 'asc' or 'desc'

    // fetch data
    const fetchContactedUs = async () => {
        try {
            setIsLoading(true);
            const filters = {
                name: filterName ? filterName.trim() : undefined,
                sortBy,
                sortOrder
            };
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

    // automatically fetch on mount + whenever filterName, sortBy, sortOrder change
    useEffect(() => {
        fetchContactedUs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterName, sortBy, sortOrder]);

    // UI
    return (
        <div className="min-h-screen p-6 bg-[#181818] text-white">
            <h2 className="text-2xl font-semibold text-[#31B099] mb-6">
                ContactedUs Records
            </h2>

            {/* Filter & Sorting */}
            <div className="mb-4 flex flex-col lg:flex-row lg:space-x-4 space-y-4 lg:space-y-0">
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

            {/* Loading or List */}
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
