import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import { useAppSelector } from "../../../store";
// Import these to perform track replacement
import { currentPeerConnection } from "../../../socket/socketConnection";
import { switchOutgoingTracks } from "../../../socket/webRTC";

type CallType = "DIRECT CALL" | "ROOM";

const FlipCamera: React.FC<{
    localStream: MediaStream;
    callType: CallType;
}> = ({ localStream, callType }) => {
    // Tracks front/back camera usage
    const [usingFrontCamera, setUsingFrontCamera] = useState(true);

    // From Redux, check if local camera is currently enabled
    const {
        videoChat: { localVideoEnabled },
    } = useAppSelector((state) => state);

    // Detect a “mobile” environment using user agent (adjust if you prefer a more robust check)
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // Flip camera
    const handleSwitchCamera = async () => {
        try {
            // 1) Stop the current local video tracks
            localStream.getVideoTracks().forEach((track) => track.stop());

            // 2) Request new track with opposite facingMode
            const newFacingMode = usingFrontCamera ? "environment" : "user";
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: localStream.getAudioTracks().length > 0,
            });

            // 3) Replace old track in localStream with the new track
            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldTrack = localStream.getVideoTracks()[0];
            if (oldTrack) localStream.removeTrack(oldTrack);
            localStream.addTrack(newVideoTrack);

            // 4) For remote side to see updated video, we must replace the track in the peer connection
            if (callType === "DIRECT CALL") {
                // For direct calls, do the same as screen sharing logic: replace track
                currentPeerConnection?.replaceTrack(
                    currentPeerConnection.streams[0].getVideoTracks()[0],
                    newVideoTrack,
                    currentPeerConnection.streams[0]
                );
            } else {
                // For a ROOM call, we use the existing method that updates outbound track
                switchOutgoingTracks(localStream);
            }

            // Toggle camera mode
            setUsingFrontCamera(!usingFrontCamera);
        } catch (err) {
            console.error("Error switching camera:", err);
        }
    };

    // Hide the flip button if:
    //  (1) not on mobile, or (2) camera is disabled, or (3) there's no localStream
    if (!isMobileDevice || !localVideoEnabled || !localStream) {
        return null;
    }

    return (
        <IconButton onClick={handleSwitchCamera} style={{ color: "white" }}>
            <FlipCameraIosIcon />
        </IconButton>
    );
};

export default FlipCamera;
