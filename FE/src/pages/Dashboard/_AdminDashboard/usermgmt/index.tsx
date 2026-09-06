import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import {
    doFilterUsers,
    doUpdateProfileByAdmin,
    profileImageFetch,
    impersonateUser,
    doGetPendingUsers,
    doGetPendingLogins,
    doDeletePendingUserById,
    doDeletePendingLoginById,
    doActivatePendingUserById,
} from "../../../../api/api";

import Avatar from "../../../../components/Avatar";
import ManageModal from "./manageModal";
import AuditModal from "./auditModal";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { actionTypes } from "../../../../actions/types";
import { setImpersonationSession } from "../../../../components/ImpersonationBanner";

const UserMgmt = () => {
    const [searchParams] = useSearchParams();
    const emailFromUrl = searchParams.get("email") || searchParams.get("q") || "";
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const dataTypeOptions = [
        { value: "ReviewQueue", label: "Needs review" },
        { value: "User", label: "All users" },
        { value: "PendingUser", label: "Pending email verify" },
        { value: "PendingLogin", label: "Pending login" },
    ];

    const roles = [
        { value: "", label: "All" },
        { value: "expert", label: "Expert" },
        { value: "customer", label: "Customer" },
        { value: "admin", label: "Admin" },
    ];

    const statusOptions = [
        { value: "", label: "All statuses" },
        { value: "review", label: "Review" },
        { value: "active", label: "Active" },
        { value: "blocked", label: "Blocked" },
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

    const [sortBy, set_sortBy] = useState<any>(sorts[1]); // DESC by default (newest first)
    const [role, set_role] = useState<any>(roles[0]);
    const [statusFilter, set_statusFilter] = useState<any>(statusOptions[0]);
    const [email, set_email] = useState<string>(emailFromUrl);
    const [username, set_username] = useState<string>("");

    const [pendingUsers, set_pendingUsers] = useState<any[]>([]);
    const [pendingLogins, set_pendingLogins] = useState<any[]>([]);

    const [selectedUser, set_selectedUser] = useState<any>(null);
    const [manageModalShow, set_manageModalShow] = useState<boolean>(false);
    const [auditModalShow, set_auditModalShow] = useState<boolean>(false);
    const [isFirstLoad, set_isFirstLoad] = useState<boolean>(true);

    const isUserListView = dataType.value === "User" || dataType.value === "ReviewQueue";
    const isReviewQueue = dataType.value === "ReviewQueue";

    useEffect(() => {
        if (emailFromUrl) {
            set_email(emailFromUrl);
            // Deep-links from events should land on the searchable user list
            set_dataType(dataTypeOptions[1]);
        }
    }, [emailFromUrl]);

    const filterUsers = async (pageNum: number) => {
        try {
            SetLoadingStatus(true);
            set_currentPage(pageNum);

            const res = await doFilterUsers({
                email,
                username,
                role: role.value,
                status: isReviewQueue ? "review" : statusFilter.value,
                sortBy: "createdAt",
                sortOrder: sortBy?.value === "ASC" ? "ASC" : "DESC",
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
        if (isReviewQueue && updated?.status !== "review") {
            set_users((prev) => prev.filter((u) => u.email !== updated.email));
            set_totalCount((c) => Math.max(0, c - 1));
            return;
        }
        const newArr = [...users];
        const idx = newArr.findIndex(u => u.email === updated.email);
        if (idx >= 0) {
            newArr[idx] = updated;
            set_users(newArr);
        }
    };

    const handleApproveUser = async (u: any) => {
        await updateProfile({ email: u.email, status: "active" });
    };

    const handleBlockUser = async (u: any) => {
        await updateProfile({ email: u.email, status: "blocked" });
    };

    const handleImpersonate = async (u: any) => {
        if (!u?.email || u.role === "admin") return;
        try {
            SetLoadingStatus(true);
            const res = await impersonateUser(u.email);
            if (res?.status === "SUCCESS" && res.userDetails) {
                setImpersonationSession({
                    email: res.userDetails.email,
                    username: res.userDetails.username,
                    role: res.userDetails.role,
                });
                window.dispatchEvent(new Event("wl-impersonation-change"));
                localStorage.setItem("currentUser", JSON.stringify(res.userDetails));
                dispatch({
                    type: actionTypes.authenticate,
                    payload: res.userDetails,
                });
                const role = res.userDetails.role;
                if (role === "expert") {
                    navigate("/user/expertdashboard", { replace: true });
                } else {
                    navigate("/user/studentdashboard", { replace: true });
                }
            } else {
                window.alert(res?.error || "Impersonation failed");
            }
        } catch (err) {
            console.error(err);
            window.alert("Impersonation failed");
        } finally {
            SetLoadingStatus(false);
        }
    };

    const handleDataTypeChange = (selected: any) => {
        set_dataType(selected);
    };

    useEffect(() => {
        if (isUserListView) {
            filterUsers(0);
        } else if (dataType.value === "PendingUser") {
            fetchPendingUsers();
        } else if (dataType.value === "PendingLogin") {
            fetchPendingLogins();
        }
    }, [dataType]);

    useEffect(() => {
        if (!isFirstLoad && isUserListView) {
            filterUsers(0);
        }
    }, [numPerPage]);

    useEffect(() => {
        if (!isFirstLoad && isUserListView) {
            filterUsers(currentPage);
        }
    }, [currentPage]);

    useEffect(() => {
        if (!isFirstLoad && isUserListView) {
            const timer = setTimeout(() => {
                filterUsers(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [sortBy, role, statusFilter, email, username]);


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
                <div className="w-full max-w-[1400px] mx-auto text-wl-ink">
                    <div className="text-center text-2xl font-semibold text-wl-brand">User Management</div>
                    {isReviewQueue ? (
                        <p className="mt-2 text-center text-sm text-wl-muted">
                            Primary approval queue — accounts with status <span className="font-medium text-brownyellow">review</span>.
                        </p>
                    ) : null}

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

                    {isUserListView && (
                        <div className="w-full py-1">
                            <div className="flex justify-between mt-4">
                                <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Filter by email</div>
                                    <input
                                        className="w-full rounded-[15px] h-[50px] bg-wl-card border border-lightgrey text-[14px] leading-[21px] px-[24px] text-wl-ink placeholder:text-grey"
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
                                        className="w-full rounded-[15px] h-[50px] bg-wl-card border border-lightgrey text-[14px] leading-[21px] px-[24px] text-wl-ink placeholder:text-grey"
                                        placeholder="Input username"
                                        value={username}
                                        onChange={(e) => set_username(e.target.value)}
                                    />
                                </div>
                                <div className="w-[150px] sm:w-[300px]">
                                    <div className="text-grey mb-0.5 text-[12px] leading-[19px]">
                                        {isReviewQueue ? "Sort" : "Filter by status"}
                                    </div>
                                    {isReviewQueue ? (
                                        <SelectionWithCheckBox
                                            options={sorts}
                                            selectedOptions={sortBy}
                                            set_selectedOptions={set_sortBy}
                                            placeholder="Sort by"
                                            isMulti={false}
                                        />
                                    ) : (
                                        <SelectionWithCheckBox
                                            options={statusOptions}
                                            selectedOptions={statusFilter}
                                            set_selectedOptions={set_statusFilter}
                                            placeholder="Filter by status"
                                            isMulti={false}
                                        />
                                    )}
                                </div>
                            </div>
                            {!isReviewQueue ? (
                                <div className="flex justify-end mt-2">
                                    <div className="w-[150px] sm:w-[300px]">
                                        <div className="text-grey mb-0.5 text-[12px] leading-[19px]">Sort</div>
                                        <SelectionWithCheckBox
                                            options={sorts}
                                            selectedOptions={sortBy}
                                            set_selectedOptions={set_sortBy}
                                            placeholder="Sort by"
                                            isMulti={false}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div className="w-full rounded-2xl mt-4 bg-wl-card border border-wl-line shadow-sm overflow-hidden">

                        {isUserListView && (
                            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                                <div>
                                    {isReviewQueue
                                        ? `Total of ${totalCount} accounts awaiting review`
                                        : `Total of ${totalCount} Users`}
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

                        {isUserListView && (
                            <div className="relative overflow-x-auto w-full px-4">
                                {users.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-wl-muted">
                                        {isReviewQueue
                                            ? "No accounts currently awaiting review."
                                            : "No users match these filters."}
                                    </p>
                                ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
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
                                        <tr key={idx} className="border-b border-wl-line hover:bg-wl-pageAlt text-wl-ink">
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
                                                    u.role === "expert" ? "text-brownyellow" : "text-wl-brand"
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
                                                        href={`${process.env.REACT_APP_SERVER_URL}/${u.resume}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-wl-brand underline font-medium hover:brightness-95"
                                                    >
                                                        resume
                                                    </a>
                                                ) : null}
                                            </td>
                                            <td>
                                                <select
                                                    className={`bg-wl-card border rounded-lg border-wl-line text-wl-ink px-2 py-1 text-[13px] outline-none focus:ring-2 focus:ring-wl-brand/20 ${
                                                        u.status === "active"
                                                            ? "text-wl-brand font-medium"
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
                                                    <option value="active" className="text-wl-brand">Active</option>
                                                    <option value="review" className="text-brownyellow">Review</option>
                                                    <option value="blocked" className="text-red">Blocked</option>
                                                </select>
                                            </td>
                                            <td className="px-2 max-w-[280px]">
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    {(isReviewQueue || u.status === "review") && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center rounded-lg bg-green px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-green/30"
                                                                onClick={() => handleApproveUser(u)}
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center rounded-lg border border-red-500/80 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
                                                                onClick={() => handleBlockUser(u)}
                                                            >
                                                                Block
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center rounded-lg bg-wl-brand px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/30"
                                                        onClick={() => openManageModal(u)}
                                                    >
                                                        Manage
                                                    </button>
                                                    {u.role !== "admin" ? (
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center rounded-lg border border-amber-500/70 bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                                                            onClick={() => handleImpersonate(u)}
                                                        >
                                                            Impersonate
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center rounded-lg border border-wl-line bg-white px-3 py-1.5 text-[12px] font-semibold text-wl-brand shadow-sm transition hover:bg-wl-brandSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/20"
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
                                )}
                            </div>
                        )}

                        {dataType.value === "PendingUser" && (
                            <div className="relative overflow-x-auto w-full px-4 py-2">
                                {pendingUsers.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-wl-muted">No pending signups</p>
                                ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
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
                                        <tr key={idx} className="border-b border-wl-line hover:bg-wl-pageAlt text-wl-ink">
                                            <td className="py-2 px-2 text-center">{idx + 1}</td>
                                            <td className="text-center px-2">{p.email}</td>
                                            <td className="text-center px-2">{p.username}</td>
                                            <td className="text-center px-2">{p.role}</td>
                                            <td className="px-2">
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center rounded-lg bg-wl-brand px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/30"
                                                        onClick={() => handleActivatePendingUser(p._id)}
                                                    >
                                                        Activate
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center rounded-lg border border-red-500/80 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
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
                                )}
                            </div>
                        )}

                        {dataType.value === "PendingLogin" && (
                            <div className="relative overflow-x-auto w-full px-4 py-2">
                                {pendingLogins.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-wl-muted">No pending logins</p>
                                ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                                    <tr>
                                        <th className="px-6 py-3 text-center">No</th>
                                        <th className="px-6 py-3 text-center">Email</th>
                                        <th className="px-6 py-3 text-center">Code</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {pendingLogins.map((p, idx) => (
                                        <tr key={idx} className="border-b border-wl-line hover:bg-wl-pageAlt text-wl-ink">
                                            <td className="py-2 px-2 text-center">{idx + 1}</td>
                                            <td className="text-center px-2">{p.email}</td>
                                            <td className="text-center px-2">{p.code}</td>
                                            <td className="px-2">
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center rounded-lg border border-red-500/80 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
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
                                )}
                            </div>
                        )}

                        {isUserListView && (
                            <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                                <div className="flex gap-6">
                                    <div>Show rows:</div>
                                    <select
                                        className="bg-wl-card text-wl-ink border rounded-md border-wl-line px-2 outline-none"
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
