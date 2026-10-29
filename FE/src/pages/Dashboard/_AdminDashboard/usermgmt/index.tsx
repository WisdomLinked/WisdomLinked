import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import ClearableInput from "../../../../components/ui/ClearableInput";
import SelectField from "../../../../components/ui/SelectField";
import QueueSwitcher, { USER_MGMT_QUEUES } from "./QueueSwitcher";
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

import ManageModal from "./manageModal";
import AuditModal from "./auditModal";
import UserListTable from "./UserListTable";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { actionTypes } from "../../../../actions/types";
import { setImpersonationSession } from "../../../../components/ImpersonationBanner";
import { applyUserImage, userImageKey, usersAwaitingImages } from "../../../../utils/adminUserImages";

const UserMgmt = () => {
    const [searchParams] = useSearchParams();
    const emailFromUrl = searchParams.get("email") || searchParams.get("q") || "";
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const dataTypeOptions = USER_MGMT_QUEUES;

    const roles = [
        { value: "", label: "All" },
        { value: "expert", label: "Expert" },
        { value: "customer", label: "Customer" },
        { value: "admin", label: "Admin" },
    ];

    const statusOptions = [
        { value: "", label: "All statuses" },
        { value: "review", label: "In review" },
        { value: "active", label: "Active" },
        { value: "blocked", label: "Blocked" },
    ];

    const sorts = [
        { value: "DESC", label: "Newest first" },
        { value: "ASC", label: "Oldest first" },
    ];

    const [dataType, set_dataType] = useState<any>(dataTypeOptions[0]);

    const [users, set_users] = useState<any[]>([]);
    const [numPerPage, set_numPerPage] = useState<number>(5);
    const [currentPage, set_currentPage] = useState<number>(0);
    const [totalCount, set_totalCount] = useState<number>(0);
    const [totalPage, set_totalPage] = useState<number>(0);

    const [sortBy, set_sortBy] = useState<any>(sorts[0]); // newest first
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

    // Identifies the newest filter request, so a slower earlier one cannot overwrite it.
    const requestSeq = useRef(0);

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
        const seq = ++requestSeq.current;
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

            if (seq !== requestSeq.current) return;

            if (res && res.result && Array.isArray(res.result)) {
                set_users(usersAwaitingImages(res.result));
                const total = res.totalCount || 0;
                set_totalCount(total);
                const totalPages = total % numPerPage ? Math.floor(total / numPerPage) : total / numPerPage - 1;
                set_totalPage(totalPages < 0 ? 0 : totalPages);
                void hydrateUserImages(res.result, seq);
            } else {
                set_users([]);
                set_totalCount(0);
                set_totalPage(0);
            }
        } catch (err) {
            console.error(err);
            if (seq !== requestSeq.current) return;
            set_users([]);
            set_totalCount(0);
            set_totalPage(0);
        } finally {
            set_isFirstLoad(false);
            if (seq === requestSeq.current) SetLoadingStatus(false);
        }
    };

    const hydrateUserImages = async (usersList: any[], seq: number) => {
        await Promise.all(
            usersList.map(async (u) => {
                if (!u?.image) return;
                const key = userImageKey(u);
                if (!key) return;

                let base64Image: string | null = null;
                try {
                    base64Image = await profileImageFetch(u.image, "small");
                } catch (error) {
                    console.error("Error loading image:", error);
                    return;
                }
                if (!base64Image) return;
                if (seq !== requestSeq.current) return;

                set_users((prev) => applyUserImage(prev, key, base64Image));
            })
        );
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

    const handleDataTypeChange = (selected: (typeof USER_MGMT_QUEUES)[number]) => {
        set_dataType(selected);
    };

    const pickOption = <T extends { value: string }>(options: T[], value: string, fallback: T) =>
        options.find((option) => option.value === value) ?? fallback;

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
                    <p className="mt-2 text-center text-sm text-wl-muted">
                        {isReviewQueue ? (
                            <>
                                Primary approval queue — accounts with status{" "}
                                <span className="font-medium text-brownyellow">review</span>.
                            </>
                        ) : isUserListView ? (
                            "Search and filter every account."
                        ) : dataType.value === "PendingUser" ? (
                            "Signups that have not verified their email yet."
                        ) : (
                            "Login codes that have not been used yet."
                        )}
                    </p>

                    <div className="mt-6">
                        <div className="mb-2 text-[12px] leading-[19px] text-grey">Queue</div>
                        <QueueSwitcher value={dataType.value} onChange={handleDataTypeChange} />
                    </div>

                    {isUserListView && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <label htmlFor="usermgmt-email" className="mb-1 block text-[12px] text-wl-muted">
                                    Filter by email
                                </label>
                                <ClearableInput
                                    id="usermgmt-email"
                                    className="bg-wl-card"
                                    placeholder="Input email"
                                    value={email}
                                    onChange={(e) => set_email(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="usermgmt-username" className="mb-1 block text-[12px] text-wl-muted">
                                    Filter by username
                                </label>
                                <ClearableInput
                                    id="usermgmt-username"
                                    className="bg-wl-card"
                                    placeholder="Input username"
                                    value={username}
                                    onChange={(e) => set_username(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="usermgmt-role" className="mb-1 block text-[12px] text-wl-muted">
                                    Filter by role
                                </label>
                                <SelectField
                                    id="usermgmt-role"
                                    size="filter"
                                    value={role.value}
                                    onChange={(value) => set_role(pickOption(roles, value, roles[0]))}
                                    options={roles}
                                    placeholder="Filter by role"
                                />
                            </div>
                            {isReviewQueue ? (
                                <div>
                                    <label htmlFor="usermgmt-sort" className="mb-1 block text-[12px] text-wl-muted">
                                        Sort
                                    </label>
                                    <SelectField
                                        id="usermgmt-sort"
                                        size="filter"
                                        value={sortBy.value}
                                        onChange={(value) => set_sortBy(pickOption(sorts, value, sorts[0]))}
                                        options={sorts}
                                        placeholder="Sort by"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label htmlFor="usermgmt-status" className="mb-1 block text-[12px] text-wl-muted">
                                        Filter by status
                                    </label>
                                    <SelectField
                                        id="usermgmt-status"
                                        size="filter"
                                        value={statusFilter.value}
                                        onChange={(value) => set_statusFilter(pickOption(statusOptions, value, statusOptions[0]))}
                                        options={statusOptions}
                                        placeholder="Filter by status"
                                    />
                                </div>
                            )}
                            {!isReviewQueue ? (
                                <div>
                                    <label htmlFor="usermgmt-sort" className="mb-1 block text-[12px] text-wl-muted">
                                        Sort
                                    </label>
                                    <SelectField
                                        id="usermgmt-sort"
                                        size="filter"
                                        value={sortBy.value}
                                        onChange={(value) => set_sortBy(pickOption(sorts, value, sorts[0]))}
                                        options={sorts}
                                        placeholder="Sort by"
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div className="w-full rounded-2xl mt-4 bg-wl-card border border-wl-line shadow-sm overflow-hidden">

                        {isUserListView && (
                            <div className="w-full p-4">
                                {isReviewQueue
                                    ? `Total of ${totalCount} accounts awaiting review`
                                    : `Total of ${totalCount} Users`}
                            </div>
                        )}

                        {isUserListView && (
                            <UserListTable
                                users={users}
                                emptyMessage={
                                    isReviewQueue
                                        ? "No accounts currently awaiting review."
                                        : "No users match these filters."
                                }
                                onStatusChange={(u, status) =>
                                    updateProfile({ email: u.email, status })
                                }
                                onManage={openManageModal}
                                onImpersonate={handleImpersonate}
                                onAudit={openAuditModal}
                            />
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
                            <Pagination
                                currentPage={currentPage}
                                totalCount={totalCount}
                                pageSize={numPerPage}
                                onPage={set_currentPage}
                                onPageSize={set_numPerPage}
                            />
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
