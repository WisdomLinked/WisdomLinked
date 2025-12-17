import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import Close from "@mui/icons-material/Close";
import DashboardIcon from '@mui/icons-material/Dashboard';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { useAppSelector } from "../../../store";
import PaidIcon from '@mui/icons-material/Paid';
import Dashboard from "./dashboard";
import Payment from "./payment";
import UserMgmt from "./usermgmt";
import ChatIcon from '@mui/icons-material/Chat';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

import { IoAccessibility } from "react-icons/io5";
import Messenger from "../Messenger/Messenger";
import FriendsTitle from "../FriendsSideBar/FriendsTitle";
import GeneralChatList from "../FriendsSideBar/GeneralChatList";
import Feedback from "../../../components/getFeedback";
import GetContactedUs from "../../../components/getContactedUs";
import RegisterUserByAdmin from "../../../components/registerUserByAdmin";


interface Props {
    window?: () => Window;
}

export default function AdminDrawer(props: Props) {
    const { app: { location } } = useAppSelector((state) => state);
    const [leftNavActive, set_leftNavActive] = useState(false)

    return (
        <div className="flex w-full h-full bg-darkgrey-1">
            <button
                className="block fixed top-5 left-4 z-[10000] text-white lg:hidden"
                onClick={() => set_leftNavActive(!leftNavActive)}
            >
                {
                    leftNavActive ?
                        <Close /> :
                        <MenuIcon />
                }
            </button>
            <div className={`fixed top-[63px] left-0 w-fit h-[calc(100vh-63px)] lg:top-0 lg:relative lg:h-full shadow-md ${leftNavActive ? 'leftnav_active' : 'leftnav'} flex z-[100]`}>
                <div className="w-[70px] h-full bg-black flex flex-col items-center space-y-5 py-4">
                    <Link to={`${import.meta.env.VITE_AUTH_URL}admindashboard`} className={`flex flex-col items-center ${location === 'admindashboard' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <DashboardIcon fontSize="medium" />
                        <span className="text-[10px]">Dashboard</span>
                    </Link>
                    <Link to={`${import.meta.env.VITE_AUTH_URL}admindashboard/usermgmt`} className={`flex flex-col items-center ${location === 'adminusermgmt' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ManageAccountsIcon fontSize="medium" />
                        <span className="text-[10px]">User Mgmt</span>
                    </Link>
                    <Link to={`${import.meta.env.VITE_AUTH_URL}admindashboard/payment`} className={`flex flex-col items-center ${location === 'adminpayment' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <PaidIcon fontSize="medium" />
                        <span className="text-[10px]">Payment</span>
                    </Link>
                    <Link to={`${import.meta.env.VITE_AUTH_URL}admindashboard/chat`} className={`flex flex-col items-center ${location === 'adminchat' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ChatIcon fontSize="medium" />
                        <span className="text-[10px]">Chat</span>
                    </Link>
                    <Link
                        to={`${import.meta.env.VITE_AUTH_URL}admindashboard/feedbacks`}
                        className={`flex flex-col items-center ${
                            location === "adminfeedbacks"
                                ? "text-lightgrey"
                                : "text-grey hover:text-lightgrey"
                        }`}
                    >
                        <span className="material-icons"><IoAccessibility fontSize="medium" /></span>
                        <span className="text-[10px] mt-1">Feedback</span>
                    </Link>
                    <Link
                        to={`${import.meta.env.VITE_AUTH_URL}admindashboard/contactedus`}
                        className={`flex flex-col items-center ${
                            location === 'admincontactedus'
                                ? 'text-lightgrey'
                                : 'text-grey hover:text-lightgrey'
                        }`}
                    >
                        <span className="material-icons"><EmojiPeopleIcon fontSize="medium"/></span>
                        <span className="text-[10px]">ContactedUs</span>
                    </Link>
                    <Link
                        to={`${import.meta.env.VITE_AUTH_URL}admindashboard/registerUser`}
                        className={`flex flex-col items-center ${
                            location === 'adminregisteruser'
                                ? 'text-lightgrey'
                                : 'text-grey hover:text-lightgrey'
                        }`}
                    >
                        <span className="material-icons"><GroupAddIcon fontSize="medium"/></span>
                        <span className="text-[10px]">Register User</span>
                    </Link>
                </div>
                <div className={`w-[300px] h-full bg-darkgrey overflow-y-auto px-[15px] pt-4 pb-[5px] ${location === 'adminchat' ? '' : 'hidden'}`}>
                    <FriendsTitle title="Shared Community Chats" />
                    <GeneralChatList />
                </div>
            </div>
            <div className={`w-full ${location === 'adminchat' ? 'lg:w-[calc(100%-370px)]' : 'lg:w-[calc(100%-70px)]'} h-full`}>
                <Routes>
                    <Route path="/usermgmt" element={<UserMgmt />} />
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/chat" element={<Messenger />} />
                    <Route path="/feedbacks" element={<Feedback />} />
                    <Route path="/contactedus" element={<GetContactedUs />} />
                    <Route path="/registerUser" element={<RegisterUserByAdmin />} />

                    <Route path="/*" element={<Dashboard />} />
                </Routes>
            </div>
        </div>
    );
}
