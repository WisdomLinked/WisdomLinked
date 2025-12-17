import React, { useEffect, useState } from "react";
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import {
    doFilterUsers,
    doUpdateProfileByAdmin,
    profileImageFetch
} from "../../../../api/api";

import {
    doGetPendingUsers,
    doGetPendingLogins,
    doDeletePendingUserById,
    doDeletePendingLoginById,
    doActivatePendingUserById
} from "../../../../api/api";

import Avatar from "../../../../components/Avatar";
import LoadingPlaceHolder from "../../../../components/LoadingPlaceholder";
import ManageModal from "./manageModal";
import AuditModal from "./auditModal";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";

const UserMgmt = () => {
    const dataTypeOptions = [
        { value: "User", label: "User" },
        { value: "PendingUser", label: "PendingUser" },
        { value: "PendingLogin", label: "PendingLogin" },
    ];

    const roles = [
        { value: "", label: "All" },
        { value: "expert", label: "Expert" },
        { value: "customer", label: "Customer" }
    ];

    const sorts = [
        { value: "ASC", label: "ASC" },
        { value: "DESC", label: "DESC" }
    ];

    const [dataType, set_dataType] = useState<any>(dataTypeOptions[0]);

    const [users, set_users] = useState<any[]>([]);
    const [numPerPage, set_numPerPage] = useState<number>(5);
    const [currentPage, set_currentPage] = useState<number>(0);
    const [totalCount, set_totalCount] = useState<number>(0);
    const [totalPage, set_totalPage] = useState<number>(0);

    const [sortBy, set_sortBy] = useState<any>(sorts[0]);
    const [role, set_role] = useState<any>(roles[0]);
    const [email, set_email] = useState<string>("");
    const [username, set_username] = useState<string>("");

    const [pendingUsers, set_pendingUsers] = useState<any[]>([]);
    const [pendingLogins, set_pendingLogins] = useState<any[]>([]);

    const [selectedUser, set_selectedUser] = useState<any>(null);
    const [manageModalShow, set_manageModalShow] = useState<boolean>(false);
    const [auditModalShow, set_auditModalShow] = useState<boolean>(false);
    const [isFirstLoad, set_isFirstLoad] = useState<boolean>(true);

    const filterUsers = async (pageNum: number) => {
        try {
            SetLoadingStatus(true);
            set_currentPage(pageNum);

            const res = await doFilterUsers({
                email,
                username,
                role: role.value,
                sortBy: "createdAt",
                sortOrder: "DESC", // or use sortBy.value if using ASC/DESC
                currentPage: pageNum,
                numPerPage: numPerPage
            });

            if (res && res.result && Array.isArray(res.result)) {
                const updated = await updateUsersWithImages(res.result);
                set_users(updated);
                const total = res.totalCount || 0;
                set_totalCount(total);
                const totalPages = total % numPerPage ? Math.floor(total / numPerPage) : total / numPerPage - 1;
                set_totalPage(totalPages < 0 ? 0 : totalPages);
            } else {
                // fallback if res.result isn't an array
                set_users([]);
                set_totalCount(0);
                set_totalPage(0);
            }
        } catch (err) {
            console.error(err);
            set_users([]);
            set_totalCount(0);
            set_totalPage(0);
        } finally {
            set_isFirstLoad(false);
            SetLoadingStatus(false);
        }
    };

    const updateUsersWithImages = async (usersList: any[]) => {
        try {
            const updated = await Promise.all(
                usersList.map(async (u) => {
                    if (u.image) {
                        try {
                            const base64Image = await profileImageFetch(u.image, "small");
                            return { ...u, image: base64Image };
                        } catch (error) {
                            console.error("Error loading image:", error);
                            return u;
                        }
                    }
                    return u;
                })
            );
            return updated;
        } catch (error) {
            console.error(error);
            return usersList;
        }
    };

    const fetchPendingUsers = async () => {
        try {
            SetLoadingStatus(true);
            const data = await doGetPendingUsers();
            set_pendingUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            // fallback
            set_pendingUsers([]);
        } finally {
            SetLoadingStatus(false);
        }
    };

    const fetchPendingLogins = async () => {
        try {
            SetLoadingStatus(true);
            const data = await doGetPendingLogins();
            set_pendingLogins(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            // fallback
            set_pendingLogins([]);
        } finally {
            SetLoadingStatus(false);
        }
    };

    const handleDeletePendingUser = async (pendingUserId: string) => {
        try {
            SetLoadingStatus(true);
            await doDeletePendingUserById(pendingUserId);
            fetchPendingUsers();
        } catch (err) {
            console.error(err);
        } finally {
            SetLoadingStatus(false);
        }
    };
    const handleActivatePendingUser = async (pendingUserId: string) => {
        try {
            SetLoadingStatus(true);
            await doActivatePendingUserById(pendingUserId);
            fetchPendingUsers();
        } catch (err) {
            console.error(err);
        } finally {
            SetLoadingStatus(false);
        }
    };

    const handleDeletePendingLogin = async (pendingLoginId: string) => {
        try {
            SetLoadingStatus(true);
            await doDeletePendingLoginById(pendingLoginId);
            fetchPendingLogins();
        } catch (err) {
            console.error(err);
        } finally {
            SetLoadingStatus(false);
        }
    };

    const updateProfile = async (updates: any) => {
        try {
            SetLoadingStatus(true);
            const res = await doUpdateProfileByAdmin(updates);
            if (res && res.result) {
                updateOneUser(res.result);
            }
        } catch (err) {
            console.error(err);
        } finally {
            SetLoadingStatus(false);
        }
    };
    const updateOneUser = (updated: any) => {
        const newArr = [...users];
        const idx = newArr.findIndex(u => u.email === updated.email);
        if (idx >= 0) {
            newArr[idx] = updated;
            set_users(newArr);
        }
    };

    const handleDataTypeChange = (selected: any) => {
        set_dataType(selected);
    };

    useEffect(() => {
        if (dataType.value === "User") {
            filterUsers(0);
        } else if (dataType.value === "PendingUser") {
            fetchPendingUsers();
        } else if (dataType.value === "PendingLogin") {
            fetchPendingLogins();
        }
    }, [dataType]);

    useEffect(() => {
        if (!isFirstLoad && dataType.value === "User") {
            filterUsers(0);
        }
    }, [numPerPage]);

    useEffect(() => {
        if (!isFirstLoad && dataType.value === "User") {
            filterUsers(currentPage);
        }
    }, [currentPage]);

    useEffect(() => {
        if (!isFirstLoad && dataType.value === "User") {
            const timer = setTimeout(() => {
                filterUsers(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [sortBy, role, email, username]);


    const openManageModal = (u: any) => {
        set_manageModalShow(true);
        set_selectedUser(u);
    };
    const closeManageModal = () => {
        set_manageModalShow(false);
        set_selectedUser(null);
    };

    const openAuditModal = (u: any) => {
        set_auditModalShow(true);
        set_selectedUser(u);
    };
    const closeAuditModal = () => {
        set_auditModalShow(false);
        set_selectedUser(null);
    };

    return (
        <div className="relative w-full h-full">
            <div className={`w-full h-full py-10 px-5 ${manageModalShow || auditModalShow ? "overflow-hidden" : "overflow-y-auto"}`}>
                <div className="w-full max-w-[1400px] mx-auto text-white">
                    <div className="text-center text-2xl">User Management</div>

                    <div className="w-full my-4">
                        <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Manage:</div>
                        <SelectionWithCheckBox
                            options={dataTypeOptions}
                            selectedOptions={dataType}
                            set_selectedOptions={handleDataTypeChange}
                            placeholder="Choose Data Type"
                            isMulti={false}
                        />
                    </div>

                    {dataType.value === "User" && (
                        <div className="w-full py-1">
                            <div className="flex justify-between mt-4">
                                <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by email</div>
                                    <input
                                        className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                                        placeholder="Input email"
                                        value={email}
                                        onChange={(e) => set_email(e.target.value)}
                                    />
                                </div>
                                <div className="w-[150px] sm:w-[300px]">
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by role</div>
                                    <SelectionWithCheckBox
                                        options={roles}
                                        selectedOptions={role}
                                        set_selectedOptions={set_role}
                                        placeholder="Filter by role"
                                        isMulti={false}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between mt-2">
                                <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by username</div>
                                    <input
                                        className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
                                        placeholder="Input username"
                                        value={username}
                                        onChange={(e) => set_username(e.target.value)}
                                    />
                                </div>
                                <div className="w-[150px] sm:w-[300px]">
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Sort by username</div>
                                    <SelectionWithCheckBox
                                        options={sorts}
                                        selectedOptions={sortBy}
                                        set_selectedOptions={set_sortBy}
                                        placeholder="Sort by"
                                        isMulti={false}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="w-full rounded-[16px] mt-4 bg-midgrey shadow-md">

                        {dataType.value === "User" && (
                            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                                <div>Total of {totalCount} Users</div>
                                <Pagination
                                    currentPage={currentPage}
                                    totalPage={totalPage}
                                    goFirst={() => set_currentPage(0)}
                                    goPrev={() => set_currentPage(currentPage > 0 ? currentPage - 1 : 0)}
                                    goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                                    goLast={() => set_currentPage(totalPage)}
                                />
                            </div>
                        )}

                        {dataType.value === "User" && (
                            <div className="relative overflow-x-auto w-full px-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-darkgrey">
                                    <tr>
                                        <th className="px-6 py-3 text-center">No</th>
                                        <th className="px-6 py-3 text-center">Avatar</th>
                                        <th className="px-6 py-3 text-center">Email</th>
                                        <th className="px-6 py-3 text-center">Name</th>
                                        <th className="px-6 py-3 text-center">Title</th>
                                        <th className="px-6 py-3 text-center">Role</th>
                                        <th className="px-6 py-3 text-center">Country</th>
                                        <th className="px-6 py-3 text-center">State</th>
                                        <th className="px-6 py-3 text-center">City</th>
                                        <th className="px-6 py-3 text-center">Phone</th>
                                        <th className="px-6 py-3 text-center">Resume</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {users.map((u, idx) => (
                                        <tr key={idx} className="border-b border-grey hover:bg-midgrey">
                                            <td className="py-2 px-2 text-center">
                                                {numPerPage * currentPage + idx + 1}
                                            </td>
                                            <td className="px-2 py-1 flex justify-center">
                                                <Avatar username={u.username} image={u.image} />
                                            </td>
                                            <td className="text-center px-2">{u.email}</td>
                                            <td className="text-center px-2">{u.username}</td>
                                            <td className="text-center px-2">{u.title}</td>
                                            <td
                                                className={`px-2 text-center uppercase text-sm ${
                                                    u.role === "expert" ? "text-brownyellow" : "text-lightgrey"
                                                }`}
                                            >
                                                {u.role}
                                            </td>
                                            <td className="text-center px-2">{u.country?.name}</td>
                                            <td className="text-center px-2">{u.state?.name}</td>
                                            <td className="text-center px-2">{u.city?.name}</td>
                                            <td className="text-center px-2">{u.phoneNumber}</td>
                                            <td className="text-center px-2">
                                                {u.resume ? (
                                                    <a
                                                        href={`${import.meta.env.VITE_SERVER_URL}/${u.resume}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue underline"
                                                    >
                                                        resume
                                                    </a>
                                                ) : null}
                                            </td>
                                            <td>
                                                <select
                                                    className={`bg-darkgrey-1 border rounded-md border-grey px-2 outline-none ${
                                                        u.status === "active"
                                                            ? "text-green"
                                                            : u.status === "blocked"
                                                                ? "text-red"
                                                                : "text-brownyellow"
                                                    }`}
                                                    value={u.status}
                                                    onChange={(e) =>
                                                        updateProfile({
                                                            email: u.email,
                                                            status: e.target.value
                                                        })
                                                    }
                                                >
                                                    <option value="active" className="text-green">Active</option>
                                                    <option value="review" className="text-brownyellow">Review</option>
                                                    <option value="blocked" className="text-red">Blocked</option>
                                                </select>
                                            </td>
                                            <td className="px-2 max-w-[200px] truncate">
                                                <div className="flex gap-2">
                                                    <button
                                                        className="px-3 py-1 border border-green rounded-md bg-green hover:text-green hover:bg-transparent"
                                                        onClick={() => openManageModal(u)}
                                                    >
                                                        Manage
                                                    </button>
                                                    <button
                                                        className="px-3 py-1 border rounded-md border-lightgrey hover:bg-lightgrey hover:text-black"
                                                        onClick={() => openAuditModal(u)}
                                                    >
                                                        Audit
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {dataType.value === "PendingUser" && (
                            <div className="relative overflow-x-auto w-full px-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-darkgrey">
                                    <tr>
                                        <th className="px-6 py-3 text-center">No</th>
                                        <th className="px-6 py-3 text-center">Email</th>
                                        <th className="px-6 py-3 text-center">Username</th>
                                        <th className="px-6 py-3 text-center">Role</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {pendingUsers.map((p, idx) => (
                                        <tr key={idx} className="border-b border-grey hover:bg-midgrey">
                                            <td className="py-2 px-2 text-center">{idx + 1}</td>
                                            <td className="text-center px-2">{p.email}</td>
                                            <td className="text-center px-2">{p.username}</td>
                                            <td className="text-center px-2">{p.role}</td>
                                            <td className="px-2">
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        className="px-3 py-1 border border-green rounded-md bg-green hover:text-green hover:bg-transparent"
                                                        onClick={() => handleActivatePendingUser(p._id)}
                                                    >
                                                        Activate
                                                    </button>
                                                    <button
                                                        className="px-3 py-1 border border-red-500 text-red-500 rounded-md hover:bg-red-500 hover:text-white"
                                                        onClick={() => handleDeletePendingUser(p._id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {dataType.value === "PendingLogin" && (
                            <div className="relative overflow-x-auto w-full px-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-darkgrey">
                                    <tr>
                                        <th className="px-6 py-3 text-center">No</th>
                                        <th className="px-6 py-3 text-center">Email</th>
                                        <th className="px-6 py-3 text-center">Code</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {pendingLogins.map((p, idx) => (
                                        <tr key={idx} className="border-b border-grey hover:bg-midgrey">
                                            <td className="py-2 px-2 text-center">{idx + 1}</td>
                                            <td className="text-center px-2">{p.email}</td>
                                            <td className="text-center px-2">{p.code}</td>
                                            <td className="px-2">
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        className="px-3 py-1 border border-red-500 text-red-500 rounded-md hover:bg-red-500 hover:text-white"
                                                        onClick={() => handleDeletePendingLogin(p._id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {dataType.value === "User" && (
                            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                                <div className="flex gap-6">
                                    <div>Show rows:</div>
                                    <select
                                        className="bg-darkgrey-1 text-white border rounded-md border-grey px-2 outline-none"
                                        value={numPerPage}
                                        onChange={(e) => set_numPerPage(Number(e.target.value))}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <Pagination
                                    currentPage={currentPage}
                                    totalPage={totalPage}
                                    goFirst={() => set_currentPage(0)}
                                    goPrev={() => set_currentPage(currentPage > 0 ? currentPage - 1 : 0)}
                                    goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                                    goLast={() => set_currentPage(totalPage)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {manageModalShow && (
                <ManageModal
                    selectedUser={selectedUser}
                    updateOneUser={updateOneUser}
                    closeModal={closeManageModal}
                />
            )}
            {auditModalShow && (
                <AuditModal
                    selectedUser={selectedUser}
                    closeModal={closeAuditModal}
                />
            )}
        </div>
    );
};

export default UserMgmt;
