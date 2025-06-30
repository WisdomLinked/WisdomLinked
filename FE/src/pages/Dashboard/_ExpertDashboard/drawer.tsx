import React, { useState, useEffect } from "react";
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
import ScheduleIcon from '@mui/icons-material/Schedule';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import Calendar from "./calendar";
import Dashboard from "./dashboard";
import { useAppSelector } from "../../../store";
import Availability from "./availability";
import { useDispatch } from "react-redux";
import { doGetMyEvents } from "../../../api/api";
import { isTheEventGoingOn } from "../../../actions/common";
import { cancelCallRequest, notifyChatLeft } from "../../../socket/socketConnection";
import { clearVideoChat } from "../../../actions/videoChatActions";
import ExpertProfile from "./profile";
import JoinMeeting from "../joinMeeting"
import FriendsTitle from "../FriendsSideBar/FriendsTitle";
import GroupChatList from "../FriendsSideBar/GroupChatList";
import CastForEducationIcon from '@mui/icons-material/CastForEducation';
import ExpertSeminar from "./seminar";
import AddToPhotosIcon from '@mui/icons-material/AddToPhotos';
import { actionTypes } from "../../../actions/types";
import { leaveRoom } from "../../../socket/roomHandler";
import GeneralChatList from "../FriendsSideBar/GeneralChatList";
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import Search from "./search";

interface Props {
    window?: () => Window;
    localStream: MediaStream | null;
    isUserInRoom: boolean;
}

export default function ExpertDrawer(props: Props) {
    const { auth: { userDetails }, app: { location }, friends: { friends, groupChatList }, videoChat: { otherUserId, remoteStream }, room: { roomDetails, isUserInRoom }, chat: { currentEvent } } = useAppSelector((state) => state);
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
                title: '(S)' + seminar.name,
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
        if (currentEvent?.type === 'event') {
            set_oldCurrentEventWasOngoing(remoteStream ? true : false)
        } else {
            set_oldCurrentEventWasOngoing(false)
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
    //             if (oldCurrentEvent.type === 'event') {
    //                 openFeedbackModal(otherUserId)
    //             }
    //         }

    //     }
    // }, [currentEvent])

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
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard`} className={`flex flex-col items-center ${location === 'expertdashboard' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <DashboardIcon fontSize="medium" />
                        <span className="text-[10px]">Dashboard</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`} className={`flex flex-col items-center ${location === 'expertchat' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ChatIcon fontSize="medium" />
                        <span className="text-[10px]">Chat</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/search`} className={`flex flex-col items-center ${location === 'expertsearch' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'} ${userDetails.status === 'review' ? 'pointer-events-none' : ''}`}>
                        <PersonSearchIcon fontSize="medium" />
                        <span className="text-[10px]">Customers</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/seminar`} className={`flex flex-col items-center ${location === 'expertseminar' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'} ${userDetails.status === 'review' ? 'pointer-events-none' : ''}`}>
                        <CastForEducationIcon fontSize="medium" />
                        <span className="text-[10px]">New Seminar</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/calendar`} className={`flex flex-col items-center ${location === 'expertcalendar' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <CalendarMonthIcon fontSize="medium" />
                        <span className="text-[10px]">Calendar</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/joinMeeting`} className={`flex flex-col items-center ${location === 'expertjoinMeeting' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'} ${userDetails.status === 'review' ? 'pointer-events-none' : ''}`}>
                        <MeetingRoomIcon fontSize="medium" />
                        <span className="text-[10px]">Join Meeting</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/timeslots`} className={`flex flex-col items-center ${location === 'experttimeslots' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ScheduleIcon fontSize="medium" />
                        <span className="text-[10px]">Availability</span>
                    </Link>
                    <Link to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/profile`} className={`flex flex-col items-center ${location === 'expertprofile' ? 'text-lightgrey' : 'text-grey hover:text-lightgrey'}`}>
                        <ManageAccountsIcon fontSize="medium" />
                        <span className="text-[10px]">Profile</span>
                    </Link>
                </div>
                <div className={`w-[300px] h-full bg-darkgrey overflow-y-auto px-[15px] pt-4 pb-[5px] ${location === 'expertchat' ? '' : 'hidden'}`}>
                    <FriendsTitle title="Shared Community Chats" />
                    <div className="h-[220px] overflow-y-auto">
                        <GeneralChatList/>
                    </div>
                    <div className="bg-black w-full h-[1px] mb-4"/>
                    <FriendsTitle title="Private Chats" />
                    <div className="h-[250px] overflow-y-auto">
                        <FriendsList/>
                    </div>
                    {/* <div className="flex items-center mt-2">
                        <FriendsTitle title="Active Rooms" />
                        <CreateRoomButton isUserInRoom={props.isUserInRoom} />
                    </div>
                    <ActiveRooms /> */}
                    <div className="bg-black w-full h-[1px]" />
                    <div className="flex items-center mb-4">
                        <FriendsTitle title="Individual Sessions" />
                    </div>
                    <div className="h-[250px] overflow-y-auto">
                        <GroupChatList type = "individual"/>
                    </div>
                    <div className="bg-black w-full h-[1px]" />
                    <div className="flex items-center mb-4">
                        <FriendsTitle title="Seminars" />
                        <Link
                            title="Create New Seminar"
                            to={`${process.env.REACT_APP_AUTH_URL}expertdashboard/seminar`}
                            className="block text-grey p-1 rounded-md hover:bg-midgrey hover:text-white"
                        >
                            <AddToPhotosIcon />
                        </Link>
                    </div>
                    <div className="h-[250px] overflow-y-auto">
                        <GroupChatList type = "seminar" />
                    </div>
                </div>
            </div>
            <div className={`w-full ${location === 'expertchat' ? 'lg:w-[calc(100%-370px)]' : 'lg:w-[calc(100%-70px)]'} h-full`}>
                <Routes>
                    <Route path="/timeslots" element={<Availability />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/chat" element={<Messenger videoChaton = {!!props.localStream}/>} />
                    <Route path="/profile" element={<ExpertProfile userDetails={userDetails} />} />
                    <Route path="/seminar" element={<ExpertSeminar />} />
                    <Route path="/search" element={<Search />} />
                    <Route path ="/joinMeeting" element={<JoinMeeting />} />
                    <Route path="/*" element={<Dashboard />} />
                </Routes>
                {props.localStream && <VideoChat role = {userDetails.role} otherUserId ={otherUserId}/>}
                <IncomingCall />
            </div>
        </div>
    );
}
