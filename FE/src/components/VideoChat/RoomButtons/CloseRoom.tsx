import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useAppSelector } from "../../../store";
import { clearVideoChat } from "../../../actions/videoChatActions";
import { callRequest, callResponse, cancelCallRequest, notifyChatLeft } from "../../../socket/socketConnection";
import { leaveRoom } from "../../../socket/roomHandler";

type CallType = "DIRECT CALL" | "ROOM"


const CloseRoom = ({ type } : { type: CallType }) => {
    const dispatch = useDispatch();
    const {
        friends: {
            groupChatList
        },
        auth: { userDetails },
        videoChat: { otherUserId, remoteStream  },
        chat: {chosenChatDetails},
        room: {roomDetails}
    } = useAppSelector((state) => state);

    const [expert, set_expert] = useState<any>(null)
    const [isExpertInRoom, set_isExpertInRoom] = useState<any>(null)

    const openFeedbackModal = (otherUserId: any) => {
        dispatch({
            type: "SetFeedbackModalShow",
            payload: otherUserId,
        });
    }

    const handleLeaveRoom = () => {

        // notify other user that I left the call
        if (type === "DIRECT CALL") {

            if(otherUserId) {
                // OPENING FEEDBACK POPUP -----------
                // if (remoteStream) {
                //     openFeedbackModal(otherUserId);
                // }

                notifyChatLeft(otherUserId, remoteStream ? true : false);
            }
            dispatch(clearVideoChat("You left the chat"));
        }

        if(type === "ROOM") {
            // if (userDetails.role !== "expert" && isExpertInRoom) {
            //     // OPENING FEEDBACK POPUP -----------
            //     openFeedbackModal(expert)
            // }
            leaveRoom();
        }
        cancelCallRequest({otherUserId: otherUserId || ''})
    };

    useEffect(() => {
        const groupChat = groupChatList.find(x => x.groupId === roomDetails?.groupId)
        if (groupChat) {
            set_expert(groupChat?.admin?._id)
            set_isExpertInRoom(roomDetails?.participants?.find(x => x.userId === groupChat?.admin?._id))
        }
    }, [roomDetails, groupChatList, userDetails])

    return (
        <button 
            onClick={handleLeaveRoom}
            className="bg-white px-4 py-0.5 text-green rounded-md ml-3 border border-green hover:bg-green hover:border-white hover:text-white"
        >
            {
                type === "DIRECT CALL" ?
                    "Exit" :
                    "Leave"
            }
        </button>        
    );
};

export default CloseRoom;
