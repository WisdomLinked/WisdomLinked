import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import { useDispatch } from "react-redux";
// NOTE: We import both setLocalStream (direct call) and setLocalStreamRoom (room)
import { setLocalStream } from "../../../actions/videoChatActions";
import { setLocalStreamRoom } from "../../../actions/roomActions";
import { currentPeerConnection } from "../../../socket/socketConnection";
import { switchOutgoingTracks } from "../../../socket/webRTC";

type CallType = "DIRECT CALL" | "ROOM";

const FlipCamera: React.FC<{
    localStream: MediaStream;
    callType: CallType;
}> = ({ localStream, callType }) => {
    const dispatch = useDispatch();
    const [usingFrontCamera, setUsingFrontCamera] = useState(true);

    // Simple mobile check
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // Hide the flip button if not mobile or no localStream
    if (!isMobileDevice || !localStream) {
        return null;
    }

    const handleSwitchCamera = async () => {
        console.log("[FlipCamera] Toggling camera...");

        try {
            // 1) Stop old video tracks (but keep audio tracks)
            localStream.getVideoTracks().forEach(track => track.stop());

            // 2) Get new camera track with opposite facingMode
            const newFacingMode = usingFrontCamera ? "environment" : "user";
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: localStream.getAudioTracks().length > 0
            });

            // 3) Combine new video track with existing audio track(s)
            const combinedStream = new MediaStream([
                ...newStream.getVideoTracks(),
                ...localStream.getAudioTracks()
            ]);

            // 4) Replace the old track in the peer connection
            if (callType === "DIRECT CALL") {
                console.log("[FlipCamera] Replacing track in direct call...");
                currentPeerConnection?.replaceTrack(
                    currentPeerConnection.streams[0].getVideoTracks()[0],
                    newStream.getVideoTracks()[0],
                    currentPeerConnection.streams[0]
                );
            } else {
                console.log("[FlipCamera] Switching outgoing tracks for room...");
                switchOutgoingTracks(combinedStream);
            }

            // 5) Update Redux so the UI & code sees the new local stream
            //    (direct call => setLocalStream, room => setLocalStreamRoom)
            if (callType === "DIRECT CALL") {
                dispatch(setLocalStream(combinedStream));
            } else {
                dispatch(setLocalStreamRoom(combinedStream));
            }

            // 6) Toggle camera state
            setUsingFrontCamera(!usingFrontCamera);

            console.log("[FlipCamera] Camera flipped successfully!");
        } catch (err) {
            console.error("[FlipCamera] Error switching camera:", err);
        }
    };

    return (
        <IconButton onClick={handleSwitchCamera} style={{ color: "white" }}>
            <FlipCameraIosIcon />
        </IconButton>
    );
};

export default FlipCamera;
