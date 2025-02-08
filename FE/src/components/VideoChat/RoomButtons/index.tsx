import React, {useState} from "react";
import Camera from "./Camera";
import Microphone from "./Microphone";
import CloseRoom from "./CloseRoom";
import ScreenShare from "./ScreenShare";
import {useAppSelector} from "../../../store"
import ResizeRoomButton from "../ResizeRoomButton";
import FlipCamera from "./FlipCamera";

const RoomButtons: React.FC<{
    isRoomMinimized: boolean;
    handleRoomResize: () => void;
}> = ({ isRoomMinimized, handleRoomResize }) => {
    const {videoChat, room, chat: { currentEvent }, auth: { userDetails }} = useAppSelector((state) => state);

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
                            <FlipCamera localStream={videoChat.localStream} />
                        </>
                    )}
                    <Microphone localStream={videoChat.localStream} />
                    <ResizeRoomButton
                        isRoomMinimized={isRoomMinimized}
                        handleRoomResize={handleRoomResize}
                    />
                    <CloseRoom type="DIRECT CALL"
                               eventId={feedbackId}
                    />
                </div>
            ) : room.localStreamRoom ? (
                <div className="w-full h-full flex items-center justify-center">
                    {!room.isUserJoinedWithOnlyAudio && (
                        // <ScreenShare room={room} type="ROOM" />
                        <>
                            <ScreenShare room={room} type="ROOM" />
                            <Camera localStream={room.localStreamRoom} />
                            <FlipCamera localStream={room.localStreamRoom} />
                        </>
                    )}
                    <Microphone localStream={room.localStreamRoom} />
                    {!room.isUserJoinedWithOnlyAudio && (
                        <Camera localStream={room.localStreamRoom} />
                    )}
                    <ResizeRoomButton
                        isRoomMinimized={isRoomMinimized}
                        handleRoomResize={handleRoomResize}
                    />
                    <CloseRoom type="ROOM"
                               eventId={feedbackId}
                    />
                </div>
            ) : null}
        </div>
    );
};


export default RoomButtons

