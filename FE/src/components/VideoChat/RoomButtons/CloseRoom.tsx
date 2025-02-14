import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useAppSelector } from "../../../store";
import { clearVideoChat } from "../../../actions/videoChatActions";
import {
    callRequest,
    callResponse,
    cancelCallRequest,
    notifyChatLeft,
    sendDirectMessage, sendGroupMessage
} from "../../../socket/socketConnection";
import { leaveRoom } from "../../../socket/roomHandler";
import {doUpdateExpertEvent, updateGroupChat} from "../../../api/api";

type CallType = "DIRECT CALL" | "ROOM";

const CloseRoom = ({ type, eventId = null}: { type: CallType; eventId: any;}) => {
    const dispatch = useDispatch();
    const {
        friends: { groupChatList },
        auth: { userDetails },
        videoChat: { otherUserId, remoteStream },
        chat: { chosenChatDetails, chosenGroupChatDetails },
        room: { roomDetails},
    } = useAppSelector((state) => state);

    const [expert, set_expert] = useState<any>(null);
    const [isExpertInRoom, set_isExpertInRoom] = useState<any>(null);

    const openFeedbackModal = (otherUserId: any) => {
        console.log("feedback",roomDetails)
        dispatch({
            type: "SetFeedbackModalShow",
            payload: otherUserId,
        });
    };

    const calculateTotalTime = async () => {
        if (userDetails.role === "expert" && eventId || chosenGroupChatDetails) {
            const timeSpent = localStorage.getItem("totalTimeSpent");

            if (timeSpent) {
                const parsedTimeSpent = parseInt(timeSpent, 10);
                const totalTimeSpent = Date.now() - parsedTimeSpent;
                const totalTimeSpentInMinutes = Math.floor(totalTimeSpent / 60000);

                if (chosenChatDetails) {
                    eventId && await doUpdateExpertEvent(eventId, { totalTimeSpent: totalTimeSpentInMinutes });

                    const message = `Call Lasted for: ${totalTimeSpent / 1000} seconds`;
                    console.log("Sending direct message...");
                    console.log("Receiver User ID:", chosenChatDetails.userId);
                    sendDirectMessage({
                        message,
                        receiverUserId: chosenChatDetails.userId!,
                    });
                }

                // console.log("chosengroupchatdetails", chosenGroupChatDetails, groupChatId);
                // console.log("event id", eventId);
                if (chosenGroupChatDetails) {
                    await updateGroupChat({groupId : chosenGroupChatDetails.groupId, totalTimeSpent: totalTimeSpentInMinutes });

                    console.log("Sending group message...");

                    console.log("Group Chat ID:", chosenGroupChatDetails.groupId);

                    const message = `Seminar Lasted for: ${totalTimeSpent / 1000} seconds`;
                    sendGroupMessage({
                        message,
                        groupChatId: chosenGroupChatDetails.groupId,
                    });
                }

                localStorage.removeItem("totalTimeSpent");
            } else {
                console.error("Time spent data is missing in localStorage.");
            }
        }
    };

    const handleLeaveRoom = async () => {
        // Notify the other user that the call is being left

        await calculateTotalTime();

        if (type === "DIRECT CALL") {
            if (otherUserId) {
                notifyChatLeft(otherUserId, remoteStream ? true : false);
            }

            dispatch(clearVideoChat("You left the chat"));
            openFeedbackModal(otherUserId)
        }

        if (type === "ROOM") {
            console.log("userDetail: ", userDetails);
            console.log("chosengroupchatdetails: ", chosenGroupChatDetails);
            leaveRoom(); // Handle leaving the room
            // openFeedbackModal(roomDetails?.roomCreator?.userId)

            dispatch(clearVideoChat("You left the Seminar"));
            if (userDetails.userId !== chosenGroupChatDetails?.admin._id) {
                // openFeedbackModal(roomDetails?.roomCreator?.userId);
                openFeedbackModal(chosenGroupChatDetails?.admin._id);
            } else {
                console.log("User is the room admin. Feedback modal not shown.");
            }
        }


        //TODO: dispatch totaltime call duration



        // Cancel the call request after feedback is completed
        cancelCallRequest({ otherUserId: otherUserId || "" });
    };

    useEffect(() => {
        // Set expert information from group chat data
        const groupChat = groupChatList.find((x) => x.groupId === roomDetails?.groupId);
        if (groupChat) {
            set_expert(groupChat?.admin?._id);
            set_isExpertInRoom(roomDetails?.participants?.find((x) => x.userId === groupChat?.admin?._id));
        }

    }, [roomDetails, groupChatList, userDetails]);

    return (
        <button
            onClick={handleLeaveRoom}
            className="bg-white px-4 py-0.5 text-green rounded-md ml-3 border border-green hover:bg-green hover:border-white hover:text-white"
        >
            {type === "DIRECT CALL" ? "Exit" : "Leave"}
        </button>
    );
};

export default CloseRoom;
