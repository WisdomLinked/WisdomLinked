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


    const eventId = videoChat.localStream && currentEvent?._id !== undefined ? currentEvent._id : null;

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
                            <FlipCamera
                                localStream={videoChat.localStream}
                                callType="DIRECT CALL"
                            />
                        </>
                    )}
                    <Microphone localStream={videoChat.localStream} />
                    <ResizeRoomButton
                        isRoomMinimized={isRoomMinimized}
                        handleRoomResize={handleRoomResize}
                    />
                    <CloseRoom type="DIRECT CALL"
                               eventId={eventId}
                    />
                </div>
            ) : room.localStreamRoom ? (
                <div className="w-full h-full flex items-center justify-center">
                    {!room.isUserJoinedWithOnlyAudio && (
                        // <ScreenShare room={room} type="ROOM" />
                        <>
                            <ScreenShare room={room} type="ROOM" />
                            <Camera localStream={room.localStreamRoom} />
                            <FlipCamera
                                localStream={room.localStreamRoom}
                                callType="ROOM"
                            />
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
                               eventId
                    />
                </div>
            ) : null}
        </div>
    );
};


export default RoomButtons

