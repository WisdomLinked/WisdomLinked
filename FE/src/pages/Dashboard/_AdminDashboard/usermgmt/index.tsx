// import React, { useEffect, useState } from "react";
// import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
// import {
//     doFilterUsers,
//     doUpdateProfileByAdmin,
//     profileImageFetch,
//     doGetPendingUsers,
//     doGetPendingLogins,
//     doDeletePendingUserById,
//     doDeletePendingLoginById,
//     doDeleteUserById
// } from "../../../../api/api";
// import Avatar from "../../../../components/Avatar";
// import ManageModal from "./manageModal";
// import AuditModal from "./auditModal";
// import Pagination from "../../../../components/Pagination";
// import { SetLoadingStatus } from "../../../../actions/appActions";
//
// const dataTypes = [
//     { value: 'User', label: 'User' },
//     { value: 'PendingUser', label: 'Pending User' },
//     { value: 'PendingLogin', label: 'Pending Login' },
// ];
//
// const roles = [
//     { value: "", label: "All" },
//     { value: "expert", label: "Expert" },
//     { value: "customer", label: "Customer" }
// ];
//
// const sorts = [
//     { value: "ASC", label: "ASC" },
//     { value: "DESC", label: "DESC" }
// ];
//
// const UserMgmt = () => {
//     const [dataType, set_dataType] = useState<any>(dataTypes[0]);
//
//     const [numPerPage, set_numPerPage] = useState<any>(5);
//     const [currentPage, set_currentPage] = useState(0);
//     const [totalCount, set_totalCount] = useState(-1);
//     const [totalPage, set_totalPage] = useState(-1);
//     const [sortBy, set_sortBy] = useState(sorts[0]);
//     const [role, set_role] = useState(roles[0]);
//     const [email, set_email] = useState('');
//     const [username, set_username] = useState('');
//     const [users, set_users] = useState<Array<any>>([]);
//     const [selectedUser, set_selectedUser] = useState<any>();
//     const [manageModalShow, set_manageModalShow] = useState(false);
//     const [auditModalShow, set_auditModalShow] = useState(false);
//     const [isFirstLoad, set_isFirstLoad] = useState(true);
//
//     const [pendingUsers, set_pendingUsers] = useState<Array<any>>([]);
//     const [pendingLogins, set_pendingLogins] = useState<Array<any>>([]);
//
//     const updateUsersWithImages = async (usersList: any[]) => {
//         try {
//             const updated = await Promise.all(
//                 usersList.map(async (user) => {
//                     let base64Image = "";
//                     if (user.image) {
//                         try {
//                             base64Image = await profileImageFetch(user.image, "small");
//                         } catch (error) {
//                             console.error(`Error fetching image for user ${user.email}:`, error);
//                         }
//                     }
//                     return { ...user, image: base64Image };
//                 })
//             );
//             return updated;
//         } catch (error) {
//             console.error("Error updating users with images:", error);
//             return usersList;
//         }
//     };
//
//     const filterUsers = async (pageNum: number) => {
//         set_currentPage(pageNum);
//         SetLoadingStatus(true);
//         const response = await doFilterUsers({
//             email,
//             username,
//             role: role.value,
//             sortBy: 'createdAt',
//             sortOrder: 'DESC',
//             currentPage: pageNum,
//             numPerPage: numPerPage
//         });
//         if (response) {
//             const updatedUsers = await updateUsersWithImages(response.result);
//             set_users([...updatedUsers]);
//             set_totalCount(response.totalCount);
//             set_totalPage(
//                 response.totalCount % numPerPage
//                     ? Math.floor(response.totalCount / numPerPage)
//                     : response.totalCount / numPerPage - 1
//             );
//         }
//         SetLoadingStatus(false);
//         set_isFirstLoad(false);
//     };
//
//     const updateOneUser = (user: any) => {
//         const temp = [...users];
//         const index = users.findIndex(item => item.email === user.email);
//         if (index > -1) {
//             temp[index] = { ...user };
//         }
//         set_users([...temp]);
//     };
//
//     const updateProfile = async (updates: any) => {
//         SetLoadingStatus(true);
//         const res = await doUpdateProfileByAdmin(updates);
//         if (res) {
//             updateOneUser(res.result);
//         }
//         SetLoadingStatus(false);
//     };
//
//     const openManageModal = (user: any) => {
//         set_manageModalShow(true);
//         set_selectedUser(user);
//     };
//
//     const closeManageModal = () => {
//         set_manageModalShow(false);
//         set_selectedUser(null);
//     };
//
//     const openAuditModal = (user: any) => {
//         set_auditModalShow(true);
//         set_selectedUser(user);
//     };
//
//     const closeAuditModal = () => {
//         set_auditModalShow(false);
//         set_selectedUser(null);
//     };
//
//     const handleDeleteUser = async (userId: string) => {
//         try {
//             SetLoadingStatus(true);
//             await doDeleteUserById(userId);
//             filterUsers(0);
//         } catch (error) {
//             console.error(error);
//         } finally {
//             SetLoadingStatus(false);
//         }
//     };
//
//     useEffect(() => {
//         if (!isFirstLoad) {
//             filterUsers(0);
//         }
//     }, [numPerPage]);
//
//     useEffect(() => {
//         if (!isFirstLoad) {
//             filterUsers(currentPage);
//         }
//     }, [currentPage]);
//
//     useEffect(() => {
//         const timer = setTimeout(() => {
//             filterUsers(0);
//         }, 500);
//         return () => clearTimeout(timer);
//     }, [sortBy, role, email, username]);
//
//     const fetchPendingUsers = async () => {
//         try {
//             SetLoadingStatus(true);
//             const data = await doGetPendingUsers();
//             set_pendingUsers(data || []);
//         } catch (err) {
//             console.error(err);
//         } finally {
//             SetLoadingStatus(false);
//         }
//     };
//
//     const fetchPendingLogins = async () => {
//         try {
//             SetLoadingStatus(true);
//             const data = await doGetPendingLogins();
//             set_pendingLogins(data || []);
//         } catch (err) {
//             console.error(err);
//         } finally {
//             SetLoadingStatus(false);
//         }
//     };
//
//     const handleDeletePendingUser = async (pendingUserId: string) => {
//         try {
//             SetLoadingStatus(true);
//             await doDeletePendingUserById(pendingUserId);
//             fetchPendingUsers();
//         } catch (error) {
//             console.error(error);
//         } finally {
//             SetLoadingStatus(false);
//         }
//     };
//
//     const handleDeletePendingLogin = async (pendingLoginId: string) => {
//         try {
//             SetLoadingStatus(true);
//             await doDeletePendingLoginById(pendingLoginId);
//             fetchPendingLogins();
//         } catch (error) {
//             console.error(error);
//         } finally {
//             SetLoadingStatus(false);
//         }
//     };
//
//     useEffect(() => {
//         if (dataType.value === 'User') {
//             filterUsers(0);
//         } else if (dataType.value === 'PendingUser') {
//             fetchPendingUsers();
//         } else if (dataType.value === 'PendingLogin') {
//             fetchPendingLogins();
//         }
//     }, [dataType]);
//
//     return (
//         <div className="relative w-full h-full">
//             <div
//                 className={`w-full h-full py-10 px-5 ${
//                     manageModalShow || auditModalShow ? 'overflow-hidden' : 'overflow-y-auto'
//                 }`}
//             >
//                 <div className="w-full max-w-[1400px] mx-auto text-white">
//
//                     {/* Page Title */}
//                     <div className="text-center text-2xl">User Management</div>
//
//                     {/* Data Type Single-select: "User" | "PendingUser" | "PendingLogin" */}
//                     <div className="w-full py-1 mt-4">
//                         <div className="flex justify-between mt-2">
//                             <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
//                                 <div className="text-grey mb-0.5 text-[12px] leading-[19px]">
//                                     Select Data Type
//                                 </div>
//                                 <SelectionWithCheckBox
//                                     options={dataTypes}
//                                     selectedOptions={dataType}
//                                     set_selectedOptions={set_dataType}
//                                     placeholder="Choose Data Type"
//                                     isMulti={false}
//                                     closeMenuOnSelect={true}
//                                 />
//                             </div>
//                         </div>
//                     </div>
//
//                     {dataType.value === 'User' && (
//                         <>
//                             <div className="w-full py-1">
//                                 <div className="flex justify-between mt-4">
//                                     <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
//                                         <div className="text-grey mb-0.5 text-[12px] leading-[19px]">
//                                             Filter by email
//                                         </div>
//                                         <input
//                                             className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
//                                             placeholder="Input email"
//                                             value={email}
//                                             onChange={(e) => set_email(e.target.value)}
//                                         />
//                                     </div>
//                                     <div className="w-[150px] sm:w-[300px]">
//                                         <div className="text-grey mb-0.5 text-[12px] leading-[19px]">
//                                             Filter by role
//                                         </div>
//                                         <SelectionWithCheckBox
//                                             options={roles}
//                                             selectedOptions={role}
//                                             set_selectedOptions={set_role}
//                                             placeholder="Filter by role"
//                                             isMulti={false}
//                                             closeMenuOnSelect={true}
//                                         />
//                                     </div>
//                                 </div>
//                                 <div className="flex justify-between mt-2">
//                                     <div className="w-[calc(100%-174px)] sm:w-[calc(100%-324px)]">
//                                         <div className="text-grey mb-0.5 text-[12px] leading-[19px]">
//                                             Filter by username
//                                         </div>
//                                         <input
//                                             className="w-full rounded-[15px] h-[50px] bg-transparent border border-lightgrey text-[14px] leading-[21px] px-[24px]"
//                                             placeholder="Input username"
//                                             value={username}
//                                             onChange={(e) => set_username(e.target.value)}
//                                         />
//                                     </div>
//                                     <div className="w-[150px] sm:w-[300px]">
//                                         <div className="text-grey mb-0.5 text-[12px] leading-[19px]">
//                                             Sort by username
//                                         </div>
//                                         <SelectionWithCheckBox
//                                             options={sorts}
//                                             selectedOptions={sortBy}
//                                             set_selectedOptions={set_sortBy}
//                                             placeholder="Sort by"
//                                             isMulti={false}
//                                             closeMenuOnSelect={true}
//                                         />
//                                     </div>
//                                 </div>
//                             </div>
//
//                             <div className="w-full rounded-[16px] mt-4 bg-midgrey shadow-md">
//                                 <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
//                                     <div>
//                                         <div className="">Total of {totalCount} Users</div>
//                                     </div>
//                                     <Pagination
//                                         currentPage={currentPage}
//                                         totalPage={totalPage}
//                                         goFirst={() => set_currentPage(0)}
//                                         goPrev={() => set_currentPage((currentPage - 1) || 0)}
//                                         goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
//                                         goLast={() => set_currentPage(totalPage)}
//                                     />
//                                 </div>
//
//                                 <div className="relative overflow-x-auto w-full px-4">
//                                     <table className="w-full text-sm text-left">
//                                         <thead className="text-xs uppercase bg-darkgrey">
//                                         <tr>
//                                             <th scope="col" className="px-2 py-3 text-center">No</th>
//                                             <th scope="col" className="px-2 py-3 text-center">Avatar</th>
//                                             <th scope="col" className="px-2 py-3 text-center">Email</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Name</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Role</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Country</th>
//                                             <th scope="col" className="px-6 py-3 text-center">State</th>
//                                             <th scope="col" className="px-6 py-3 text-center">City</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Phone</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Status</th>
//                                             <th scope="col" className="px-6 py-3 text-center w-[250px]">Actions</th>
//                                         </tr>
//                                         </thead>
//                                         <tbody>
//                                         {users.map((user, index) => (
//                                             <tr
//                                                 key={user._id || index}
//                                                 className="border-b border-grey hover:bg-midgrey"
//                                             >
//                                                 <td className='py-2 px-2 text-center'>
//                                                     {numPerPage * currentPage + index + 1}
//                                                 </td>
//                                                 <td className='px-2 py-1 flex justify-center'>
//                                                     <Avatar username={user.username} image={user.image} />
//                                                 </td>
//                                                 <td className='text-center px-2'>{user.email}</td>
//                                                 <td className='text-center px-2'>{user.username}</td>
//                                                 <td
//                                                     className={`px-2 text-center uppercase text-sm ${
//                                                         user.role === 'expert'
//                                                             ? 'text-brownyellow'
//                                                             : 'text-lightgrey'
//                                                     }`}
//                                                 >
//                                                     {user.role}
//                                                 </td>
//                                                 <td className='text-center px-2'>{user.country?.name}</td>
//                                                 <td className='text-center px-2'>{user.state?.name}</td>
//                                                 <td className='text-center px-2'>{user.city?.name}</td>
//                                                 <td className='text-center px-2'>{user.phoneNumber}</td>
//
//                                                 <td className="text-center px-2">
//                                                     <select
//                                                         className={`bg-darkgrey-1 border rounded-md border-grey px-2 outline-none ${
//                                                             user.status === 'active'
//                                                                 ? 'text-green'
//                                                                 : user.status === 'blocked'
//                                                                     ? 'text-red'
//                                                                     : 'text-brownyellow'
//                                                         }`}
//                                                         value={user.status}
//                                                         onChange={(e) =>
//                                                             updateProfile({
//                                                                 email: user.email,
//                                                                 status: e.target.value
//                                                             })
//                                                         }
//                                                     >
//                                                         <option value='active' className="text-green">
//                                                             Active
//                                                         </option>
//                                                         <option value='review' className="text-brownyellow">
//                                                             Review
//                                                         </option>
//                                                         <option value='blocked' className="text-red">
//                                                             Blocked
//                                                         </option>
//                                                     </select>
//                                                 </td>
//                                                 <td className='px-2 max-w-[250px] truncate'>
//                                                     <div className="flex flex-wrap gap-2">
//                                                         <button
//                                                             className="px-3 py-1 border border-green rounded-md bg-green hover:text-green hover:bg-transparent"
//                                                             onClick={() => openManageModal(user)}
//                                                         >
//                                                             Manage
//                                                         </button>
//                                                         <button
//                                                             className="px-3 py-1 border rounded-md border-lightgrey hover:bg-lightgrey hover:text-black"
//                                                             onClick={() => openAuditModal(user)}
//                                                         >
//                                                             Audit
//                                                         </button>
//                                                         <button
//                                                             className="px-3 py-1 border border-red-500 text-red-500 rounded-md hover:bg-red-500 hover:text-white"
//                                                             onClick={() => handleDeleteUser(user._id)}
//                                                         >
//                                                             Delete
//                                                         </button>
//                                                     </div>
//                                                 </td>
//                                             </tr>
//                                         ))}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                                 <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
//                                     <div className='flex gap-6'>
//                                         <div>Show rows:</div>
//                                         <select
//                                             className='bg-darkgrey-1 text-white border rounded-md border-grey px-2 outline-none'
//                                             value={numPerPage}
//                                             onChange={(e) => set_numPerPage(e.target.value)}
//                                         >
//                                             <option value={5}>5</option>
//                                             <option value={10}>10</option>
//                                             <option value={25}>25</option>
//                                             <option value={50}>50</option>
//                                         </select>
//                                     </div>
//                                     <Pagination
//                                         currentPage={currentPage}
//                                         totalPage={totalPage}
//                                         goFirst={() => set_currentPage(0)}
//                                         goPrev={() => set_currentPage((currentPage - 1) || 0)}
//                                         goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
//                                         goLast={() => set_currentPage(totalPage)}
//                                     />
//                                 </div>
//                             </div>
//                         </>
//                     )}
//
//                     {dataType.value === 'PendingUser' && (
//                         <div className="w-full rounded-[16px] mt-4 bg-midgrey shadow-md">
//                             <div className="p-4">
//                                 <div className="text-xl mb-4">Pending Users</div>
//                                 <div className="relative overflow-x-auto w-full">
//                                     <table className="w-full text-sm text-left">
//                                         <thead className="text-xs uppercase bg-darkgrey">
//                                         <tr>
//                                             <th scope="col" className="px-6 py-3 text-center">No</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Email</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Username</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Status</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Actions</th>
//                                         </tr>
//                                         </thead>
//                                         <tbody>
//                                         {pendingUsers.map((pUser, idx) => (
//                                             <tr key={pUser._id} className="border-b border-grey hover:bg-midgrey">
//                                                 <td className='py-2 px-2 text-center'>{idx + 1}</td>
//                                                 <td className='py-2 px-2 text-center'>{pUser.email}</td>
//                                                 <td className='py-2 px-2 text-center'>{pUser.username}</td>
//                                                 <td className='py-2 px-2 text-center'>{pUser.status}</td>
//                                                 <td className='py-2 px-2 text-center'>
//                                                     <button
//                                                         className="px-3 py-1 border border-red-500 text-red-500 rounded-md hover:bg-red-500 hover:text-white"
//                                                         onClick={() => handleDeletePendingUser(pUser._id)}
//                                                     >
//                                                         Delete
//                                                     </button>
//                                                 </td>
//                                             </tr>
//                                         ))}
//                                         {pendingUsers.length === 0 && (
//                                             <tr>
//                                                 <td colSpan={5} className="p-2 text-center text-grey">
//                                                     No pending users found
//                                                 </td>
//                                             </tr>
//                                         )}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                         </div>
//                     )}
//
//                     {dataType.value === 'PendingLogin' && (
//                         <div className="w-full rounded-[16px] mt-4 bg-midgrey shadow-md">
//                             <div className="p-4">
//                                 <div className="text-xl mb-4">Pending Logins</div>
//                                 <div className="relative overflow-x-auto w-full">
//                                     <table className="w-full text-sm text-left">
//                                         <thead className="text-xs uppercase bg-darkgrey">
//                                         <tr>
//                                             <th scope="col" className="px-6 py-3 text-center">No</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Email</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Code</th>
//                                             <th scope="col" className="px-6 py-3 text-center">Actions</th>
//                                         </tr>
//                                         </thead>
//                                         <tbody>
//                                         {pendingLogins.map((pLogin, idx) => (
//                                             <tr key={pLogin._id} className="border-b border-grey hover:bg-midgrey">
//                                                 <td className='py-2 px-2 text-center'>{idx + 1}</td>
//                                                 <td className='py-2 px-2 text-center'>{pLogin.email}</td>
//                                                 <td className='py-2 px-2 text-center'>{pLogin.code}</td>
//                                                 <td className='py-2 px-2 text-center'>
//                                                     <button
//                                                         className="px-3 py-1 border border-red-500 text-red-500 rounded-md hover:bg-red-500 hover:text-white"
//                                                         onClick={() => handleDeletePendingLogin(pLogin._id)}
//                                                     >
//                                                         Delete
//                                                     </button>
//                                                 </td>
//                                             </tr>
//                                         ))}
//                                         {pendingLogins.length === 0 && (
//                                             <tr>
//                                                 <td colSpan={4} className="p-2 text-center text-grey">
//                                                     No pending logins found
//                                                 </td>
//                                             </tr>
//                                         )}
//                                         </tbody>
//                                     </table>
//                                 </div>
//                             </div>
//                         </div>
//                     )}
//                 </div>
//             </div>
//
//             {manageModalShow && (
//                 <ManageModal
//                     selectedUser={selectedUser}
//                     updateOneUser={updateOneUser}
//                     closeModal={closeManageModal}
//                 />
//             )}
//             {auditModalShow && (
//                 <AuditModal
//                     selectedUser={selectedUser}
//                     closeModal={closeAuditModal}
//                 />
//             )}
//         </div>
//     );
// };
//
// export default UserMgmt;

import React, { useEffect, useState } from "react";
import SelectionWithCheckBox from "../../../../components/SelectionWithCheckBox";
import {doFilterUsers, doUpdateProfileByAdmin, profileImageFetch} from "../../../../api/api";
import Avatar from "../../../../components/Avatar";
import LoadingPlaceHolder from "../../../../components/LoadingPlaceholder";
import ManageModal from "./manageModal";
import AuditModal from "./auditModal";
import Pagination from "../../../../components/Pagination";
import { SetLoadingStatus } from "../../../../actions/appActions";

const UserMgmt = () => {
    const roles = [
        {
            value: "",
            label: "All"
        },
        {
            value: "expert",
            label: "Expert"
        },
        {
            value: "customer",
            label: "Customer"
        }
    ]
    const sorts = [
        {
            value: "ASC",
            label: "ASC"
        },
        {
            value: "DESC",
            label: "DESC"
        }
    ]
    const [numPerPage, set_numPerPage] = useState<any>(5)
    const [currentPage, set_currentPage] = useState(0)
    const [totalCount, set_totalCount] = useState(-1)
    const [totalPage, set_totalPage] = useState(-1)
    const [sortBy, set_sortBy] = useState(sorts[0])
    const [role, set_role] = useState(roles[0])
    const [email, set_email] = useState('')
    const [username, set_username] = useState('')
    const [users, set_users] = useState<Array<any>>([])
    const [selectedUser, set_selectedUser] = useState<any>()
    const [manageModalShow, set_manageModalShow] = useState(false)
    const [auditModalShow, set_auditModalShow] = useState(false)
    const [isFirstLoad, set_isFirstLoad] = useState(true)

    const updateUsersWithImages = async (usersList: any[]) => {
        try {
            const updated = await Promise.all(
                usersList.map(async (user) => {
                    let base64Image = "";
                    if (user.image) {
                        try {
                            base64Image = await profileImageFetch(user.image, "small");
                        } catch (error) {
                            console.error(`Error fetching image for user ${user.email}:`, error);
                        }
                    }
                    return {
                        ...user,
                        image: base64Image
                    };
                })
            );
            return updated;
        } catch (error) {
            console.error("Error updating users with images:", error);
            return usersList;
        }
    };

    const filterUsers = async (pageNum: number) => {
        set_currentPage(pageNum)
        SetLoadingStatus(true)
        const response = await doFilterUsers({
            email,
            username,
            role: role.value,
            // sortBy: sortBy.value,
            sortBy: 'createdAt',
            sortOrder: 'DESC',
            currentPage: pageNum,
            numPerPage: numPerPage
        });
        console.log(response.result);
        if (response) {
            const updatedUsers = await updateUsersWithImages(response.result);
            set_users([...updatedUsers])
            set_totalCount(response.totalCount)
            set_totalPage(
                response.totalCount % numPerPage
                    ? Math.floor(response.totalCount / numPerPage)
                    : response.totalCount / numPerPage - 1
            )
        }
        SetLoadingStatus(false)
        set_isFirstLoad(false)
    }

    const updateOneUser = (user: any) => {
        const temp = [...users]
        const index = users.findIndex(item => item.email === user.email)
        if (index > -1) {
            temp[index] = {
                ...user
            }
        }
        set_users([...temp])
    }

    const updateProfile = async (updates: any) => {
        SetLoadingStatus(true)
        const res = await doUpdateProfileByAdmin(updates)
        if (res) {
            updateOneUser(res.result)
        }
        SetLoadingStatus(false)
    }

    const openManageModal = (user: any) => {
        set_manageModalShow(true)
        set_selectedUser(user)
    }

    const closeManageModal = () => {
        set_manageModalShow(false)
        set_selectedUser(null)
    }

    const openAuditModal = (user: any) => {
        set_auditModalShow(true)
        set_selectedUser(user)
    }

    const closeAuditModal = () => {
        set_auditModalShow(false)
        set_selectedUser(null)
    }

    useEffect(() => {
        if (!isFirstLoad) {
            filterUsers(0)
        }
    }, [numPerPage])

    useEffect(() => {
        if (!isFirstLoad) {
            filterUsers(currentPage)
        }
    }, [currentPage])

    useEffect(() => {
        let timer = setTimeout(() => {
            filterUsers(0)
        }, 500)
        return (() => clearTimeout(timer))
    }, [sortBy, role, email, username])

    return (
        <div className="relative w-full h-full">
            <div className={`w-full h-full py-10 px-5 ${manageModalShow || auditModalShow ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                <div className="w-full max-w-[1400px] mx-auto text-white">
                    <div className="text-center text-2xl">User Management</div>
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
                    <div className="w-full rounded-[16px] mt-4 bg-midgrey shadow-md">
                        <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                            <div>
                                <div className="">Total of {totalCount} Users</div>
                            </div>
                            <Pagination
                                currentPage={currentPage}
                                totalPage={totalPage}
                                goFirst={() => set_currentPage(0)}
                                goPrev={() => set_currentPage((currentPage - 1) || 0)}
                                goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                                goLast={() => set_currentPage(totalPage)}
                            />
                        </div>
                        <div className="relative overflow-x-auto w-full px-4">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-darkgrey">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            No
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Avatar
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            email
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Title
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Role
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Country
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            State
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            City
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Phone
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Resume
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Status
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        users.map((user, index) => {
                                            return (
                                                <tr key={index} className="border-b border-grey hover:bg-midgrey">
                                                    <td className='py-2 px-2 text-center'>{numPerPage * currentPage + index + 1}</td>
                                                    <td className='px-2 py-1 flex justify-center'>
                                                        <Avatar username={user.username} image={user.image} />
                                                    </td>
                                                    <td className='text-center px-2'>{user.email}</td>
                                                    <td className='text-center px-2'>{user.username}</td>
                                                    <td className='text-center px-2'>{user.title}</td>
                                                    <td className={`px-2 text-center uppercase text-sm ${user.role === 'expert' ? 'text-brownyellow' : 'text-lightgrey'}`}>{user.role}</td>
                                                    <td className='text-center px-2'>{user.country?.name}</td>
                                                    <td className='text-center px-2'>{user.state?.name}</td>
                                                    <td className='text-center px-2'>{user.city?.name}</td>
                                                    <td className='text-center px-2'>{user.phoneNumber}</td>
                                                    <td className='text-center px-2'>
                                                        {
                                                            user.resume ?
                                                                <a href={`${process.env.REACT_APP_SERVER_URL}/${user.resume}`} target="_blank" className="text-blue underline">resume</a> :
                                                                null
                                                        }
                                                    </td>
                                                    <td>
                                                        <select
                                                            className={`bg-darkgrey-1 border rounded-md border-grey px-2 outline-none ${user.status === 'active' ? 'text-green' : user.status === 'blocked' ? 'text-red' : 'text-brownyellow'}`}
                                                            value={user.status}
                                                            onChange={(e) => updateProfile({
                                                                email: user.email,
                                                                status: e.target.value
                                                            })}
                                                        >
                                                            <option value={'active'} className="text-green">Active</option>
                                                            <option value={'review'} className="text-brownyellow">Review</option>
                                                            <option value={'blocked'} className="text-red">Blocked</option>
                                                        </select>
                                                    </td>
                                                    <td className='px-2 max-w-[200px] truncate'>
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="px-3 py-1 border border-green rounded-md bg-green hover:text-green hover:bg-transparent"
                                                                onClick={() => openManageModal(user)}
                                                            >
                                                                Manage
                                                            </button>
                                                            <button
                                                                className="px-3 py-1 border rounded-md border-lightgrey hover:bg-lightgrey hover:text-black"
                                                                onClick={() => openAuditModal(user)}
                                                            >
                                                                Audit
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                        <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 gap-4">
                            <div className='flex gap-6'>
                                <div className="">Show rows:</div>
                                <select
                                    className='bg-darkgrey-1 text-white border rounded-md border-grey px-2 outline-none'
                                    value={numPerPage}
                                    onChange={(e) => set_numPerPage(e.target.value)}
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
                                goPrev={() => set_currentPage((currentPage - 1) || 0)}
                                goNext={() => set_currentPage(currentPage < totalPage ? currentPage + 1 : totalPage)}
                                goLast={() => set_currentPage(totalPage)}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {
                manageModalShow ?
                    <ManageModal
                        selectedUser={selectedUser}
                        updateOneUser={updateOneUser}
                        closeModal={closeManageModal}
                    /> :
                    null
            }
            {
                auditModalShow ?
                    <AuditModal
                        selectedUser={selectedUser}
                        closeModal={closeAuditModal}
                    /> :
                    null
            }
        </div>
    );
};

export default UserMgmt;
