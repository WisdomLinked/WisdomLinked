import React, { useEffect, useRef, useState } from "react";
import { useAppSelector } from "../../../store";
import { useNavigate } from "react-router-dom";
import Avatar from "../../../components/Avatar";
import { formatDateYYYY_MM_DD_h_m } from "../../../actions/common";
import {
    addMemberToGroup,
    doAcceptEvent,
    doCancelInvitation,
    profileImageFetch
} from "../../../api/api";
import { updateMe } from "../../../actions/authActions";
import { useDispatch } from "react-redux";
import { SetLoadingStatus } from "../../../actions/appActions";
import { setChosenChatDetails, setChosenGroupChatDetails } from "../../../actions/chatActions";
import Chatbot from "../../../components/chatbot";
import Dashboard from "../../../components/dashboard";
import { Persona } from "../../../utils/constants";

const ExpertDashboard = () => {

    const { auth: { userDetails = {} }, friends: { groupChatList } } = useAppSelector((state) => state);
    const { _id, pendingGroupChats, groupChats: groupChat, events, status } = userDetails;

    const dispatch = useDispatch()

    const [groupChats, set_groupChats] = useState<any>([])


    useEffect(() => {
        const now = new Date().getTime();

        const updatedGroupChats = pendingGroupChats.filter((item: any) => new Date(item.groupChatId.end).getTime() >= now);
        // console.log("updatedSeminars: ", updatedSeminars);
        // console.log("updatedgroupChats: ", updatedGroupChats);
        // console.log("updatedSessions: ", updatedSessions);

        set_groupChats(updatedGroupChats);

    }, [events, pendingGroupChats, groupChat]);

    useEffect(() => {
        dispatch(updateMe())
    }, [])

    return (

        <Dashboard
            userId={_id}
            userStatus={status}
            userRole={Persona.EXPERT}
            pendingGroupChats={pendingGroupChats}
            groupChats={groupChats}
            events={events}
            groupChatList={groupChatList}
        ></Dashboard>
    );
};

export default ExpertDashboard;
