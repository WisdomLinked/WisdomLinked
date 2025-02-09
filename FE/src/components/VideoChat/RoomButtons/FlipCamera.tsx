// import React, { useState } from "react";
// import IconButton from "@mui/material/IconButton";
// import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
// import { useDispatch } from "react-redux";
// // NOTE: We import both setLocalStream (direct call) and setLocalStreamRoom (room)
// import { setLocalStream } from "../../../actions/videoChatActions";
// import { setLocalStreamRoom } from "../../../actions/roomActions";
// import { currentPeerConnection } from "../../../socket/socketConnection";
// import { switchOutgoingTracks } from "../../../socket/webRTC";
//
// type CallType = "DIRECT CALL" | "ROOM";
//
// const FlipCamera: React.FC<{
//     localStream: MediaStream;
//     callType: CallType;
// }> = ({ localStream, callType }) => {
//     const dispatch = useDispatch();
//     const [usingFrontCamera, setUsingFrontCamera] = useState(true);
//
//     // Simple mobile check
//     const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
//         navigator.userAgent
//     );
//
//     // Hide the flip button if not mobile or no localStream
//     if (!isMobileDevice || !localStream) {
//         return null;
//     }
//
//     const handleSwitchCamera = async () => {
//         console.log("[FlipCamera] Toggling camera...");
//
//         try {
//             // 1) Stop old video tracks (but keep audio tracks)
//             localStream.getVideoTracks().forEach(track => track.stop());
//
//             // 2) Get new camera track with opposite facingMode
//             const newFacingMode = usingFrontCamera ? "environment" : "user";
//             const newStream = await navigator.mediaDevices.getUserMedia({
//                 video: { facingMode: newFacingMode },
//                 audio: localStream.getAudioTracks().length > 0
//             });
//
//             // 3) Combine new video track with existing audio track(s)
//             const combinedStream = new MediaStream([
//                 ...newStream.getVideoTracks(),
//                 ...localStream.getAudioTracks()
//             ]);
//
//             // 4) Replace the old track in the peer connection
//             if (callType === "DIRECT CALL") {
//                 console.log("[FlipCamera] Replacing track in direct call...");
//                 currentPeerConnection?.replaceTrack(
//                     currentPeerConnection.streams[0].getVideoTracks()[0],
//                     newStream.getVideoTracks()[0],
//                     currentPeerConnection.streams[0]
//                 );
//             } else {
//                 console.log("[FlipCamera] Switching outgoing tracks for room...");
//                 switchOutgoingTracks(combinedStream);
//             }
//
//             // 5) Update Redux so the UI & code sees the new local stream
//             //    (direct call => setLocalStream, room => setLocalStreamRoom)
//             if (callType === "DIRECT CALL") {
//                 dispatch(setLocalStream(combinedStream));
//             } else {
//                 dispatch(setLocalStreamRoom(combinedStream));
//             }
//
//             // 6) Toggle camera state
//             setUsingFrontCamera(!usingFrontCamera);
//
//             console.log("[FlipCamera] Camera flipped successfully!");
//         } catch (err) {
//             console.error("[FlipCamera] Error switching camera:", err);
//         }
//     };
//
//     return (
//         <IconButton onClick={handleSwitchCamera} style={{ color: "white" }}>
//             <FlipCameraIosIcon />
//         </IconButton>
//     );
// };
//
// export default FlipCamera;

import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import FlipCameraIosIcon from "@mui/icons-material/FlipCameraIos";
import { useAppSelector } from "../../../store";
// If you need to dispatch the new local stream to Redux
import { useDispatch } from "react-redux";
import { setLocalStream } from "../../../actions/videoChatActions";
import { setLocalStreamRoom } from "../../../actions/roomActions";
// If you're using direct calls, you'll use currentPeerConnection
// For rooms, you'll use switchOutgoingTracks
import { currentPeerConnection } from "../../../socket/socketConnection";
import { switchOutgoingTracks } from "../../../socket/webRTC";

type CallType = "DIRECT CALL" | "ROOM";

interface FlipCameraProps {
    localStream: MediaStream;
    callType?: CallType;
    // callType is optional—if you only do direct calls, you can omit it.
    // If you want both direct calls & rooms, pass "DIRECT CALL" or "ROOM".
}

const FlipCamera: React.FC<FlipCameraProps> = ({
                                                   localStream,
                                                   callType = "DIRECT CALL", // default to direct calls
                                               }) => {
    // Track whether we’re using the front or rear camera
    const [usingFrontCamera, setUsingFrontCamera] = useState(true);

    // Check if camera is currently enabled (for hiding button when camera is off)
    const { videoChat: { localVideoEnabled } } = useAppSelector(state => state);

    // Basic mobile detection
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // We may need to update Redux with the new local stream
    const dispatch = useDispatch();

    // Hide button if:
    //  1) Not a mobile device, or
    //  2) localVideoEnabled === false, or
    //  3) No localStream
    if (!isMobileDevice || !localVideoEnabled || !localStream) {
        return null;
    }

    const handleSwitchCamera = async () => {
        console.log("[FlipCamera] Attempting to flip camera...");

        try {
            // STEP 1) Identify the old camera track
            // (Don’t remove it from localStream yet, so the remote side won’t go black)
            const oldVideoTrack = localStream.getVideoTracks()[0];
            console.log("[FlipCamera] oldVideoTrack label:", oldVideoTrack?.label);

            // STEP 2) Acquire a new camera track with the opposite facingMode
            const newFacingMode = usingFrontCamera ? "environment" : "user";
            console.log("[FlipCamera] newFacingMode:", newFacingMode);

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: localStream.getAudioTracks().length > 0, // preserve current audio
            });
            const newVideoTrack = newStream.getVideoTracks()[0];

            if (!newVideoTrack) {
                console.log("[FlipCamera] Couldn’t obtain newVideoTrack");
                return;
            }
            console.log("[FlipCamera] newVideoTrack label:", newVideoTrack.label);

            // STEP 3) Create a “combined” stream that merges the new video track
            //         with any existing audio track(s) from localStream
            const combinedStream = new MediaStream([
                newVideoTrack,
                ...localStream.getAudioTracks(),
            ]);

            // STEP 4) Update the WebRTC peer connection
            // DIRECT CALL => replaceTrack with currentPeerConnection
            // ROOM => call switchOutgoingTracks
            if (callType === "DIRECT CALL") {
                console.log("[FlipCamera] Replacing track in direct call...");
                if (oldVideoTrack && currentPeerConnection) {
                    currentPeerConnection.replaceTrack(
                        oldVideoTrack,            // track to remove
                        newVideoTrack,           // track to add
                        currentPeerConnection.streams[0] // existing stream in the peer
                    );
                }
            } else {
                console.log("[FlipCamera] Switching outgoing tracks in a room...");
                switchOutgoingTracks(combinedStream);
            }

            // STEP 5) Now that the remote side is receiving the new track,
            //         we can safely remove/stop the old track from localStream
            if (oldVideoTrack) {
                oldVideoTrack.stop();
                localStream.removeTrack(oldVideoTrack);
                console.log("[FlipCamera] old track removed/stopped");
            }

            // STEP 6) Add the new track to the localStream
            localStream.addTrack(newVideoTrack);
            console.log("[FlipCamera] new track added to localStream");

            // STEP 7) (Optional) If your Redux store or UI depends on the local stream,
            //         dispatch the updated “combinedStream”
            if (callType === "DIRECT CALL") {
                dispatch(setLocalStream(combinedStream));
            } else {
                dispatch(setLocalStreamRoom(combinedStream));
            }

            // STEP 8) Toggle the front/rear state for next time
            setUsingFrontCamera(!usingFrontCamera);

            console.log("[FlipCamera] Successfully flipped camera!");
        } catch (err) {
            console.error("[FlipCamera] Error flipping camera:", err);
        }
    };

    return (
        <IconButton onClick={handleSwitchCamera} style={{ color: "white" }}>
            <FlipCameraIosIcon />
        </IconButton>
    );
};

export default FlipCamera;
