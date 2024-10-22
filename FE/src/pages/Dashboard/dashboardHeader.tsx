import React, { useState } from "react";
import logo from '../../assets/images/logo.png'
import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar";
import OverlayPortal from "../../components/OverayPortal";
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useDispatch } from "react-redux";
import { logoutUser } from "../../actions/authActions";

const DashboardHeader = ({ userDetails }: any) => {

    const dispatch = useDispatch()
    const [modalShow, set_modalShow] = useState(false)

    const logOut = () => {
        dispatch(logoutUser());
    }

    return (
        <div className="w-full h-[63px] bg-black flex justify-between items-center px-5 drop-shadow-sm text-white">
            <Link to='/' className={`w-fit flex items-center space-x-[2px] font-black text-3xl ml-10 lg:ml-0`}>
                <img src={logo} className="w-9 h-9" />
                <span>OE</span>
            </Link>
            <div className="flex items-center space-x-4">
                {
                    userDetails.role === "admin" ?
                        <AdminPanelSettingsIcon className="text-lightgrey" /> :
                        <div className={`text-md text-center ${userDetails.role === 'expert' ? 'text-green' : 'text-lightgrey'}`}>{userDetails.role}</div>
                }
                <button title="Open Setting modal" onClick={() => set_modalShow(true)}>
                    <Avatar username={userDetails.username} isOnline={true} image={userDetails.image} />
                </button>
            </div>
            {
                modalShow ?
                    <OverlayPortal closeModal={() => set_modalShow(false)}>
                        <div className="absolute top-[70px] right-5 w-max bg-black rounded-lg shadow-md p-6 text-white">
                            <div className="text-md text-center">{userDetails.email}</div>
                            <div className={`text-md text-center ${userDetails.role === 'admin' ? 'text-brownyellow' : userDetails.role === 'expert' ? 'text-green' : 'text-lightgrey'}`}>{userDetails.role}</div>
                            <hr className="mt-5" />
                            {
                                userDetails.role !== "admin" ?
                                    <Link
                                        to={`${process.env.REACT_APP_AUTH_URL}${userDetails?.role}dashboard/profile`}
                                        className="mt-5 w-full flex space-x-4 justify-between hover:opacity-50"
                                    >
                                        <span>Manage Account</span>
                                        <ManageAccountsIcon />
                                    </Link> :
                                    null
                            }
                            <button
                                className="mt-5 w-full flex space-x-4 justify-between hover:opacity-50"
                                onClick={logOut}
                            >
                                <span>Log Out</span>
                                <LogoutIcon />
                            </button>
                        </div>
                    </OverlayPortal> :
                    null
            }
        </div>
    );
};

export default DashboardHeader;
