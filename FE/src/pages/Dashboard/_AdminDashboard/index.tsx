import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectWithSocketServer, UserDetails } from "../../../socket/socketConnection";
import { useAppSelector } from "../../../store";
import DashboardHeader from "../dashboardHeader";
import { useDispatch } from "react-redux";
import AdminDrawer from "./drawer";
import { logoutUser } from "../../../actions/authActions";

const AdminDashboard = () => {
    const {auth: {userDetails}, videoChat: {localStream}, room: { isUserInRoom, localStreamRoom }, app: { connectedWithSocketServer }} = useAppSelector((state) => state);
    const navigate = useNavigate();
    const dispatch = useDispatch()

    useEffect(() => {
        const isLoggedIn = userDetails?.email;

        if (!isLoggedIn || userDetails.role !== 'admin') {
            dispatch(logoutUser())
        } else if (!connectedWithSocketServer) {
            // connect to socket server
            connectWithSocketServer(userDetails as UserDetails);
            dispatch({
                type: 'SetConnectedWithSocketServer',
                payload: true
            })
        }
    }, [userDetails, navigate]);


    return (
        <div className="w-full h-[100vh] flex flex-col">
            <DashboardHeader userDetails={userDetails}/>
            <div className="w-full h-[calc(100vh-63px)] flex">
                <AdminDrawer />
            </div>
        </div>
    );
};

export default AdminDashboard;
