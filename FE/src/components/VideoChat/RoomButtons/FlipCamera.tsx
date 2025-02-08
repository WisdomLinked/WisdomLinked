import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import { useAppSelector } from "../../../store";

const FlipCamera: React.FC<{ localStream: MediaStream }> = ({ localStream }) => {
    // This state tracks whether we're currently using the front camera or not
    const [usingFrontCamera, setUsingFrontCamera] = useState(true);

    // Pull localVideoEnabled from Redux to check if the camera is on/off
    const { videoChat: { localVideoEnabled } } = useAppSelector((state) => state);

    // Check if the user agent is mobile-ish
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // Flip camera front <-> back
    const handleSwitchCamera = async () => {
        try {
            // 1) Stop current video tracks
            localStream.getVideoTracks().forEach((track) => track.stop());

            // 2) Request a new track using the opposite facingMode
            const newFacingMode = usingFrontCamera ? "environment" : "user";
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: localStream.getAudioTracks().length > 0, // Keep any existing audio
            });

            // 3) Replace the old track in our localStream
            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldVideoTrack = localStream.getVideoTracks()[0];
            if (oldVideoTrack) localStream.removeTrack(oldVideoTrack);
            localStream.addTrack(newVideoTrack);

            setUsingFrontCamera(!usingFrontCamera);
        } catch (err) {
            console.error("Error switching camera:", err);
        }
    };

    // Hide this button if device is not mobile or if camera is disabled
    if (!isMobileDevice || !localVideoEnabled) return null;

    return (
        <IconButton onClick={handleSwitchCamera} style={{ color: "white" }}>
            <FlipCameraIosIcon />
        </IconButton>
    );
};

export default FlipCamera;