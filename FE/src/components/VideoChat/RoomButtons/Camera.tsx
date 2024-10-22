import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import { useAppSelector } from "../../../store";
import { useDispatch } from "react-redux";
import { setVideoAudioStatus } from "../../../actions/videoChatActions";

const Camera: React.FC<{
    localStream: MediaStream;
}> = ({localStream}) => {

    const dispatch = useDispatch();
    const {
        videoChat: { localVideoEnabled, localAudioEnabled  },
    } = useAppSelector((state) => state);
    // const [cameraEnabled, setCameraEnabled] = useState(true);

    const handleToggleCamera = () => {
        localStream.getVideoTracks().forEach((track) => track.enabled = !track.enabled);
        dispatch(setVideoAudioStatus(!localVideoEnabled, localAudioEnabled, true))
    };

    return (
        <IconButton onClick={handleToggleCamera} style={{ color: "white" }}>
            {localVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
        </IconButton>
    );
};

export default Camera;
