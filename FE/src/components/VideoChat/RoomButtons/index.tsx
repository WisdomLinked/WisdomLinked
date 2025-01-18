import React, {useState} from "react";
import Camera from "./Camera";
import Microphone from "./Microphone";
import CloseRoom from "./CloseRoom";
import ScreenShare from "./ScreenShare";
import {useAppSelector} from "../../../store"
import ResizeRoomButton from "../ResizeRoomButton";
import FeedbackForm from "../../FeedbackForm";

const RoomButtons: React.FC<{
    isRoomMinimized: boolean;
    handleRoomResize: () => void;
}> = ({ isRoomMinimized, handleRoomResize }) => {
    const {videoChat, room, chat: { currentEvent }, auth: { userDetails }} = useAppSelector((state) => state);

    // State for showing/hiding feedback form
    const [showFeedback, setShowFeedback] = useState(false);

    // Determine the feedback ID and type
    const feedbackId = videoChat.localStream && currentEvent?._id
        ? currentEvent._id // Direct call
        : room.localStreamRoom && room.roomDetails?.groupId
            ? room.roomDetails.groupId // Room call
            : "";

    const feedbackType: "event" | "groupchat" = videoChat.localStream && currentEvent?._id
        ? "event"
        : "groupchat";

    return (
        <div className={`w-[100%] h-[50px] bg-green flex items-center justify-center`}>
            {videoChat.localStream ? (
                <div className="w-full h-full flex items-center justify-center">
                    {!videoChat.audioOnly && (
                        <>
                            <ScreenShare
                                videoChat={videoChat}
                                type="DIRECT CALL"
                            />
                            <Camera localStream={videoChat.localStream} />
                        </>
                    )}
                    <Microphone localStream={videoChat.localStream} />
                    <ResizeRoomButton
                        isRoomMinimized={isRoomMinimized}
                        handleRoomResize={handleRoomResize}
                    />
                    <CloseRoom type="DIRECT CALL" />
                    {feedbackId && (
                        <>
                            <button
                                className="mx-1 py-0.5 px-2 text-xs rounded bg-midgrey-2 text-white hover:bg-midgrey-3"
                                onClick={() => setShowFeedback(true)}
                            >
                                Feedback
                            </button>
                            {showFeedback && (
                                <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black/70 z-50">
                                    <FeedbackForm
                                        _id={feedbackId}
                                        type={feedbackType}
                                        userId={userDetails.userId}
                                        role={userDetails.role}
                                        onClose={() => setShowFeedback(false)}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : room.localStreamRoom ? (
                <div className="w-full h-full flex items-center justify-center">
                    {!room.isUserJoinedWithOnlyAudio && (
                        <ScreenShare room={room} type="ROOM" />
                    )}
                    <Microphone localStream={room.localStreamRoom} />
                    {!room.isUserJoinedWithOnlyAudio && (
                        <Camera localStream={room.localStreamRoom} />
                    )}
                    <ResizeRoomButton
                        isRoomMinimized={isRoomMinimized}
                        handleRoomResize={handleRoomResize}
                    />
                    <CloseRoom type="ROOM" />
                    {feedbackId && (
                        <>
                            <button
                                className="mx-1 py-0.5 px-2 text-xs rounded bg-midgrey-2 text-white hover:bg-midgrey-3"
                                onClick={() => setShowFeedback(true)}
                            >
                                Feedback
                            </button>
                            {showFeedback && (
                                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/50 z-50">
                                    <FeedbackForm
                                        _id={feedbackId}
                                        type={feedbackType}
                                        userId={userDetails.userId}
                                        role={userDetails.role}
                                        onClose={() => setShowFeedback(false)}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
};


export default RoomButtons

