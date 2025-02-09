import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import { useAppSelector } from "../../../store";
import { currentPeerConnection } from "../../../socket/socketConnection";
import { switchOutgoingTracks } from "../../../socket/webRTC";

type CallType = "DIRECT CALL" | "ROOM";

const FlipCamera: React.FC<{
    localStream: MediaStream;
    callType: CallType;
}> = ({ localStream, callType }) => {
    const [usingFrontCamera, setUsingFrontCamera] = useState(true);

    const {
        videoChat: { localVideoEnabled },
    } = useAppSelector((state) => state);

    // Quick user-agent check for mobile
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // Handle flipping camera
    const handleSwitchCamera = async () => {
        try {
            // Step 1) Identify the old camera track (don’t stop it yet).
            const oldTrack = localStream.getVideoTracks()[0];

            // Step 2) Request a new track with opposite facingMode.
            const newFacingMode = usingFrontCamera ? "environment" : "user";
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: localStream.getAudioTracks().length > 0,
            });
            const newVideoTrack = newStream.getVideoTracks()[0];

            // Step 3) Create a combined stream with new video + any existing audio from localStream.
            const combinedStream = new MediaStream([
                ...newStream.getVideoTracks(),
                ...localStream.getAudioTracks(),
            ]);

            // Step 4) Update the peer connection so the remote side sees the flipped camera immediately.
            if (callType === "DIRECT CALL") {
                if (oldTrack && currentPeerConnection) {
                    currentPeerConnection.replaceTrack(
                        oldTrack,
                        newVideoTrack,
                        currentPeerConnection.streams[0]
                    );
                }
            } else {
                // For rooms, reuse the "switchOutgoingTracks" approach
                switchOutgoingTracks(combinedStream);
            }

            // Step 5) Now safely remove & stop the old track from localStream
            if (oldTrack) {
                oldTrack.stop(); // stop old camera
                localStream.removeTrack(oldTrack);
            }
            // Add the new video track to localStream
            localStream.addTrack(newVideoTrack);

            // Flip local boolean
            setUsingFrontCamera(!usingFrontCamera);
        } catch (err) {
            console.error("Error switching camera:", err);
        }
    };

    // Hide button if not mobile, or camera is disabled, or no localStream
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
