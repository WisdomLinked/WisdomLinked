import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "../../../store";
import DashboardHeader from "../dashboardHeader";
import ExpertDrawer from "./drawer";
import { useDispatch } from "react-redux";
import { logoutUser, updateMe } from "../../../actions/authActions";

const ExpertDashboard = () => {
    const { auth: { userDetails } } = useAppSelector((state) => state);
    const navigate = useNavigate();
    const dispatch = useDispatch()
    const location = useLocation()

    useEffect(() => {
        const isLoggedIn = userDetails?.email;

        if (!isLoggedIn || userDetails.role !== 'expert') {
            dispatch(logoutUser())
        } else {
            updateMe()
        }
    }, [userDetails, location, navigate]);


    return (
        <div className="w-full h-[100vh] flex flex-col">
            {
                userDetails.status === 'review' ?
                    <div className="bg-[#234C6A] w-full h-14 leading-[120%] flex items-center px-6 justify-center text-white text-center">
                        Your account is under review. Some features are not able to use till you are approved.
                    </div> :
                    null
            }
            <DashboardHeader userDetails={userDetails} />
            <div className={`w-full ${userDetails.status === 'review' ? 'h-[calc(100vh-119px)]' : 'h-[calc(100vh-63px)]'} flex`}>
                <ExpertDrawer />
            </div>
        </div>
    );
};

export default ExpertDashboard;
