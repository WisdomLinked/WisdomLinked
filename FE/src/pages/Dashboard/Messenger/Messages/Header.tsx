import React, { useRef, useEffect, useMemo, useState } from "react";
import IconButton from "@mui/material/IconButton";
import { useAppSelector } from "../../../../store";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import OverlayPortal from "../../../../components/OverayPortal";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { useDispatch } from "react-redux";
import { removeFriendAction } from "../../../../actions/friendActions";
import { formatDateYYYY_MM_DD_h_m, getAvatarTitle, isFutureEvent, isTheEventGoingOn } from "../../../../actions/common";
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
import { fetchDirectCallHistory, startMeeting } from "../../../../api/chatApi";
import { fetchChatUserProfile } from "../../../../api/chatApi";
import {doLeftSeminar, doUpdateProfile, shareMeetingViaEmail} from "../../../../api/api";
import {SetLoadingStatus, SetTotalTimeSpent} from "../../../../actions/appActions";
import { updateMe } from "../../../../actions/authActions";
import { showAlert } from "../../../../actions/alertActions";
import { addNewMessage, resetChatAction, setChosenGroupChatDetails } from "../../../../actions/chatActions";
import ProfileModal from "./ProfileModal";
import CommunityProfileModal from "./CommunityProfileModal";
import ChatHeader from "./ChatHeader";
import { History, ShareIcon, Video } from "lucide-react";
import { buildFallbackChatProfile, mergeChatProfile } from "../../../../utils/chatProfileModal";
import { buildOnlineUserIdSet, hasOnlineUserId } from "../../../../utils/onlinePresence";

export const appendMeetingStartMessage = (res: any, dispatch: any) => {
    if (res?.message) {
        dispatch(addNewMessage(res.message));
    }
};

const MessagesHeader = ({ events, openCalendarModal, openSeminarModal, openEditSeminarModal, theme = "dark" }: any) => {

    const navRef = useRef<HTMLDivElement>(null);
    const {
        auth: { userDetails },
        chat: {
            chosenChatDetails,
            chosenGroupChatDetails,
            currentEvent,
            conversationId,
        },
        friends: { onlineUsers },
    } = useAppSelector((state) => state);

    const dispatch = useDispatch()
    const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
    const [acceptedfutureEvents, set_acceptedfutureEvents] = useState<Array<any>>([])
    const [futureEvents, set_futureEvents] = useState<Array<any>>([])
    const [enabledEvent, set_enabledEvent] = useState<any>(null)
    const [buttonsModalShow, set_buttonsModalShow] = useState(false)
    const [profileModalShow, set_profileModalShow] = useState(false)
    const [communityModalShow, set_communityModalShow] = useState(false)
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
    const [callHistoryOpen, setCallHistoryOpen] = useState(false);
    const [callHistoryLoading, setCallHistoryLoading] = useState(false);
    const [callHistoryRows, setCallHistoryRows] = useState<Array<any>>([]);

    const openMeetingUrl = (jitsiUrl?: string, pendingWindow: Window | null = null) => {
        if (!jitsiUrl) {
            if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
            return;
        }
        if (pendingWindow && !pendingWindow.closed) {
            pendingWindow.location.href = jitsiUrl;
            return;
        }
        // Mobile Safari/Chrome may block async popups; same-tab navigation remains reliable.
        window.location.assign(jitsiUrl);
    };

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
            const label = userDetails?.role === 'customer' ? 'expert' : 'customer';
            if (!window.confirm(`Remove this ${label} from your chat list?`)) return;
            dispatch(removeFriendAction({
                friendId: chosenChatDetails.userId,
                friendName: chosenChatDetails.username
            }));
        }
    }

    const formatCallDuration = (seconds: number) => {
        const total = Math.max(0, Number(seconds) || 0);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const formatCallDateTime = (iso: string | null | undefined) => {
        if (!iso) return "—";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleString();
    };

    const handleOpenCallHistory = async () => {
        if (!conversationId) {
            dispatch(showAlert('Chat is still loading — try again in a moment'));
            return;
        }
        set_buttonsModalShow(false);
        setCallHistoryOpen(true);
        setCallHistoryLoading(true);
        try {
            const res = await fetchDirectCallHistory(conversationId, 50);
            setCallHistoryRows(Array.isArray(res?.history) ? res.history : []);
        } finally {
            setCallHistoryLoading(false);
        }
    };

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
        if (!window.confirm("Leave this seminar/group? You may lose access to this chat.")) return;
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

    const handleDeleteGroup = (skipConfirm = false) => {
        if (chosenGroupChatDetails) {
            set_buttonsModalShow(false);
            const isCommunity = chosenGroupChatDetails?.type === "community";
            const label = isCommunity ? "community" : "seminar";
            if (!skipConfirm && !window.confirm(`Delete this ${label} for everyone? This cannot be undone.`)) return;
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
        handleDeleteGroup(true);
    };

    const onlineIdSet = useMemo(() => {
        return buildOnlineUserIdSet(onlineUsers);
    }, [onlineUsers]);

    const isOnline = (userId: any) => {
        return hasOnlineUserId(onlineIdSet, userId);
    }

    const createNewRoomOrJoinRoom = async () => {
        const gid = chosenGroupChatDetails?.groupId;
        if (!gid) return;
        const pendingWindow = window.open("", "_blank");
        if (userDetails.role === 'expert' && enabledEvent) {
            SetTotalTimeSpent(Date.now());
        }
        const res = await startMeeting({ groupChatId: gid });
        if (res?.jitsiUrl) {
            appendMeetingStartMessage(res, dispatch);
            openMeetingUrl(res.jitsiUrl, pendingWindow);
        } else {
            if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
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

    useEffect(() => {
        if (chosenGroupChatDetails?.type !== "community") {
            set_communityModalShow(false);
        }
    }, [chosenGroupChatDetails]);

    const handleProfileModalOpen= async (chosenChatDetails:any) =>{
        const fallback = buildFallbackChatProfile(chosenChatDetails, String(userDetails?.role || ""));
        set_chosenProfileData(fallback);
        set_profileModalShow(true)
        const response = await fetchChatUserProfile(String(chosenChatDetails?.userId || ""));
        if (response?.success && response?.result) {
            set_chosenProfileData(mergeChatProfile(fallback, response.result));
        }
    }

    const handleProfileModalClose= async () =>{
        set_chosenProfileData({})
        set_profileModalShow(false)
    }

    const handleCommunityModalOpen = () => {
        set_communityModalShow(true);
    };

    const handleCommunityModalClose = () => {
        set_communityModalShow(false);
    };

    const groupAdminId =
        typeof chosenGroupChatDetails?.admin === "string"
            ? chosenGroupChatDetails?.admin
            : chosenGroupChatDetails?.admin?._id || chosenGroupChatDetails?.admin?.id;
    const groupCoModeratorIds = new Set(
        (chosenGroupChatDetails?.coModerators || [])
            .map((c: any) => String(c?._id ?? c?.id ?? c))
            .filter(Boolean),
    );
    const isGroupAdmin = !!groupAdminId && String(groupAdminId) === String(userDetails?._id);
    const isCommunityModerator = chosenGroupChatDetails?.type === "community"
        && (isGroupAdmin || groupCoModeratorIds.has(String(userDetails?._id || "")));

    const peerRoleLower = String(chosenChatDetails?.peerRole || "").toLowerCase();
    /** Students never start Meet calls to experts; all other DM role combinations can ask the backend to start. */
    const studentCannotStartDmVideoToExpert =
        String(userDetails?.role || "").toLowerCase() === "customer" && peerRoleLower === "expert";

    const handleDmStartVideoOrVoice = async () => {
        const pendingWindow = window.open("", "_blank");
        if (enabledEvent) {
            SetTotalTimeSpent(Date.now());
        }
        if (!conversationId) {
            if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
            dispatch(showAlert("Chat is still loading — try again in a moment"));
            return;
        }
        const res = await startMeeting({ conversationId });
        if (res?.jitsiUrl) {
            appendMeetingStartMessage(res, dispatch);
            openMeetingUrl(res.jitsiUrl, pendingWindow);
        } else {
            if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
            dispatch(showAlert(res?.error || "Could not start the call"));
        }
    };

    return (
        <div
            className={`w-full flex items-center justify-between sticky top-0 right-0 px-5 py-3 z-20 transition-all ${
                theme === "light" ? "bg-wl-page" : "bg-darkgrey-1 rounded-b-[30px]"
            }`}
            ref={navRef}
        >
            {
                chosenChatDetails ?
                    (
                        enabledEvent ?
                            <div
                                className={`w-[calc(100%-120px)] flex items-center gap-3 rounded-xl border px-3 py-2 ${
                                    theme === "light"
                                        ? "border-stone-200 bg-gradient-to-r from-wl-page to-[#E8E4DC] text-slate-700"
                                        : "border-slate-700 bg-slate-900/80 text-lightgrey"
                                }`}
                            >
                                <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme === "light" ? "bg-wl-page text-[#234C6A] border border-stone-200" : "bg-slate-800 text-slate-200"}`}>
                                    <CalendarMonthIcon fontSize="small" />
                                </div>
                                <div className="min-w-0 flex-1" title={enabledEvent.title}>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme === "light" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-emerald-900/40 text-emerald-200 border border-emerald-700/60"}`}>
                                            Live
                                        </span>
                                        <div className={`truncate text-[16px] font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                                            {enabledEvent.title}
                                        </div>
                                    </div>
                                    <div className={`mt-0.5 text-[12px] ${theme === "light" ? "text-slate-500" : "text-slate-300"}`}>
                                        {formatDateYYYY_MM_DD_h_m(enabledEvent.start)?.split(' ')[1]} - {formatDateYYYY_MM_DD_h_m(enabledEvent.end)?.split(' ')[1]}
                                    </div>
                                </div>
                            </div> :
                            (() => {
                                const peerOnline = isOnline(chosenChatDetails.userId);
                                const rawLast =
                                    (chosenChatDetails as { peerLastSeenAt?: string; lastSeen?: string })
                                        .peerLastSeenAt ??
                                    (chosenChatDetails as { lastSeen?: string }).lastSeen;
                                const parsedLast = rawLast ? new Date(rawLast) : undefined;
                                const lastSeenForLabel =
                                    !peerOnline &&
                                    parsedLast &&
                                    !Number.isNaN(parsedLast.getTime())
                                        ? parsedLast
                                        : undefined;
                                const initialsRaw = String(chosenChatDetails.username || "Member").trim();
                                const initials = initialsRaw ? getAvatarTitle(initialsRaw) : "?";

                                return (
                                    <ChatHeader
                                        name={String(chosenChatDetails.username || "Chat")}
                                        status={peerOnline ? "online" : "offline"}
                                        lastSeen={lastSeenForLabel}
                                        avatarInitials={initials}
                                        image={chosenChatDetails?.image}
                                        theme={theme === "light" ? "light" : "dark"}
                                        onNameAreaClick={() => {
                                            void handleProfileModalOpen(chosenChatDetails);
                                        }}
                                        onVideoClick={() => void handleDmStartVideoOrVoice()}
                                        videoDisabled={!conversationId || studentCannotStartDmVideoToExpert}
                                        videoTitle={
                                            studentCannotStartDmVideoToExpert
                                                ? "Only your expert can start a video or audio call. You can keep messaging in this chat."
                                                : !conversationId
                                                  ? "Chat is still loading — try again in a moment"
                                                  : "Start call"
                                        }
                                        onMoreClick={() => set_buttonsModalShow(true)}
                                    />
                                );
                            })()
                    ) :
                    chosenGroupChatDetails ?
                        <div
                            className={`w-[calc(100%-120px)] flex items-center justify-start space-x-3 ${theme === "light" ? "text-slate-900" : "text-white"} ${chosenGroupChatDetails?.type === "community" ? "cursor-pointer" : ""}`}
                            title={chosenGroupChatDetails?.groupName}
                            onClick={() => {
                                if (chosenGroupChatDetails?.type === "community") handleCommunityModalOpen();
                            }}
                        >
                            {enabledEvent ? (
                                <>
                                    <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme === "light" ? "bg-wl-page text-[#234C6A] border border-stone-200" : "bg-slate-800 text-slate-200"}`}>
                                        <CastForEducationIcon fontSize="small" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme === "light" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-emerald-900/40 text-emerald-200 border border-emerald-700/60"}`}>
                                                Live
                                            </span>
                                            <div className={`truncate font-semibold ${theme === "light" ? "text-[16px] text-slate-900" : "text-[18px] text-white"}`}>
                                                {chosenGroupChatDetails?.groupName}
                                            </div>
                                        </div>
                                        <div className={`mt-0.5 text-[12px] ${theme === "light" ? "text-slate-500" : "text-slate-300"}`}>
                                            {formatDateYYYY_MM_DD_h_m(enabledEvent.start)?.split(' ')[1]} - {formatDateYYYY_MM_DD_h_m(enabledEvent.end)?.split(' ')[1]}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <GroupsIcon />
                                    <div className={`w-[calc(100%-48px)] mr-2 truncate font-semibold ${theme === "light" ? "text-[18px]" : "text-[20px]"}`}>
                                        {chosenGroupChatDetails?.groupName}
                                    </div>
                                </>
                            )}
                        </div> :
                        null
            }
            {!(chosenChatDetails && !enabledEvent) ? (
                <div className="w-[120px] flex items-center justify-end">
                {chosenChatDetails && enabledEvent && (
                    <div className="flex items-center justify-center">
                        <IconButton
                            style={{ color: theme === "light" ? "#0f172a" : "white" }}
                            className="disabled:opacity-50"
                            title={
                                studentCannotStartDmVideoToExpert
                                    ? "Only your expert can start a video or audio call. You can keep messaging in this chat."
                                    : !conversationId
                                      ? "Chat is still loading — try again in a moment"
                                      : "Start call"
                            }
                            disabled={!conversationId || studentCannotStartDmVideoToExpert}
                            onClick={async () => {
                                const pendingWindow = window.open("", "_blank");
                                if (enabledEvent) {
                                    SetTotalTimeSpent(Date.now());
                                }
                                if (!conversationId) {
                                    if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
                                    dispatch(showAlert('Chat is still loading — try again in a moment'));
                                    return;
                                }
                                const res = await startMeeting({ conversationId });
                                if (res?.jitsiUrl) {
                                    appendMeetingStartMessage(res, dispatch);
                                    openMeetingUrl(res.jitsiUrl, pendingWindow);
                                } else {
                                    if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
                                    dispatch(showAlert(res?.error || 'Could not start the call'));
                                }
                            }}
                        >
                            <Video className="h-5 w-5" strokeWidth={2} />
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
                                        className="mr-4 rounded-xl bg-[#234C6A] px-4 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b3c53] disabled:cursor-not-allowed disabled:bg-[#89A6BC] disabled:text-white disabled:shadow-none"
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
                            {isGroupAdmin || isCommunityModerator ? (
                                <IconButton
                                    style={{ color: theme === "light" ? "#0f172a" : "white" }}
                                    title="Start a group video call (WisdomLinked Meet)"
                                    onClick={async () => {
                                        const pendingWindow = window.open("", "_blank");
                                        const gid = chosenGroupChatDetails?.groupId;
                                        if (!gid) {
                                            if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
                                            return;
                                        }
                                        const res = await startMeeting({ groupChatId: gid });
                                        if (res?.jitsiUrl) {
                                            appendMeetingStartMessage(res, dispatch);
                                            openMeetingUrl(res.jitsiUrl, pendingWindow);
                                        } else {
                                            if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
                                            dispatch(showAlert(res?.error || 'Could not start the meeting room'));
                                        }
                                    }}
                                >
                                    <Video className="h-5 w-5" strokeWidth={2} />
                                </IconButton>
                            ) : null}
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
            ) : null}
            {chosenChatDetails ? (
                <ProfileModal
                    isOpen={profileModalShow}
                    onClose={handleProfileModalClose}
                    userDetails={chosenProfileData}
                    theme={theme}
                    previewImage={chosenChatDetails.image}
                    viewerRole={userDetails?.role}
                />
            ) : null}
            {chosenGroupChatDetails?.type === "community" ? (
                <CommunityProfileModal
                    isOpen={communityModalShow}
                    onClose={handleCommunityModalClose}
                    communityDetails={chosenGroupChatDetails}
                    theme={theme}
                    onViewMembers={handleParticipantsOpenDialog}
                />
            ) : null}
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
                                            }`}
                                            onClick={handleOpenCallHistory}
                                        >
                                            <span>Call History</span>
                                            <History className="h-4 w-4" />
                                        </button>
                                        <button
                                            className={`mt-1 w-full flex space-x-4 justify-between items-center rounded-lg px-2 py-2 ${
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
                                            <span>View Participants ({chosenGroupChatDetails?.participants?.length ?? 0})</span>
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
                                            (isGroupAdmin || isCommunityModerator) ?
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
                                                                    disabled={(chosenGroupChatDetails?.participants?.length ?? 0) > 1}
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
                                                                    {isCommunityModerator ? (
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
                                                                                <span>Manage members</span>
                                                                                <PersonRemoveIcon fontSize="small" className="shrink-0 opacity-70" />
                                                                            </button>
                                                                        </>
                                                                    ) : null}
                                                                    {isGroupAdmin ? (
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
                                                                    ) : null}
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
                                                                    disabled={(chosenGroupChatDetails?.participants?.length ?? 0) > 1}
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
            <Dialog
                open={callHistoryOpen}
                onClose={() => setCallHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    className: "rounded-2xl border border-slate-200 shadow-xl overflow-hidden",
                }}
            >
                <DialogTitle className="text-[22px] font-bold tracking-tight text-slate-900">
                    Call history
                </DialogTitle>
                <DialogContent dividers className="bg-slate-50/40">
                    {callHistoryLoading ? (
                        <p className="text-sm font-medium text-slate-500">Loading call history...</p>
                    ) : callHistoryRows.length === 0 ? (
                        <p className="text-sm font-medium text-slate-500">No call history yet.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {callHistoryRows.map((row: any) => (
                                <div key={row._id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                    <div className="text-[15px] font-semibold text-slate-900">
                                        {row?.startedBy?.username ? `${row.startedBy.username} started the call` : 'Call'}
                                    </div>
                                    <div className="mt-1.5 text-xs font-medium text-slate-600">
                                        Date: {formatCallDateTime(row.startedAt)}
                                    </div>
                                    <div className="mt-0.5 text-xs font-medium text-slate-600">
                                        Ended: {formatCallDateTime(row.endedAt)}
                                    </div>
                                    <div className="mt-0.5 text-xs font-semibold text-[#234C6A]">
                                        Duration: {formatCallDuration(row.duration)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <button
                        type="button"
                        onClick={() => setCallHistoryOpen(false)}
                        className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-[1.03] active:brightness-95"
                        style={{ background: "linear-gradient(135deg, #234C6A 0%, #456882 100%)" }}
                    >
                        Close
                    </button>
                </DialogActions>
            </Dialog>
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