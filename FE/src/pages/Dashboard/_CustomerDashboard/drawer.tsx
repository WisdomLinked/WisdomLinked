import React, { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import Close from "@mui/icons-material/Close";
import VideoChat from "../../../components/VideoChat";
import IncomingCall from "../../../components/IncomingCall";
import Messenger from "../Messenger/Messenger";
import FriendsList from "../FriendsSideBar/FriendsList/FriendsList";
import ChatIcon from '@mui/icons-material/Chat';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import Calendar from "./calendar";
import Dashboard from "./dashboard";
import { useAppSelector } from "../../../store";
import Search from "./search";
import { doGetMyEvents } from "../../../api/api";
import { useDispatch } from "react-redux";
import { actionTypes } from "../../../actions/types";
import { isTheEventGoingOn } from "../../../actions/common";
import { cancelCallRequest, notifyChatLeft } from "../../../socket/socketConnection";
import { clearVideoChat } from "../../../actions/videoChatActions";
import CustomerProfile from "./profile";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import FriendsTitle from "../FriendsSideBar/FriendsTitle";
import GroupChatList from "../FriendsSideBar/GroupChatList";
import Seminars from "./seminars";
import CastForEducationIcon from '@mui/icons-material/CastForEducation';
import { leaveRoom } from "../../../socket/roomHandler";
import GeneralChatList from "../FriendsSideBar/GeneralChatList";

interface Props {
    window?: () => Window;
    localStream: MediaStream | null;
    isUserInRoom: boolean;
}

export default function CustomerDrawer(props: Props) {
    const { auth: { userDetails }, app: { location }, friends: { friends, groupChatList }, videoChat: { otherUserId, remoteStream }, chat: { currentEvent }, room: { roomDetails, isUserInRoom } } = useAppSelector((state) => state);
    const [leftNavActive, set_leftNavActive] = useState(false)
    const dispatch = useDispatch()
    const [events, set_events] = useState<any[]>([])
    const [oldCurrentEvent, set_oldCurrentEvent] = useState<any>(currentEvent)
    const [oldCurrentEventWasOngoing, set_oldCurrentEventWasOngoing] = useState<boolean>(false)

    const getEvents = async () => {
        const response = await doGetMyEvents()
        dispatch({
            type: 'updateUserDetails',
            payload: response.result
        })
        let temp = response.result.events.map((event: any) => {
            return {
                ...event,
                id: event._id,
                start: new Date(event.start),
                end: new Date(event.end),
                type: 'event',
            }
        })
        response.result.groupChats.map((seminar: any) => {
            temp.push({
                ...seminar,
                id: seminar._id,
                start: new Date(seminar.start),
                end: new Date(seminar.end),
                type: 'seminar'
            })
        })
        set_events([...temp])
    }

    const closeAllCall = () => {
        if (otherUserId && remoteStream) { // Close the current video Call
            console.log("Call got closed due to the session expiration.")
            notifyChatLeft(otherUserId, true);
            dispatch(clearVideoChat("Call got closed due to the session expiration."));
        }
        if (roomDetails && isUserInRoom) { // Leave from the current room
            leaveRoom()
        }
        cancelCallRequest({ otherUserId: otherUserId || '' })
    }

    const setCurrentEvent = async () => {
        set_oldCurrentEvent(currentEvent)
        if (currentEvent) {
            if (currentEvent.type === 'seminar') {
                set_oldCurrentEventWasOngoing(isUserInRoom)
            } else if (currentEvent.type === 'event') {
                set_oldCurrentEventWasOngoing(remoteStream ? true : false)
            }
        }

        let _currentEvent = null
        for (let i = 0; i < events.length; i++) {
            if (isTheEventGoingOn(events[i].start, events[i].end)) {
                _currentEvent = events[i]
                break
            }
        }
        dispatch({
            type: actionTypes.setCurrentEvent,
            payload: _currentEvent
        })
    }

    const openFeedbackModal = (otherUserId: any) => {
        dispatch({
            type: "SetFeedbackModalShow",
            payload: otherUserId,
        });
    }

    // Close all call when session expires ----------

    // useEffect(() => {
    //     if (oldCurrentEvent && !currentEvent) {
    //         closeAllCall()

    //         // OPENING FEEDBACK POPUP -----------
    //         if (oldCurrentEventWasOngoing) {
    //             if (oldCurrentEvent.type === 'seminar') {
    //                 openFeedbackModal(oldCurrentEvent.admin._id)
    //             } else if (oldCurrentEvent.type === 'event') {
    //                 openFeedbackModal(otherUserId)

    //             }
    //         }
    //     }
    // }, [currentEvent, oldCurrentEvent])

    // Resetting current event --------------

    const [resetCurrentEventFlag, set_resetCurrentEventFlag] = useState(false)

    useEffect(() => {
        if (resetCurrentEventFlag) {
            setCurrentEvent()
            set_resetCurrentEventFlag(false)
        }
    }, [resetCurrentEventFlag])

    useEffect(() => {
        set_resetCurrentEventFlag(true)
        const intervalId = setInterval(() => set_resetCurrentEventFlag(true), 5000);
        return () => {
            clearInterval(intervalId);
        };
    }, [events])

    // Getting all events and seminars ----------

    useEffect(() => {
        getEvents()
    }, [friends, groupChatList])

    return (
        <div className="flex w-full h-full bg-darkgrey-1">
            <button
                className={`block fixed ${userDetails.status === 'review' ? 'top-[73px]' : 'top-5'} left-4 z-[10000] text-white lg:hidden`}
                onClick={() => set_leftNavActive(!leftNavActive)}
            >
                {
                    leftNavActive ?
                        <Close /> :
                        <MenuIcon />
                }
            </button>
            <div className={`fixed ${userDetails.status === 'review' ? 'top-[112px] h-[calc(100vh-112px)]' : 'top-[63px] h-[calc(100vh-63px)]'} left-0 w-fit lg:top-0 lg:relative lg:h-full shadow-md ${leftNavActive ? 'leftnav_active' : 'leftnav'} flex z-[100]`}>
                <div className="w-[70px] h-full bg-black flex flex-col items-center space-y-5 py-4">
                    <Link to={`${process.env.REACT_APP_AUTH_URL}customerdashboard`} className={`flex flex-col items-center ${location === 'customerdashboard' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <DashboardIcon fontSize="medium" />
                        <span className="text-[10px]">Dashboard</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`} className={`flex flex-col items-center ${location === 'customerchat' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ChatIcon fontSize="medium" />
                        <span className="text-[10px]">Chat</span>
                    </Link>
                    <Link
                        to={`${process.env.REACT_APP_AUTH_URL}customerdashboard/search`}
                        className={`flex flex-col items-center ${location === 'customersearch' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'} ${userDetails.status === 'review' ? 'pointer-events-none' : ''}`}
                    >
                        <PersonSearchIcon fontSize="medium" />
                        <span className="text-[10px]">Experts</span>
                    </Link>
                    <Link
                        to={`${process.env.REACT_APP_AUTH_URL}customerdashboard/seminar`}
                        className={`flex flex-col items-center ${location === 'customerseminar' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'} ${userDetails.status === 'review' ? 'pointer-events-none' : ''}`}
                    >
                        <CastForEducationIcon fontSize="medium" />
                        <span className="text-[10px]">Seminars</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}customerdashboard/calendar`} className={`flex flex-col items-center ${location === 'customercalendar' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <CalendarMonthIcon fontSize="medium" />
                        <span className="text-[10px]">Calendar</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}customerdashboard/profile`} className={`flex flex-col items-center ${location === 'customerprofile' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ManageAccounts fontSize="medium" />
                        <span className="text-[10px]">Profile</span>
                    </Link>
                </div>
                <div className={`w-[300px] h-full bg-darkgrey overflow-y-auto px-[15px] pt-4 pb-[5px] ${location === 'customerchat' ? '' : 'hidden'}`}>
                    <FriendsTitle title="Shared Community Chats" />
                    <div className="h-[220px] overflow-y-auto">
                        <GeneralChatList/>
                    </div>
                    <div className="bg-black w-full h-[1px] mb-4"/>
                    <FriendsTitle title="Private Chats" />
                    <div className="h-[250  px] overflow-y-auto">
                        <FriendsList/>
                    </div>
                    {/* <div className="flex items-center mt-2">
                        <FriendsTitle title="Active Rooms" />
                        <CreateRoomButton isUserInRoom={props.isUserInRoom} />
                    </div>
                    <ActiveRooms /> */}
                    <div className="bg-black w-full h-[1px]" />
                    <div className="flex items-center mb-4">
                        <FriendsTitle title="Appointments" />
                    </div>
                    <div className="h-[250px] overflow-y-auto">
                        <GroupChatList type = "appointment"/>
                    </div>
                    <div className="bg-black w-full h-[1px]" />
                    <div className="flex items-center mb-4">
                        <FriendsTitle title="Seminars" />
                    </div>
                    <div className="h-[250px] overflow-y-auto">
                        <GroupChatList type = "seminar"/>
                    </div>
                </div>
            </div>
            <div className={`w-full ${location === 'customerchat' ? 'lg:w-[calc(100%-370px)]' : 'lg:w-[calc(100%-70px)]'} h-full`}>
                <Routes>
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/chat" element={<Messenger videoChaton = {!!props.localStream}/>} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/seminar" element={<Seminars />} />
                    <Route path="/profile" element={<CustomerProfile userDetails={userDetails} />} />
                    <Route path="/*" element={<Dashboard />} />
                </Routes>
            </div>
            {props.localStream && <VideoChat  role = {userDetails.role} otherUserId ={otherUserId}/>}
            <IncomingCall />
        </div>
    );
}
