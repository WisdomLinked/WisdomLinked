import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
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
import ManageCommunityMembersDialog from "./ManageCommunityMembersDialog";
import AddCommunityMembersDialog from "./AddCommunityMembersDialog";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
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
import { Bell, MessageSquare, ShareIcon, X } from "lucide-react";

const MessagesHeader = ({ scrollPosition, events, openCalendarModal, openSeminarModal, openEditSeminarModal, theme = "dark" }: any) => {

    const navRef = useRef<HTMLDivElement>(null);
    let navPosition = navRef.current?.getBoundingClientRect().top;
    const {
        auth: { userDetails },
        chat: {
            chosenChatDetails,
            chosenGroupChatDetails,
            currentEvent,
            conversationId,
            rcChannelId,
            dmUnreadByRid,
        },
        friends: { onlineUsers },
    } = useAppSelector((state) => state);

    /** Same pattern as dashboard TopBar: one row per room with unread (not the open thread). */
    const messengerChatNotifications = useMemo(() => {
        const active = String(rcChannelId || "");
        const dcs = userDetails?.directConversations ?? [];
        const dmRids = new Set(
            dcs.map((c: any) => String(c?.rcChannelId || "").trim()).filter(Boolean),
        );
        const meId = String(userDetails?._id ?? userDetails?.id ?? userDetails?.userId ?? "");
        const labelForRid = (rid: string) => {
            const conv = dcs.find((c: any) => String(c?.rcChannelId || "") === rid);
            if (conv?.participants?.length) {
                const other = conv.participants.find(
                    (p: any) => String(p?._id ?? p?.id ?? "") && String(p?._id ?? p?.id ?? "") !== meId,
                );
                const nm = String(other?.username || other?.name || other?.email || "").trim();
                if (nm) return nm;
            }
            const gcs = [...(userDetails?.generalChats ?? []), ...(userDetails?.groupChats ?? [])];
            const g = gcs.find((x: any) => String(x?.rcChannelId || "") === rid);
            if (g) return String(g?.name ?? g?.groupName ?? "Chat").trim() || "Chat";
            return dmRids.has(rid) ? "Direct message" : "Chat";
        };
        return Object.entries(dmUnreadByRid || {})
            .filter(([rid, n]) => String(rid) !== active && Number(n) > 0)
            .map(([rid, count]) => {
                const n = Number(count) || 0;
                const isDm = dmRids.has(rid);
                const label = labelForRid(rid);
                return {
                    id: rid,
                    rid,
                    isDm,
                    title: `${label} messaged you`,
                    meta: `${n > 99 ? "99+" : n} unread message${n !== 1 ? "s" : ""}`,
                };
            });
    }, [dmUnreadByRid, rcChannelId, userDetails]);

    const [openMessengerNotifs, setOpenMessengerNotifs] = useState(false);
    const messengerNotifRef = useRef<HTMLDivElement>(null);

    const openThreadFromMessengerNotif = useCallback((item: (typeof messengerChatNotifications)[0]) => {
        if (item.isDm) localStorage.setItem("wl_open_dm_rid", item.rid);
        else localStorage.setItem("wl_open_community_rc_rid", item.rid);
        window.dispatchEvent(new Event("wl-open-chat-nav"));
        setOpenMessengerNotifs(false);
    }, []);

    useEffect(() => {
        if (!openMessengerNotifs) return;
        const close = (e: MouseEvent) => {
            const el = messengerNotifRef.current;
            if (el && !el.contains(e.target as Node)) setOpenMessengerNotifs(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [openMessengerNotifs]);

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
    const [manageCommunityMembersOpen, setManageCommunityMembersOpen] = useState(false);
    const [headerLeaveCommunityOpen, setHeaderLeaveCommunityOpen] = useState(false);
    const [deleteCommunityConfirmOpen, setDeleteCommunityConfirmOpen] = useState(false);
    const [addCommunityMembersOpen, setAddCommunityMembersOpen] = useState(false);

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
        set_buttonsModalShow(false);
        if (!chosenGroupChatDetails?.groupId) return;
        if (chosenGroupChatDetails.type === 'community') {
            setHeaderLeaveCommunityOpen(true);
            return;
        }
        SetLoadingStatus(true);
        const response = await doLeftSeminar(chosenGroupChatDetails.groupId);
        if (response) {
            dispatch(updateMe());
            dispatch(showAlert('You left a seminar and your money refunded'));
            dispatch(resetChatAction());
        }
        SetLoadingStatus(false);
    };

    const confirmLeaveCommunityFromHeader = () => {
        setHeaderLeaveCommunityOpen(false);
        if (!chosenGroupChatDetails?.groupId) return;
        dispatch(leaveGroupAction({ groupChatId: chosenGroupChatDetails.groupId }));
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

    const openDeleteCommunityConfirm = () => {
        set_buttonsModalShow(false);
        setDeleteCommunityConfirmOpen(true);
    };

    const confirmDeleteCommunityFromHeader = () => {
        setDeleteCommunityConfirmOpen(false);
        handleDeleteGroup();
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
            <div className="relative flex min-w-[120px] shrink-0 items-center justify-end gap-1" ref={messengerNotifRef}>
                {messengerChatNotifications.length > 0 ? (
                    <>
                        <button
                            type="button"
                            onClick={() => setOpenMessengerNotifs((o) => !o)}
                            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                theme === "light"
                                    ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                    : "border-slate-600 bg-transparent text-white hover:bg-white/10"
                            }`}
                            aria-label="Chat notifications"
                        >
                            <Bell className="h-4 w-4" aria-hidden />
                            <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-4 text-white">
                                {messengerChatNotifications.length > 99
                                    ? "99+"
                                    : messengerChatNotifications.length}
                            </span>
                        </button>
                        {openMessengerNotifs ? (
                            <div
                                className={`absolute right-0 top-10 z-[130] w-[min(320px,calc(100vw-2rem))] rounded-xl border shadow-[0_16px_40px_rgba(0,0,0,0.14)] ${
                                    theme === "light"
                                        ? "border-[#E5E2DB] bg-white"
                                        : "border-slate-600 bg-[#1a1a1a]"
                                }`}
                            >
                                <div
                                    className={`flex items-center justify-between border-b px-4 py-3 ${
                                        theme === "light" ? "border-[#E5E2DB]" : "border-slate-600"
                                    }`}
                                >
                                    <p
                                        className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${
                                            theme === "light" ? "text-[#7A7A72]" : "text-slate-400"
                                        }`}
                                    >
                                        Notifications
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setOpenMessengerNotifs(false)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        aria-label="Close notifications"
                                    >
                                        <X className="h-4 w-4" aria-hidden />
                                    </button>
                                </div>
                                <div className="max-h-72 overflow-y-auto p-2">
                                    {messengerChatNotifications.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => openThreadFromMessengerNotif(item)}
                                            className={`w-full rounded-lg px-2 py-2 text-left ${
                                                theme === "light" ? "hover:bg-[#F5F3EF]" : "hover:bg-white/5"
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E8EEF4]">
                                                    <MessageSquare className="h-3.5 w-3.5 text-[#1A3A4A]" aria-hidden />
                                                </span>
                                                <div className="min-w-0">
                                                    <p
                                                        className={`text-[13px] font-semibold leading-snug ${
                                                            theme === "light" ? "text-slate-900" : "text-white"
                                                        }`}
                                                    >
                                                        {item.title}
                                                    </p>
                                                    <p
                                                        className={`text-[11px] ${
                                                            theme === "light" ? "text-slate-500" : "text-slate-400"
                                                        }`}
                                                    >
                                                        {item.meta}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : null}
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
                            className={`absolute top-[130px] right-5 min-w-[260px] max-w-[min(100vw-2rem,320px)] rounded-2xl border p-1 shadow-lg ${
                                theme === "light"
                                    ? "border-slate-200 bg-white text-slate-900"
                                    : "border-slate-700 bg-[#141414] text-white"
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
                                            type="button"
                                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                theme === "light" ? "text-slate-800 hover:bg-slate-50" : "hover:bg-white/10"
                                            }`}
                                            onClick={handleParticipantsOpenDialog}
                                        >
                                            <span>View Participants ({chosenGroupChatDetails?.participants.length})</span>
                                            <PeopleAltIcon fontSize="small" className="shrink-0 opacity-70" />
                                        </button>
                                        <button
                                            type="button"
                                            className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                theme === "light" ? "text-slate-800 hover:bg-slate-50" : "hover:bg-white/10"
                                            }`}
                                            onClick={() => {
                                                set_buttonsModalShow(false)
                                                openSeminarModal()
                                            }}
                                        >
                                            <span>Show Details</span>
                                            <CastForEducationIcon fontSize="small" className="shrink-0 opacity-70" />
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
                                                                type="button"
                                                                className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                                    theme === "light" ? "text-slate-800 hover:bg-slate-50" : "hover:bg-white/10"
                                                                }`}
                                                                onClick={() => {
                                                                    set_buttonsModalShow(false)
                                                                    set_show_meeting_id(true)
                                                                }}
                                                            >
                                                                <span>Share Meeting ID</span>
                                                                <ShareIcon className="h-4 w-4 shrink-0 opacity-70" />
                                                            </button>
                                                            {!isCommunityChat && (
                                                                <button
                                                                    type="button"
                                                                    className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                                        theme === "light" ? "text-slate-800 hover:bg-slate-50" : "hover:bg-white/10"
                                                                    } disabled:opacity-50`}
                                                                    disabled={chosenGroupChatDetails?.participants.length > 1}
                                                                    onClick={() => {
                                                                        set_buttonsModalShow(false)
                                                                        openEditSeminarModal()
                                                                    }}
                                                                >
                                                                    <span>Edit Details</span>
                                                                    <EditIcon fontSize="small" className="shrink-0 opacity-70" />
                                                                </button>
                                                            )}
                                                            {isCommunityChat ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                                            theme === "light" ? "text-slate-800 hover:bg-slate-50" : "hover:bg-white/10"
                                                                        }`}
                                                                        onClick={() => {
                                                                            set_buttonsModalShow(false);
                                                                            setAddCommunityMembersOpen(true);
                                                                        }}
                                                                    >
                                                                        <span>Add members</span>
                                                                        <PersonAddIcon fontSize="small" className="shrink-0 opacity-70" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                                                                            theme === "light" ? "text-slate-800 hover:bg-slate-50" : "hover:bg-white/10"
                                                                        }`}
                                                                        onClick={() => {
                                                                            set_buttonsModalShow(false);
                                                                            setManageCommunityMembersOpen(true);
                                                                        }}
                                                                    >
                                                                        <span>Remove members</span>
                                                                        <PersonRemoveIcon fontSize="small" className="shrink-0 opacity-70" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                                                                            theme === "light"
                                                                                ? "text-rose-700 hover:bg-rose-50"
                                                                                : "text-rose-300 hover:bg-white/10"
                                                                        }`}
                                                                        onClick={openDeleteCommunityConfirm}
                                                                    >
                                                                        <span>Delete community</span>
                                                                        <ClearIcon fontSize="small" className="shrink-0 opacity-90" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                                                                            theme === "light"
                                                                                ? "text-slate-800 hover:bg-slate-50"
                                                                                : "hover:bg-white/10"
                                                                        }`}
                                                                        onClick={() => {
                                                                            set_buttonsModalShow(false);
                                                                            setHeaderLeaveCommunityOpen(true);
                                                                        }}
                                                                    >
                                                                        <span>Leave community</span>
                                                                        <LogoutIcon fontSize="small" className="shrink-0 opacity-90" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                                                                        theme === "light"
                                                                            ? "text-rose-700 hover:bg-rose-50"
                                                                            : "text-rose-300 hover:bg-white/10"
                                                                    } disabled:opacity-50`}
                                                                    disabled={chosenGroupChatDetails?.participants.length > 1}
                                                                    onClick={handleDeleteGroup}
                                                                >
                                                                    <span>Delete Seminar</span>
                                                                    <ClearIcon fontSize="small" className="shrink-0 opacity-90" />
                                                                </button>
                                                            )}
                                                        </>
                                                    );
                                                })() :
                                                <button
                                                    type="button"
                                                    className={`mt-0.5 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                                                        chosenGroupChatDetails?.type === 'community'
                                                            ? theme === "light"
                                                                ? "text-rose-700 hover:bg-rose-50"
                                                                : "text-rose-300 hover:bg-white/10"
                                                            : theme === "light"
                                                              ? "text-slate-800 hover:bg-slate-50"
                                                              : "hover:bg-white/10"
                                                    }`}
                                                    onClick={handleLeaveGroup}
                                                >
                                                    <span>
                                                        {chosenGroupChatDetails?.type === 'community'
                                                            ? 'Leave community'
                                                            : 'Leave Group'}
                                                    </span>
                                                    <LogoutIcon fontSize="small" className="shrink-0 opacity-90" />
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
                        theme={theme === "light" ? "light" : "dark"}
                    />
                    {chosenGroupChatDetails?.type === "community" ? (
                        <>
                            <AddCommunityMembersDialog
                                open={addCommunityMembersOpen}
                                onClose={() => setAddCommunityMembersOpen(false)}
                                groupDetails={chosenGroupChatDetails}
                                theme={theme === "light" ? "light" : "dark"}
                            />
                            <ManageCommunityMembersDialog
                                isDialogOpen={manageCommunityMembersOpen}
                                closeDialogHandler={() => setManageCommunityMembersOpen(false)}
                                groupDetails={chosenGroupChatDetails}
                                currentUserId={userDetails._id}
                                theme={theme === "light" ? "light" : "dark"}
                            />
                        </>
                    ) : null}
                    <Dialog
                        open={headerLeaveCommunityOpen}
                        onClose={() => setHeaderLeaveCommunityOpen(false)}
                        maxWidth="xs"
                        fullWidth
                    >
                        <DialogTitle>Leave this community?</DialogTitle>
                        <DialogContent>
                            <p className="text-sm text-slate-600">
                                You won’t see this community in your list anymore. Others stay in the chat, and a short
                                notice will appear that you left.
                            </p>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                            <Button onClick={() => setHeaderLeaveCommunityOpen(false)}>Cancel</Button>
                            <Button variant="contained" color="error" onClick={confirmLeaveCommunityFromHeader}>
                                Leave community
                            </Button>
                        </DialogActions>
                    </Dialog>
                    <Dialog
                        open={deleteCommunityConfirmOpen}
                        onClose={() => setDeleteCommunityConfirmOpen(false)}
                        maxWidth="xs"
                        fullWidth
                    >
                        <DialogTitle>Delete this community?</DialogTitle>
                        <DialogContent>
                            <p className="text-sm text-slate-600">
                                This removes <strong>{chosenGroupChatDetails?.groupName}</strong> for{" "}
                                <strong>everyone</strong>. All members will lose access and the chat history tied to this
                                room.
                            </p>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                            <Button onClick={() => setDeleteCommunityConfirmOpen(false)}>Cancel</Button>
                            <Button variant="contained" color="error" onClick={confirmDeleteCommunityFromHeader}>
                                Delete community
                            </Button>
                        </DialogActions>
                    </Dialog>
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