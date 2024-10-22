import React from "react";
import Camera from "./Camera";
import Microphone from "./Microphone";
import CloseRoom from "./CloseRoom";
import ScreenShare from "./ScreenShare";
import {useAppSelector} from "../../../store"
import ResizeRoomButton from "../ResizeRoomButton";

const RoomButtons: React.FC<{
    isRoomMinimized: boolean;
    handleRoomResize: () => void;
}> = ({ isRoomMinimized, handleRoomResize }) => {
    const {videoChat, room} = useAppSelector((state) => state);

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
                </div>
            ) : null}
        </div>
    );
};


export default RoomButtons

