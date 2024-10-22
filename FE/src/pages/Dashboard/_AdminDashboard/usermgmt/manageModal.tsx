import React, { useEffect, useState } from "react";
import CloseIcon from '@mui/icons-material/Close';
import { doGetFullUserDataByEmail } from "../../../../api/api";
import ExpertProfile from "../../_ExpertDashboard/profile";
import CustomerProfile from "../../_CustomerDashboard/profile";
import Loading from "../../../../components/Loading";

const ManageModal = ({
    selectedUser,
    updateOneUser,
    closeModal
}:any) => {

    const [userDetails, set_userDetails] = useState<any>()

    const getFullUserData = async (email:any) => {
        const res = await doGetFullUserDataByEmail(email)
        if (res) {
            set_userDetails(res.result)
        }
    }

    useEffect(() => {
        getFullUserData(selectedUser?.email)
    }, [selectedUser])

    return (
        <div className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 p-5 sm:p-8`}>
            <div 
                className="absolute top-0 left-0 w-full h-full cursor-pointer"
                onClick={closeModal}
            />
            <div className="relative w-full h-full max-w-[846px] mx-auto py-6 bg-black rounded-lg text-white">
                <button 
                    className="absolute right-2 top-2 rounded-md hover:bg-grey"
                    onClick={closeModal}
                >
                    <CloseIcon />
                </button>
                <div className="text-center text-white text-2xl mb-2 mt-3 sm:mt-0">Edit User Details ({userDetails?.role})</div>
                <div className="w-full h-[calc(100%-50px)] sm:h-[calc(100%-40px)] overflow-y-auto px-6">
                    {
                        userDetails?.role === 'expert' ?
                            <ExpertProfile 
                                userDetails={userDetails} 
                                isFromAdminPanel={true} 
                                updateOneUser={updateOneUser}
                            /> :
                            userDetails?.role === 'customer' ?
                                <CustomerProfile 
                                    userDetails={userDetails} 
                                    isFromAdminPanel={true} 
                                    updateOneUser={updateOneUser}
                                /> :
                                <Loading loading={true} />
                    }
                </div>
            </div>
        </div>
    );
};

export default ManageModal;
