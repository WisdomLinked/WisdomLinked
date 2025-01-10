import React, { useEffect, useState } from "react";
import IconButton from "@mui/material/IconButton";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import { useAppSelector } from "../../../store";
import { useDispatch } from "react-redux";
import { setVideoAudioStatus } from "../../../actions/videoChatActions";
import { setAudioStatusInRoom } from "../../../socket/socketConnection";

const Microphone: React.FC<{
    localStream: MediaStream;
}> = ({localStream}) => {

    const dispatch = useDispatch();
    const {
        app: { audioStreamAvailable },
        auth: {userDetails},
        room: { roomDetails },
        videoChat: { localVideoEnabled, localAudioEnabled, forceMuted  },
    } = useAppSelector((state) => state);

    const handleToggleMic = () => {
        if (!forceMuted && localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                dispatch(setVideoAudioStatus(localVideoEnabled, audioTrack.enabled, true));
            }
        }
    };

    useEffect(() => {
        if (forceMuted) {
            localStream.getAudioTracks().forEach((track) => track.enabled = false);
            dispatch(setVideoAudioStatus(localVideoEnabled, false, true))
            setAudioStatusInRoom({
                customerId: userDetails.userId,
                roomId: roomDetails?.roomId,
                audioStatus: false
            })
        }
    }, [forceMuted])

    return (
        <button
            onClick={handleToggleMic}
            className="text-white disabled:opacity-50"
            disabled={forceMuted || !audioStreamAvailable}
        >
            {localAudioEnabled ? <MicIcon /> : <MicOffIcon />}
        </button>
    );
};

export default Microphone;
