import React, { useEffect, useRef, useState } from "react";
import { useAppSelector } from "../../../store";
import Avatar from "../../../components/Avatar";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import { doCancelEvent, doCancelPendingSeminar, doUpdateEvent, profileImageFetch } from "../../../api/api";
import { updateMe } from "../../../actions/authActions";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { useNavigate } from "react-router-dom";
import CloseIcon from '@mui/icons-material/Close';
import SelectDateTime from "../selectDateTime";
import { showAlert } from "../../../actions/alertActions";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../actions/chatActions";
import Chatbot from "../../../components/chatbot";
import CollapsibleSection from "../../../components/collapsibleSection";
import { Session } from "../../../api/types";
import SessionCardComponent from "../../../components/sessionCardComponent";
import Dashboard from "../../../components/dashboard";
import { Persona } from "../../../utils/constants";


/**
 * 
 * Events : 1x1 sessions that may be completed, or upcoming or pending acceptance by the expert.
 * Group Chats (Seminars) : Created by experts and can be joined by customers at a given price.
 * Pending Group Chats : A customer who paid for a Seminar gets added to the list of pending members in a seminar.
 *                       It needs to be accepted by the expert.
 */
const CustomerDashboard = () => {

    const { auth: { userDetails: { pendingGroupChats, events, groupChats, status, _id: userId } }, friends: { groupChatList } } = useAppSelector(state => state)
    const dispatch = useDispatch()


    // Dispatch `updateMe` only once when the component mounts
    useEffect(() => {
        dispatch(updateMe());
    }, [dispatch]);

    return (
        <Dashboard
            userId={userId}
            userStatus={status}
            userRole={Persona.CUSTOMER}
            pendingGroupChats={pendingGroupChats}
            groupChats={groupChats}
            events={events}
            groupChatList={groupChatList}        
        ></Dashboard>
    );
};

export default CustomerDashboard;