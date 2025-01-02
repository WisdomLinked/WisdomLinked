import React, { useRef, useEffect, useState } from "react";
import IconButton from "@mui/material/IconButton";
import AddIcCallIcon from "@mui/icons-material/AddIcCall";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { useAppSelector } from "../../../../store";
import { callRequest } from "../../../../socket/socketConnection";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import Avatar from "../../../../components/Avatar";
import OverlayPortal from "../../../../components/OverayPortal";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { useDispatch } from "react-redux";
import { removeFriendAction } from "../../../../actions/friendActions";
import { formatDateYYYY_MM_DD_h_m, isFutureEvent, isTheEventGoingOn } from "../../../../actions/common";
import GroupParticipantsDialog from "./GroupParticipantsDialog";
import { deleteGroupAction, leaveGroupAction } from "../../../../actions/groupChatActions";
import GroupsIcon from "@mui/icons-material/Groups";
import ClearIcon from '@mui/icons-material/Clear';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import CastForEducationIcon from '@mui/icons-material/CastForEducation';
import { createNewRoom, joinRoom } from "../../../../socket/roomHandler";
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import {doLeftSeminar, doUpdateProfile, getCustomerById, getExpertById, profileImageFetch} from "../../../../api/api";
import { SetLoadingStatus } from "../../../../actions/appActions";
import { updateMe } from "../../../../actions/authActions";
import { showAlert } from "../../../../actions/alertActions";
import { resetChatAction, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import ProfileModal from "./ProfileModal";

const MessagesHeader = ({ scrollPosition, events, openCalendarModal, openSeminarModal, openEditSeminarModal }: any) => {

    const navRef = useRef<HTMLDivElement>(null);
    let navPosition = navRef.current?.getBoundingClientRect().top;
    const {
        auth: { userDetails },
        chat: { chosenChatDetails, chosenGroupChatDetails, currentEvent },
        friends: { onlineUsers },
        room: { isUserInRoom, activeRooms, roomDetails }
    } = useAppSelector((state) => state);

    const navActiveStyle = scrollPosition >= navPosition! ? { backgroundColor: "#141414" } : { backgroundColor: "transparent" };

    const dispatch = useDispatch()
    const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
    const [acceptedfutureEvents, set_acceptedfutureEvents] = useState<Array<any>>([])
    const [futureEvents, set_futureEvents] = useState<Array<any>>([])
    const [enabledEvent, set_enabledEvent] = useState<any>(null)
    const [buttonsModalShow, set_buttonsModalShow] = useState(false)
    const [profileModalShow, set_profileModalShow] = useState(false)
    const [chosenProfileData, set_chosenProfileData] = useState<any>({})
    const [joinPopupBlocked, set_joinPopupBlocked] = useState(userDetails.joinPopupBlocked)
    const [joinPopupShow, set_joinPopupShow] = useState(false)
    const [kickedFromSeminar, set_kickedFromSeminar] = useState(false)

    const checkEnabledEvent = () => {
        let event = events.find((event: any) => event?._id === currentEvent?._id)
        set_enabledEvent(event)
    }

    const handleShowEvents = () => {
        set_buttonsModalShow(false)
        openCalendarModal()
    }

    const handleRemoveFriend = () => {
        set_buttonsModalShow(false)
        if (chosenChatDetails) {
            dispatch(removeFriendAction({
                friendId: chosenChatDetails.userId,
                friendName: chosenChatDetails.username
            }));
        }
    }

    const handleParticipantsOpenDialog = () => {
        setParticipantsDialogOpen(true);
    };

    const handleParticipantsCloseDialog = () => {
        setParticipantsDialogOpen(false);
    };

    const handleLeaveGroup = async () => {
        SetLoadingStatus(true)
        const response = await doLeftSeminar(chosenGroupChatDetails?.groupId)
        if (response) {
            dispatch(updateMe())
            dispatch(showAlert('You left a seminar and your money refunded'))
            dispatch(resetChatAction())
        }
        set_buttonsModalShow(false)
        SetLoadingStatus(false)
    };

    const handleDeleteGroup = () => {
        if (chosenGroupChatDetails) {
            dispatch(
                deleteGroupAction({
                    groupChatId: chosenGroupChatDetails?.groupId,
                    groupChatName: chosenGroupChatDetails?.groupName
                })
            );
        }
    };

    const isOnline = (userId: any) => {
        return onlineUsers.find(user => user.userId === userId) ? true : false
    }

    const createNewRoomOrJoinRoom = () => {
        if (activeRooms?.length) {
            console.log('Join room')
            joinRoom(activeRooms[0])
        } else {
            console.log('Creating a room')
            createNewRoom(chosenGroupChatDetails?.groupId)
        }
    }

    const closeJoinPopup = async () => {
        set_joinPopupShow(false)
        if (joinPopupBlocked) {
            await doUpdateProfile({
                joinPopupBlocked: true
            })
        }
    }

    useEffect(() => {
        let temp: any = []
        let temp1: any = []
        for (let i = 0; i < events.length; i++) {
            if ((isTheEventGoingOn(events[i].start, events[i].end) || isFutureEvent(events[i].start))) {
                if (events[i].status === 'accepted')
                    temp.push(events[i])
                temp1.push(events[i])
            }
        }
        set_acceptedfutureEvents([...temp])
        set_futureEvents([...temp1])
    }, [events])

    useEffect(() => {
        if (currentEvent) {
            checkEnabledEvent()
        } else {
            set_enabledEvent(null)
        }
    }, [currentEvent, events])

    useEffect(() => {
        if (chosenGroupChatDetails && !userDetails.joinPopupBlocked) {
            set_joinPopupShow(true)
            set_joinPopupBlocked(false)
            const timer = setTimeout(() => {
                closeJoinPopup()
            }, 5000)
            return () => {
                closeJoinPopup()
                clearTimeout(timer)
            }
        }
    }, [chosenGroupChatDetails])

    useEffect(() => {
        console.log("User Details:",userDetails);
        if (activeRooms?.length && enabledEvent) {
            // console.log(activeRooms)
            const room = activeRooms.find(x => x.groupId === enabledEvent?._id)
            const kicked = room?.kickedParticipants?.find(x => x === userDetails.userId)
            set_kickedFromSeminar(!!kicked)
        } else {
            set_kickedFromSeminar(false)
        }
        // console.log('---------------------------\n',enabledEvent, isUserInRoom, userDetails, chosenGroupChatDetails, activeRooms)
        // !enabledEvent ||
        // isUserInRoom ||
        // !(
        //     userDetails?.userId === chosenGroupChatDetails?.admin?._id ||
        //     enabledEvent?.participants?.findIndex((x:any) => x?._id === activeRooms?.[0]?.roomCreator?.userId) > -1
        // )
    }, [enabledEvent, isUserInRoom, userDetails, chosenGroupChatDetails, activeRooms])

    const fetchProfileData=async ()=>{

    }

    const handleProfileModalOpen= async (chosenChatDetails:any) =>{
        const response = userDetails.role=="expert"? await getCustomerById(chosenChatDetails.userId): await getExpertById(chosenChatDetails.userId)
        set_chosenProfileData(response.result)
        set_profileModalShow(true)
    }

    const handleProfileModalClose= async () =>{
        set_chosenProfileData({})
        set_profileModalShow(false)
    }


    return (
        <div className="w-full flex items-center justify-between sticky top-0 right-0 px-5 py-3 rounded-b-[30px] z-20 transition-all" style={navActiveStyle} ref={navRef}>
            {
                chosenChatDetails ?
                    (
                        enabledEvent ?
                            <div className="w-[calc(100%-120px)] flex space-x-3 items-center text-lightgrey">
                                <CalendarMonthIcon fontSize="large" />
                                <div className="w-[calc(100%-48px)] flex flex-col" title={enabledEvent.title}>
                                    <div className="text-[20px] truncate">{enabledEvent.title}</div>
                                    <div className="text-[12px]">( {formatDateYYYY_MM_DD_h_m(enabledEvent.start)?.split(' ')[1]} ~ {formatDateYYYY_MM_DD_h_m(enabledEvent.end)?.split(' ')[1]} )</div>
                                </div>
                            </div> :
                            <div className="w-[calc(100%-120px)] flex items-center justify-start space-x-3 cursor-pointer" title={chosenChatDetails?.username}
                                 onClick={()=>{
                                     handleProfileModalOpen(chosenChatDetails)
                                 }}>
                                <Avatar username={chosenChatDetails.username!} image={chosenChatDetails.image} />
                                <div className="w-[calc(100%-48px)] text-[20px] text-white mr-2 truncate">
                                    {chosenChatDetails?.username}
                                </div>
                                <ProfileModal
                                    isOpen={profileModalShow}
                                    onClose={handleProfileModalClose}
                                    userDetails={chosenProfileData}
                                />
                            </div>
                    ) :
                    chosenGroupChatDetails ?
                        <div className="w-[calc(100%-120px)] flex items-center justify-start space-x-3 text-white" title={chosenGroupChatDetails?.groupName}>
                            {
                                enabledEvent ?
                                    <CastForEducationIcon fontSize="large" /> :
                                    <GroupsIcon />
                            }
                            <div className="w-[calc(100%-48px)] text-[20px] mr-2 truncate">
                                {
                                    chosenGroupChatDetails?.duration ?
                                        chosenGroupChatDetails?.groupName :
                                        userDetails.userId === chosenGroupChatDetails.admin?._id ?
                                            chosenGroupChatDetails?.description :
                                            chosenGroupChatDetails?.groupName

                                }
                            </div>
                        </div> :
                        null
            }
            <div className="w-[120px] flex items-center justify-end">
                {chosenChatDetails && (
                    <div className="flex items-center justify-center">
                        <IconButton
                            style={{ color: "white" }}
                            className="disabled:opacity-50"
                            disabled={(!isOnline(chosenChatDetails.userId) || !enabledEvent) && userDetails.role==="customer"}
                            onClick={() => {
                                callRequest({
                                    audioOnly: true,
                                    callerName: userDetails
                                        ? userDetails.username
                                        : "",
                                    receiverUserId: chosenChatDetails?.userId!,
                                    eventId: enabledEvent?._id
                                });
                            }}
                        >
                            <AddIcCallIcon />
                        </IconButton>

                        <IconButton
                            style={{ color: "white" }}
                            className="disabled:opacity-50"
                            disabled={(!isOnline(chosenChatDetails.userId) || !enabledEvent) && userDetails.role==="customer"}
                            onClick={() => {
                                console.log("call request initiated");
                                callRequest({
                                    audioOnly: false,
                                    callerName: userDetails
                                        ? userDetails.username
                                        : "",
                                    receiverUserId: chosenChatDetails?.userId!,
                                    eventId: enabledEvent?._id
                                });
                            }}
                        >
                            <VideoCallIcon />
                        </IconButton>
                        <button className="text-white" onClick={() => set_buttonsModalShow(true)}>
                            <MoreVertIcon />
                        </button>
                    </div>
                )}
                {
                    chosenGroupChatDetails?.duration ?
                        <>
                            {
                                chosenGroupChatDetails && (
                                    <button
                                        className="bg-green rounded-md mr-4 py-0.5 px-4 text-lg text-white font-bold disabled:opacity-50"
                                        title={!enabledEvent ? 'Seminar not started' : isUserInRoom ? 'You are already in the seminar' : kickedFromSeminar ? 'You are blocked from this seminar by the expert' : 'Join a seminar'}
                                        disabled={
                                            !enabledEvent ||
                                            isUserInRoom ||
                                            kickedFromSeminar
                                            // activeRooms?.kickedParticipants?.find(x => x === userDetails.userId)
                                            // !(
                                            //     userDetails?.userId === chosenGroupChatDetails?.admin?._id ||
                                            //     enabledEvent?.participants?.findIndex((x:any) => x?._id === activeRooms?.[0]?.roomCreator?.userId) > -1
                                            // )
                                        }
                                        onClick={createNewRoomOrJoinRoom}
                                    >
                                        Join
                                    </button>
                                )
                            }
                            <button className="text-white" onClick={() => set_buttonsModalShow(true)}>
                                <MoreVertIcon />
                            </button>
                        </> :
                        null
                }
            </div>
            {
                buttonsModalShow ?
                    <OverlayPortal closeModal={() => set_buttonsModalShow(false)}>
                        <div className="absolute top-[130px] right-5 w-max bg-black rounded-lg shadow-md p-6 text-white">
                            {
                                chosenChatDetails ?
                                    <>
                                        <button
                                            className="w-full flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                            disabled={!events?.length}
                                            onClick={handleShowEvents}
                                        >
                                            <div>
                                                Show Events
                                                <span className={`bg-green ml-1 px-2 rounded-full ${acceptedfutureEvents?.length ? '' : 'hidden'}`}>{acceptedfutureEvents?.length}</span>
                                            </div>
                                            <CalendarMonthIcon />
                                        </button>
                                        <button
                                            className="mt-5 w-full flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                            disabled={!!(futureEvents.length)}
                                            onClick={handleRemoveFriend}
                                        >
                                            <span>Remove {userDetails?.role === 'customer' ? 'Expert' : 'Customer'}</span>
                                            <PersonRemoveIcon />
                                        </button>
                                    </> :
                                    <>
                                        <button
                                            className="w-full flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                            onClick={handleParticipantsOpenDialog}
                                        >
                                            <span>View Participants ({chosenGroupChatDetails?.participants.length})</span>
                                            <PeopleAltIcon />
                                        </button>
                                        <button
                                            className="w-full mt-5 flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                            onClick={() => {
                                                set_buttonsModalShow(false)
                                                openSeminarModal()
                                            }}
                                        >
                                            <div>
                                                Show Details
                                            </div>
                                            <CastForEducationIcon />
                                        </button>
                                        {
                                            chosenGroupChatDetails?.admin?._id === userDetails?._id ?
                                                <>
                                                    <button
                                                        className="w-full mt-5 flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                                        disabled={chosenGroupChatDetails?.participants.length > 1}
                                                        onClick={() => {
                                                            set_buttonsModalShow(false)
                                                            openEditSeminarModal()
                                                        }}
                                                    >
                                                        <span>Edit Details</span>
                                                        <EditIcon />
                                                    </button>
                                                    <button
                                                        className="mt-5 w-full flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                                        disabled={chosenGroupChatDetails?.participants.length > 1}
                                                        onClick={handleDeleteGroup}
                                                    >
                                                        <span>Delete Seminar</span>
                                                        <ClearIcon />
                                                    </button>
                                                </> :
                                                <button
                                                    className="mt-5 w-full flex space-x-4 justify-between items-center hover:opacity-50 disabled:opacity-50"
                                                    onClick={handleLeaveGroup}
                                                >
                                                    <span>Leave Group</span>
                                                    <LogoutIcon />
                                                </button>
                                        }
                                    </>
                            }
                        </div>
                    </OverlayPortal> :
                    null
            }
            {chosenGroupChatDetails && userDetails && (
                <>
                    <GroupParticipantsDialog
                        isDialogOpen={participantsDialogOpen}
                        closeDialogHandler={handleParticipantsCloseDialog}
                        groupDetails={chosenGroupChatDetails}
                        currentUserId={userDetails?._id}
                    />
                </>
            )}
            {
                chosenGroupChatDetails?.duration && joinPopupShow ?
                    <div
                        className={`
                            fixed top-[120px] right-14 bg-black w-[250px] rounded-lg text-white text-lg p-4
                            before:absolute before:z-10 before:w-3 before:h-3 before:bg-black before:rotate-45 before:-top-1 before:right-7 animation_fadeIn
                        `}
                    >
                        <button
                            className="absolute right-1.5 top-0.5    rounded-md hover:opacity-50"
                            onClick={closeJoinPopup}
                        >
                            <CloseIcon />
                        </button>
                        <div> Join a Seminar once the button gets available.</div>
                        <div className="flex items-center space-x-2 mt-2">
                            <button
                                className={`w-3 h-3 lg:w-4 lg:h-4 rounded-[4px] ${joinPopupBlocked ? 'text-green' : 'border border-green'}`}
                                onClick={() => set_joinPopupBlocked(!joinPopupBlocked)}
                            >
                                <svg className="w-[14px] h-[14px] lg:w-[18px] lg:h-[18px] -mt-[1px] -ml-[1px]" style={{ display: joinPopupBlocked ? 'block' : 'none' }} viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8.44352 0.666748H3.55518C1.43185 0.666748 0.166016 1.93258 0.166016 4.05591V8.93841C0.166016 11.0676 1.43185 12.3334 3.55518 12.3334H8.43768C10.561 12.3334 11.8268 11.0676 11.8268 8.94425V4.05591C11.8327 1.93258 10.5668 0.666748 8.44352 0.666748ZM8.78768 5.15841L5.48018 8.46591C5.39852 8.54758 5.28768 8.59425 5.17102 8.59425C5.05435 8.59425 4.94352 8.54758 4.86185 8.46591L3.21102 6.81508C3.04185 6.64591 3.04185 6.36591 3.21102 6.19675C3.38018 6.02758 3.66018 6.02758 3.82935 6.19675L5.17102 7.53841L8.16935 4.54008C8.33852 4.37091 8.61852 4.37091 8.78768 4.54008C8.95685 4.70925 8.95685 4.98341 8.78768 5.15841Z" fill="currentColor" />
                                </svg>
                            </button>
                            <span> Don't show this again </span>
                        </div>
                    </div> :
                    null
            }
        </div>
    );
};

export default MessagesHeader;