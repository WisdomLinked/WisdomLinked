// import React, { useEffect, useState } from "react";
// import { useDispatch } from "react-redux";
// import IconButton from "@mui/material/IconButton";
// import CloseIcon from "@mui/icons-material/Close";
// import { useAppSelector } from "../../../store";
// import { clearVideoChat } from "../../../actions/videoChatActions";
// import { callRequest, callResponse, cancelCallRequest, notifyChatLeft } from "../../../socket/socketConnection";
// import { leaveRoom } from "../../../socket/roomHandler";
// import {doUpdateExpertEvent} from "../../../api/api";
//
// type CallType = "DIRECT CALL" | "ROOM"
//
// const CloseRoom = ({ type, eventId } : { type: CallType, eventId: any}) => {
//     const dispatch = useDispatch();
//     const {
//         friends: {
//             groupChatList
//         },
//         auth: { userDetails },
//         videoChat: { otherUserId, remoteStream  },
//         chat: {chosenChatDetails},
//         room: {roomDetails}
//     } = useAppSelector((state) => state);
//
//     const [expert, set_expert] = useState<any>(null)
//     const [isExpertInRoom, set_isExpertInRoom] = useState<any>(null)
//
//     const openFeedbackModal = (otherUserId: any) => {
//         dispatch({
//             type: "SetFeedbackModalShow",
//             payload: otherUserId,
//         });
//     }
//
//     const handleLeaveRoom = async () => {
//         // notify other user that I left the call
//         if (type === "DIRECT CALL") {
//             if(otherUserId) {
//                 // OPENING FEEDBACK POPUP -----------
//                 // if (remoteStream) {
//                 //     openFeedbackModal(otherUserId);
//                 // }
//
//                 notifyChatLeft(otherUserId, remoteStream ? true : false);
//             }
//
//             if (userDetails.role === 'expert' && eventId) {
//                 const timeSpent = localStorage.getItem('totalTimeSpent');
//
//                 if (timeSpent) {
//                     // Convert timeSpent to a number before using it
//                     const parsedTimeSpent = parseInt(timeSpent, 10);
//                     const totalTimeSpent = Date.now() - parsedTimeSpent;
//                     const totalTimeSpentInMinutes = Math.floor(totalTimeSpent / 60000);
//
//                     // Update the totalTimeSpent API
//                     await doUpdateExpertEvent(eventId, { totalTimeSpent :totalTimeSpentInMinutes });
//                     localStorage.removeItem('totalTimeSpent');
//                 } else {
//                     console.error('Time spent data is missing in localStorage.');
//                 }
//             }
//
//             dispatch(clearVideoChat("You left the chat"));
//         }
//
//         if(type === "ROOM") {
//             // if (userDetails.role !== "expert" && isExpertInRoom) {
//             //     // OPENING FEEDBACK POPUP -----------
//             //     openFeedbackModal(expert)
//             // }
//             leaveRoom();
//         }
//         cancelCallRequest({otherUserId: otherUserId || ''})
//     };
//
//     useEffect(() => {
//         const groupChat = groupChatList.find(x => x.groupId === roomDetails?.groupId)
//         if (groupChat) {
//             set_expert(groupChat?.admin?._id)
//             set_isExpertInRoom(roomDetails?.participants?.find(x => x.userId === groupChat?.admin?._id))
//         }
//     }, [roomDetails, groupChatList, userDetails])
//
//     return (
//         <button
//             onClick={handleLeaveRoom}
//             className="bg-white px-4 py-0.5 text-green rounded-md ml-3 border border-green hover:bg-green hover:border-white hover:text-white"
//         >
//             {
//                 type === "DIRECT CALL" ?
//                     "Exit" :
//                     "Leave"
//             }
//         </button>
//     );
// };
//
// export default CloseRoom;

import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useAppSelector } from "../../../store";
import { clearVideoChat } from "../../../actions/videoChatActions";
import { callRequest, callResponse, cancelCallRequest, notifyChatLeft } from "../../../socket/socketConnection";
import { leaveRoom } from "../../../socket/roomHandler";
import { doUpdateExpertEvent } from "../../../api/api";

type CallType = "DIRECT CALL" | "ROOM";

const CloseRoom = ({ type, eventId, setShowFeedback, showFeedback }: { type: CallType; eventId: any; setShowFeedback: Function; showFeedback: any }) => {
    const dispatch = useDispatch();
    const {
        friends: { groupChatList },
        auth: { userDetails },
        videoChat: { otherUserId, remoteStream },
        chat: { chosenChatDetails },
        room: { roomDetails },
    } = useAppSelector((state) => state);

    const [expert, set_expert] = useState<any>(null);
    const [isExpertInRoom, set_isExpertInRoom] = useState<any>(null);

    const openFeedbackModal = (otherUserId: any) => {
        dispatch({
            type: "SetFeedbackModalShow",
            payload: otherUserId,
        });
    };

    const calculateTotalTime = async () => {
        if (userDetails.role === "expert" && eventId) {
            const timeSpent = localStorage.getItem("totalTimeSpent");

            if (timeSpent) {
                const parsedTimeSpent = parseInt(timeSpent, 10);
                const totalTimeSpent = Date.now() - parsedTimeSpent;
                const totalTimeSpentInMinutes = Math.floor(totalTimeSpent / 60000);

                await doUpdateExpertEvent(eventId, { totalTimeSpent: totalTimeSpentInMinutes });
                localStorage.removeItem("totalTimeSpent");
            } else {
                console.error("Time spent data is missing in localStorage.");
            }
        }
    };

    const handleFeedback = async () => {
        // Show feedback modal
        setShowFeedback('true');
    };

    const handleLeaveRoom = async () => {
        // Notify the other user that the call is being left
        if (type === "DIRECT CALL") {
            if (otherUserId) {
                notifyChatLeft(otherUserId, remoteStream ? true : false);
            }

            await calculateTotalTime(); // Update the total time spent

            dispatch(clearVideoChat("You left the chat"));
        }

        if (type === "ROOM") {
            leaveRoom(); // Handle leaving the room
        }

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

        // Only call handleLeaveRoom when feedback is completed
        if (showFeedback === 'false') {
            handleLeaveRoom(); // Proceed with call exit after feedback is completed
        }
    }, [roomDetails, groupChatList, userDetails, showFeedback]);

    return (
        <button
            onClick={handleFeedback}
            className="bg-white px-4 py-0.5 text-green rounded-md ml-3 border border-green hover:bg-green hover:border-white hover:text-white"
        >
            {type === "DIRECT CALL" ? "Exit" : "Leave"}
        </button>
    );
};

export default CloseRoom;
