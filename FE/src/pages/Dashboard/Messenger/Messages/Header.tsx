import React, { useRef, useEffect, useState } from "react";
import IconButton from "@mui/material/IconButton";
import AddIcCallIcon from "@mui/icons-material/AddIcCall";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { useAppSelector } from "../../../../store";
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
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { startMeeting } from "../../../../api/chatApi";
import {doLeftSeminar, doUpdateProfile, getCustomerById, getExpertById, shareMeetingViaEmail} from "../../../../api/api";
import {SetLoadingStatus, SetTotalTimeSpent} from "../../../../actions/appActions";
import { updateMe } from "../../../../actions/authActions";
import { showAlert } from "../../../../actions/alertActions";
import { resetChatAction, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import ProfileModal from "./ProfileModal";
import { ShareIcon } from "lucide-react";

const MessagesHeader = ({ scrollPosition, events, openCalendarModal, openSeminarModal, openEditSeminarModal, theme = "dark" }: any) => {

    const navRef = useRef<HTMLDivElement>(null);
    let navPosition = navRef.current?.getBoundingClientRect().top;
    const {
        auth: { userDetails },
        chat: { chosenChatDetails, chosenGroupChatDetails, currentEvent, conversationId },
        friends: { onlineUsers },
    } = useAppSelector((state) => state);

    const navActiveStyle =
        scrollPosition >= navPosition!
            ? (theme === "light" ? { backgroundColor: "#ffffff" } : { backgroundColor: "#141414" })
            : { backgroundColor: "transparent" };

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
    const [show_meeting_id, set_show_meeting_id] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [emailError, setEmailError] = useState('');

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

    const createNewRoomOrJoinRoom = async () => {
        const gid = chosenGroupChatDetails?.groupId;
        if (!gid) return;
        if (userDetails.role === 'expert' && enabledEvent) {
            SetTotalTimeSpent(Date.now());
        }
        const res = await startMeeting({ groupChatId: gid });
        if (res?.jitsiUrl) {
            window.open(res.jitsiUrl, '_blank', 'noopener,noreferrer');
        } else {
            dispatch(showAlert(res?.error || 'Could not start the meeting room'));
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

    const handleShareViaEmail = async (email: string, groupChatId: string) => {
        SetLoadingStatus(true)
        await shareMeetingViaEmail({email:email, groupchatId:groupChatId})
        SetLoadingStatus(false)
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
        set_kickedFromSeminar(false)
    }, [enabledEvent, userDetails, chosenGroupChatDetails])

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
        <div
            className={`w-full flex items-center justify-between sticky top-0 right-0 px-5 py-3 z-20 transition-all ${
                theme === "light"
                    ? "border-b border-slate-200"
                    : "rounded-b-[30px]"
            }`}
            style={navActiveStyle}
            ref={navRef}
        >
            {
                chosenChatDetails ?
                    (
                        enabledEvent ?
                            <div className={`w-[calc(100%-120px)] flex space-x-3 items-center ${theme === "light" ? "text-slate-700" : "text-lightgrey"}`}>
                                <CalendarMonthIcon fontSize="large" />
                                <div className="w-[calc(100%-48px)] flex flex-col" title={enabledEvent.title}>
                                    <div className={`text-[18px] truncate font-semibold ${theme === "light" ? "text-slate-900" : ""}`}>{enabledEvent.title}</div>
                                    <div className={`text-[12px] ${theme === "light" ? "text-slate-500" : ""}`}>( {formatDateYYYY_MM_DD_h_m(enabledEvent.start)?.split(' ')[1]} ~ {formatDateYYYY_MM_DD_h_m(enabledEvent.end)?.split(' ')[1]} )</div>
                                </div>
                            </div> :
                            <div className="w-[calc(100%-120px)] flex items-center justify-start space-x-3 cursor-pointer" title={chosenChatDetails?.username}
                                 onClick={()=>{
                                     handleProfileModalOpen(chosenChatDetails)
                                 }}>
                                <Avatar username={chosenChatDetails.username!} image={chosenChatDetails.image} />
                                <div className={`w-[calc(100%-48px)] text-[18px] mr-2 truncate font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
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
                        <div className={`w-[calc(100%-120px)] flex items-center justify-start space-x-3 ${theme === "light" ? "text-slate-900" : "text-white"}`} title={chosenGroupChatDetails?.groupName}>
                            {
                                enabledEvent ?
                                    <CastForEducationIcon fontSize="large" /> :
                                    <GroupsIcon />
                            }
                            <div className={`w-[calc(100%-48px)] mr-2 truncate font-semibold ${theme === "light" ? "text-[18px]" : "text-[20px]"}`}>
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
                            style={{ color: theme === "light" ? "#0f172a" : "white" }}
                            className="disabled:opacity-50"
                            disabled={
                                !conversationId ||
                                (((!isOnline(chosenChatDetails.userId) || !enabledEvent) && userDetails.role === 'customer'))
                            }
                            onClick={async () => {
                                if (enabledEvent) {
                                    SetTotalTimeSpent(Date.now());
                                }
                                if (!conversationId) {
                                    dispatch(showAlert('Chat is still loading — try again in a moment'));
                                    return;
                                }
                                const res = await startMeeting({ conversationId });
                                if (res?.jitsiUrl) {
                                    window.open(res.jitsiUrl, '_blank', 'noopener,noreferrer');
                                } else {
                                    dispatch(showAlert(res?.error || 'Could not start the call'));
                                }
                            }}
                        >
                            <AddIcCallIcon />
                        </IconButton>

                        <IconButton
                            style={{ color: theme === "light" ? "#0f172a" : "white" }}
                            className="disabled:opacity-50"
                            disabled={
                                !conversationId ||
                                (((!isOnline(chosenChatDetails.userId) || !enabledEvent) && userDetails.role === 'customer'))
                            }
                            onClick={async () => {
                                if (enabledEvent) {
                                    SetTotalTimeSpent(Date.now());
                                }
                                if (!conversationId) {
                                    dispatch(showAlert('Chat is still loading — try again in a moment'));
                                    return;
                                }
                                const res = await startMeeting({ conversationId });
                                if (res?.jitsiUrl) {
                                    window.open(res.jitsiUrl, '_blank', 'noopener,noreferrer');
                                } else {
                                    dispatch(showAlert(res?.error || 'Could not start the call'));
                                }
                            }}
                        >
                            <VideoCallIcon />
                        </IconButton>
                        <button
                            className={theme === "light" ? "text-slate-900 hover:bg-slate-100 rounded-lg p-1" : "text-white"}
                            onClick={() => set_buttonsModalShow(true)}
                        >
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
                                        className={`rounded-xl mr-4 py-1 px-4 text-sm font-semibold disabled:opacity-50 ${
                                            theme === "light"
                                                ? "bg-sky-600 hover:bg-sky-700 text-white"
                                                : "bg-green text-white"
                                        }`}
                                        title={!enabledEvent ? 'Seminar not started' : kickedFromSeminar ? 'You are blocked from this seminar by the expert' : 'Join a seminar'}
                                        disabled={
                                            !enabledEvent ||
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
                            <button
                                className={theme === "light" ? "text-slate-900 hover:bg-slate-100 rounded-lg p-1" : "text-white"}
                                onClick={() => set_buttonsModalShow(true)}
                            >
                                <MoreVertIcon />
                            </button>
                        </> :
                        null
                }
                {
                    chosenGroupChatDetails && !chosenGroupChatDetails?.duration ? (
                        <div className="flex items-center justify-end">
                            <IconButton
                                style={{ color: theme === "light" ? "#0f172a" : "white" }}
                                title="Start a group video call (Jitsi)"
                                onClick={async () => {
                                    const gid = chosenGroupChatDetails?.groupId;
                                    if (!gid) return;
                                    const res = await startMeeting({ groupChatId: gid });
                                    if (res?.jitsiUrl) {
                                        window.open(res.jitsiUrl, '_blank', 'noopener,noreferrer');
                                    } else {
                                        dispatch(showAlert(res?.error || 'Could not start the meeting room'));
                                    }
                                }}
                            >
                                <VideoCallIcon />
                            </IconButton>
                            <button
                                className={theme === "light" ? "text-slate-900 hover:bg-slate-100 rounded-lg p-1" : "text-white"}
                                onClick={() => set_buttonsModalShow(true)}
                            >
                                <MoreVertIcon />
                            </button>
                        </div>
                    ) : null
                }
            </div>
            {
                buttonsModalShow ?
                    <OverlayPortal closeModal={() => set_buttonsModalShow(false)}>
                        <div
                            className={`absolute top-[130px] right-5 w-max rounded-2xl shadow-md p-4 ${
                                theme === "light"
                                    ? "bg-white text-slate-900 border border-slate-200"
                                    : "bg-black text-white"
                            }`}
                        >
                            {
                                chosenChatDetails ?
                                    <>
                                        <button
                                            className={`w-full flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                            } disabled:opacity-50`}
                                            disabled={!events?.length}
                                            onClick={handleShowEvents}
                                        >
                                            <div>
                                                Show Events
                                                <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${acceptedfutureEvents?.length ? '' : 'hidden'} ${theme === "light" ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-green text-white"}`}>{acceptedfutureEvents?.length}</span>
                                            </div>
                                            <CalendarMonthIcon />
                                        </button>
                                        <button
                                            className={`mt-1 w-full flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                            } disabled:opacity-50`}
                                            disabled={!!(futureEvents.length)}
                                            onClick={handleRemoveFriend}
                                        >
                                            <span>Remove {userDetails?.role === 'customer' ? 'Expert' : 'Customer'}</span>
                                            <PersonRemoveIcon />
                                        </button>
                                    </> :
                                    <>
                                        <button
                                            className={`w-full flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                            } disabled:opacity-50`}
                                            onClick={handleParticipantsOpenDialog}
                                        >
                                            <span>View Participants ({chosenGroupChatDetails?.participants.length})</span>
                                            <PeopleAltIcon />
                                        </button>
                                        <button
                                            className={`w-full mt-1 flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                            } disabled:opacity-50`}
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
                                            (() => {
                                                // Handle both populated and unpopulated admin field
                                                const adminId = typeof chosenGroupChatDetails?.admin === 'string' 
                                                    ? chosenGroupChatDetails?.admin 
                                                    : chosenGroupChatDetails?.admin?._id || chosenGroupChatDetails?.admin?.id;
                                                const isAdmin = adminId && adminId.toString() === userDetails?._id?.toString();
                                                return isAdmin;
                                            })() ?
                                                (() => {
                                                    const isCommunityChat = chosenGroupChatDetails?.type === "community";
                                                    return (
                                                        <>
                                                            <button
                                                                className={`w-full mt-1 flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                                    theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                                                } disabled:opacity-50`}
                                                                onClick={() => {
                                                                    set_buttonsModalShow(false)
                                                                    set_show_meeting_id(true)
                                                                }}
                                                            >
                                                                <span>Share Meeting ID</span>
                                                                <ShareIcon />
                                                            </button>
                                                            {!isCommunityChat && (
                                                                <button
                                                                    className={`w-full mt-1 flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                                        theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                                                    } disabled:opacity-50`}
                                                                    disabled={chosenGroupChatDetails?.participants.length > 1}
                                                                    onClick={() => {
                                                                        set_buttonsModalShow(false)
                                                                        openEditSeminarModal()
                                                                    }}
                                                                >
                                                                    <span>Edit Details</span>
                                                                    <EditIcon />
                                                                </button>
                                                            )}
                                                            <button
                                                                className={`mt-1 w-full flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                                    theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                                                } disabled:opacity-50 ${theme === "light" ? "text-rose-700" : ""}`}
                                                                disabled={!isCommunityChat && chosenGroupChatDetails?.participants.length > 1}
                                                                onClick={handleDeleteGroup}
                                                            >
                                                                <span>{isCommunityChat ? "Delete Community Chat" : "Delete Seminar"}</span>
                                                                <ClearIcon />
                                                            </button>
                                                        </>
                                                    );
                                                })() :
                                                <button
                                                    className={`mt-1 w-full flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
                                                        theme === "light" ? "hover:bg-slate-50" : "hover:opacity-50"
                                                    } disabled:opacity-50`}
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
                        className={
                            theme === "light"
                                ? `
                            fixed top-[120px] right-14 bg-white w-[280px] rounded-2xl text-slate-900 text-[14px] p-4 shadow-xl border border-slate-200
                            before:absolute before:z-10 before:w-3 before:h-3 before:bg-white before:rotate-45 before:-top-1 before:right-7 animation_fadeIn before:border-l before:border-t before:border-slate-200
                        `
                                : `
                            fixed top-[120px] right-14 bg-black w-[250px] rounded-lg text-white text-lg p-4
                            before:absolute before:z-10 before:w-3 before:h-3 before:bg-black before:rotate-45 before:-top-1 before:right-7 animation_fadeIn
                        `
                        }
                    >
                        <button
                            className={theme === "light" ? "absolute right-2 top-2 rounded-md hover:bg-slate-100 p-1" : "absolute right-1.5 top-0.5 rounded-md hover:opacity-50"}
                            onClick={closeJoinPopup}
                        >
                            <CloseIcon />
                        </button>
                        <div className={theme === "light" ? "font-semibold" : ""}>Join a seminar once the button gets available.</div>
                        <div className="flex items-center space-x-2 mt-2">
                            <button
                                className={`w-3 h-3 lg:w-4 lg:h-4 rounded-[4px] ${
                                    joinPopupBlocked
                                        ? (theme === "light" ? "text-sky-600" : "text-green")
                                        : (theme === "light" ? "border border-sky-600" : "border border-green")
                                }`}
                                onClick={() => set_joinPopupBlocked(!joinPopupBlocked)}
                            >
                                <svg className="w-[14px] h-[14px] lg:w-[18px] lg:h-[18px] -mt-[1px] -ml-[1px]" style={{ display: joinPopupBlocked ? 'block' : 'none' }} viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8.44352 0.666748H3.55518C1.43185 0.666748 0.166016 1.93258 0.166016 4.05591V8.93841C0.166016 11.0676 1.43185 12.3334 3.55518 12.3334H8.43768C10.561 12.3334 11.8268 11.0676 11.8268 8.94425V4.05591C11.8327 1.93258 10.5668 0.666748 8.44352 0.666748ZM8.78768 5.15841L5.48018 8.46591C5.39852 8.54758 5.28768 8.59425 5.17102 8.59425C5.05435 8.59425 4.94352 8.54758 4.86185 8.46591L3.21102 6.81508C3.04185 6.64591 3.04185 6.36591 3.21102 6.19675C3.38018 6.02758 3.66018 6.02758 3.82935 6.19675L5.17102 7.53841L8.16935 4.54008C8.33852 4.37091 8.61852 4.37091 8.78768 4.54008C8.95685 4.70925 8.95685 4.98341 8.78768 5.15841Z" fill="currentColor" />
                                </svg>
                            </button>
                            <span className={theme === "light" ? "text-slate-600" : ""}>Don't show this again</span>
                        </div>
                    </div> :
                    null
            }
            {
    show_meeting_id ?
        <OverlayPortal closeModal={() => set_show_meeting_id(false)}>
            <div className={`fixed inset-0 flex items-center justify-center z-50 ${theme === "light" ? "bg-black/30 backdrop-blur-sm" : "bg-black bg-opacity-50"}`}>
                <div className={`${theme === "light" ? "bg-white text-slate-900 border border-slate-200" : "bg-black text-white"} rounded-2xl shadow-md p-6 max-w-sm w-full mx-4 relative`}>
                    {/* Close button at top right */}
                    <button
                        className={theme === "light"
                            ? "absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors flex items-center justify-center"
                            : "absolute top-4 right-4 bg-gray-600 hover:bg-gray-700 p-2 rounded-full transition-colors flex items-center justify-center"}
                        onClick={() => set_show_meeting_id(false)}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className={`text-lg mb-4 text-center ${theme === "light" ? "text-slate-600" : ""}`}>Meeting ID:</div>
                    <div className="text-xl font-bold text-center mb-4">{chosenGroupChatDetails?.groupId}</div>
                    
                    {!showEmailInput ? (
                        <div className="flex space-x-3">
                            <button
                                className="flex-1 bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-xl transition-colors flex items-center justify-center space-x-2 text-white"
                                onClick={() => {
                                    navigator.clipboard.writeText(chosenGroupChatDetails?.groupId);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 1000);
                                }}
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>

                            <button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors flex items-center justify-center space-x-2 text-white"
                                onClick={() => setShowEmailInput(true)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span>Share via Email</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <input
                                    type="email"
                                    placeholder="Enter email address"
                                    value={emailAddress}
                                    onChange={(e) => {
                                        setEmailAddress(e.target.value);
                                        if (emailError) setEmailError('');
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 ${
                                        theme === "light"
                                            ? "bg-white text-slate-900 border-slate-200 focus:ring-sky-500/30 focus:border-sky-500"
                                            : `bg-gray-700 text-white ${emailError ? 'border-red-500' : 'border-gray-600'} focus:border-blue-500`
                                    }`}
                                />
                                {emailError && (
                                    <div className="text-red-400 text-sm mt-1">{emailError}</div>
                                )}
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors flex items-center justify-center space-x-2 text-white"
                                    onClick={() => {
                                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                        if (!emailAddress.trim()) {
                                            setEmailError('Please enter an email address');
                                            return;
                                        }
                                        if (!emailRegex.test(emailAddress.trim())) {
                                            setEmailError('Please enter a valid email address');
                                            return;
                                        }
                                        handleShareViaEmail(emailAddress.trim(), chosenGroupChatDetails?.groupId);
                                        setShowEmailInput(false);
                                        setEmailAddress('');
                                        setEmailError('');
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    <span>Share</span>
                                </button>
                                <button
                                    className={theme === "light"
                                        ? "flex-1 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors text-slate-900"
                                        : "flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"}
                                    onClick={() => {
                                        setShowEmailInput(false);
                                        setEmailAddress('');
                                        setEmailError('');
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </OverlayPortal> :
        null
}
        </div>
    );
};

export default MessagesHeader;