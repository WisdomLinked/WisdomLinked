import React, { useEffect, useState } from "react";
import CloseIcon from '@mui/icons-material/Close';
import { doGetFullUserDataByEmail } from "../../../../api/api";
import ChatHistory from "./chatHistory";
import PaymentHistory from "./paymentHistory";

const AuditModal = ({
    selectedUser,
    closeModal
}: any) => {

    const [userDetails, set_userDetails] = useState<any>()
    const [selectedTab, set_selectedTab] = useState(0)

    const getFullUserData = async (email: any) => {
        const res = await doGetFullUserDataByEmail(email)
        if (res) {
            set_userDetails(res.result)
        }
    }

    useEffect(() => {
        getFullUserData(selectedUser?.email)
    }, [selectedUser])

    return (
        <div className={`absolute top-0 left-0 w-full h-full bg-white bg-opacity-10 backdrop-blur-sm z-10 p-2 sm:p-8`}>
            <div
                className="absolute top-0 left-0 w-full h-full cursor-pointer"
                onClick={closeModal}
            />
            <div className="relative w-full h-full  mx-auto pb-3 py-6 sm:py-6 bg-black rounded-lg text-white">
                <button
                    className="absolute right-2 top-2 rounded-md hover:bg-grey"
                    onClick={closeModal}
                >
                    <CloseIcon />
                </button>
                <div className="text-center text-white text-2xl mb-2 mt-3 sm:mt-0">Audit {userDetails?.role?.toUpperCase()} Account ({userDetails?.username})</div>
                <div className="w-full h-[calc(100%-50px)] sm:h-[calc(100%-40px)] p-3 sm:px-6">
                    <div className="flex space-x-6 border-0 border-b-[1px] border-lightgrey py-3">
                        <div className={`${selectedTab === 0 ? "text-green font-bold" : 'text-lightgrey'} cursor-pointer`} onClick={() => set_selectedTab(0)}>Chat History</div>
                        <div className={`${selectedTab === 1 ? "text-green font-bold" : 'text-lightgrey'} cursor-pointer`} onClick={() => set_selectedTab(1)}>Payment History</div>
                    </div>
                    <div className="w-full h-[calc(100%-50px)]">
                        {
                            selectedTab === 0 ?
                                <ChatHistory userDetails={userDetails} /> :
                                <PaymentHistory userDetails={userDetails} />
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditModal;
