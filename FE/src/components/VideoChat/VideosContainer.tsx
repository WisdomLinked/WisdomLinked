import React, {useEffect, useRef, useState} from "react";
import Video from "./Video";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../store"
import { clearVideoChat } from "../../actions/videoChatActions";
import { forceMuteCustomerFromRoom, enableAudioCustomerFromRoom, kickCustomerFromRoom, notifyChatLeft } from "../../socket/socketConnection";
import { leaveRoom } from "../../socket/roomHandler";
import { getAvatarTitle } from "../../actions/common";
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

const RoomVideo = ({
                       isRoomMinimized,
                       stream,
                       inExpert,
                   }: any) => {

    const [isExpert, set_isExpert] = useState(false)

    const {
        friends: {
            groupChatList
        },
        room: {
            roomDetails,
        }
    } = useAppSelector((state) => state);

    const [maximized, set_maximized] = useState(false)

    const forceMuteCustomer = (e: any) => {
        e.stopPropagation()
        forceMuteCustomerFromRoom({ customerId: stream.userInfo._id, roomId: roomDetails?.roomId })
    }

    const enableAudioCustomer = (e: any) => {
        e.stopPropagation()
        enableAudioCustomerFromRoom({ customerId: stream.userInfo._id, roomId: roomDetails?.roomId })
    }

    const kickOffCustomer = (e: any) => {
        e.stopPropagation()
        kickCustomerFromRoom({ customerId: stream.userInfo._id, roomId: roomDetails?.roomId })
    }

    useEffect(() => {
        const groupChat = groupChatList.find(x => x.groupId === roomDetails?.groupId)
        if (groupChat) {
            set_isExpert(groupChat?.admin?._id === stream?.userInfo?._id)
        }
    }, [roomDetails, stream, groupChatList])

    return (
        <div className={`${maximized ? 'absolute w-full h-full top-0 left-0 z-[200]' : isRoomMinimized ? 'basis-full relative' : 'basis-full sm:basis-1/2 md:basis-full lg:basis-1/2 xl:basis-1/3 relative'} p-2`}>
            <div
                className={`${maximized ? 'w-full h-full' : 'hover:scale-105 transition-all w-full pt-[75%] rounded-lg relative'} bg-midgrey-1 transition-all cursor-pointer`}
                title={maximized ? 'Exit from full screen mode' : 'View in full screen'}
                onClick={() => set_maximized(!maximized)}
            >
                <div className={`${maximized ? '' : 'absolute top-0 left-0'} w-full h-full`}>
                    <Video
                        stream={stream.stream}
                        isLocalStream={false}
                        remoteRoomStream={true}
                        selfMuted={stream.selfMuted}
                        avatarTitle={getAvatarTitle(stream?.userInfo?.username || '')}
                    />
                </div>
                {
                    isExpert &&
                    <div className="absolute bottom-2 left-2 bg-green rounded-full px-1 py-0.5 text-sm text-white">Expert</div>
                }
                <div className="absolute top-1 left-0 w-full flex justify-center text-lightgrey">
                    {stream?.userInfo?.username}
                </div>
                <div className={`absolute left-8 -top-1 text-red text-[30px] ${stream.forceMuted ? 'opacity-100' : 'opacity-0'} transition-all`}>
                    <VolumeOffIcon />
                </div>
                {
                    inExpert ?
                        <div className="absolute bottom-4 left-4 flex space-x-3 text-white">
                            <button
                                onClick={stream?.forceMuted ? enableAudioCustomer : forceMuteCustomer}
                                title={stream?.forceMuted ? 'Enable audio of customer' : 'Force mute a customer'}
                                className="hover:text-red"
                            >
                                {stream?.forceMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                            </button>
                            <button
                                onClick={kickOffCustomer}
                                title="Kick off a customer"
                                className="hover:text-red"
                            >
                                <PersonRemoveIcon />
                            </button>
                        </div> :
                        null
                }
            </div>
        </div>
    )
}

const VideosContainer = (props: any) => {
    const dispatch = useDispatch();

    const {
        auth: { userDetails },
        friends: { friends, groupChatList },
        chat: { currentEvent },
        videoChat: {
            localStream,
            callStatus,
            remoteStream,
            screenSharingStream,
            otherUserId,
            loading,
        },
        room: {
            roomDetails,
            localStreamRoom,
            remoteStreams,
            screenSharingStream: screenSharingStreamRoom,
        },
    } = useAppSelector((state) => state);

    const [remoteStreamsWithUserData, set_remoteStreamsWithUserData] = useState<
        any[]
    >([]);
    const [localStreamVisible, set_localStreamVisible] = useState(true);

    const [isLoading, setIsLoading] = useState(true); // Local loading state
    const dummyVideoRef = useRef<HTMLVideoElement | null>(null); // Ref for the dummy video element


    const handleLeaveRoom = () => {
        // notify other user that I left the call
        if (localStream) {
            if (otherUserId) {
                notifyChatLeft(otherUserId, false);
            }
            dispatch(clearVideoChat("Call Rejected"));
        }
        if (localStreamRoom) {
            leaveRoom();
        }
    };

    useEffect(() => {
        if (callStatus === "rejected") {
            handleLeaveRoom();
        }
    }, [callStatus]);

    useEffect(() => {
        // Set up a dummy video element to detect when the stream is ready
        if (remoteStream) {
            const videoElement = document.createElement("video");
            dummyVideoRef.current = videoElement;

            videoElement.srcObject = remoteStream;
            videoElement.onloadedmetadata = () => {
                videoElement.play().catch((err) => console.error("Video play error:", err));
            };

            // Hide loader when video is ready to play
            videoElement.oncanplay = () => {
                setIsLoading(false);
                videoElement.srcObject = null; // Cleanup
            };

            // Ensure we cleanup if the component unmounts or `remoteStream` changes
            return () => {
                if (videoElement) {
                    videoElement.srcObject = null;
                    dummyVideoRef.current = null;
                }
            };
        } else {
            // Show loader if there's no remote stream
            setIsLoading(true);
        }
    }, [remoteStream]);


    useEffect(() => {
        if (roomDetails) {
            const currentGroupChatonRoom = groupChatList.find(
                (x: any) => x.groupId === roomDetails?.groupId
            );
            const mapped = remoteStreams.map((stream: any) => {
                const userId = roomDetails?.participants.find(
                    (x: any) => x.socketId === stream.connUserSocketId
                )?.userId;
                const userInfo = currentGroupChatonRoom?.participants.find(
                    (x: any) => x._id === userId
                );
                const isRoomCreator = userId === roomDetails?.roomCreator?.userId;
                const forceMuted = roomDetails?.mutedParticipants?.find(
                    (x) => x === userId
                );
                const selfMuted = roomDetails?.selfMutedParticipants?.find(
                    (x) => x === userId
                );
                return {
                    stream,
                    userInfo,
                    isRoomCreator,
                    forceMuted,
                    selfMuted,
                };
            });
            set_remoteStreamsWithUserData(mapped);
        }
    }, [roomDetails, groupChatList, remoteStreams]);

    return (
        <div className="w-full h-[calc(100%-50px)] overflow-clip relative">
            {callStatus !== "accepted" && callStatus ? (
                <div className="w-full h-full flex items-center justify-center text-white">
                    <div
                        className="w-[120px] h-[120px] rounded-full flex justify-center items-center
                      border-2 border-gray-500 text-gray-100 text-5xl font-bold animate-pulse"
                    >
                        {getAvatarTitle(
                            friends[friends.findIndex((x) => x.id === otherUserId)]?.username || ""
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-full h-full">
                    <div className="w-full h-full flex justify-center items-center">
                        {isLoading ? (
                            <div className="w-full h-full flex justify-center items-center">
                                <div
                                    className="w-[120px] h-[120px] rounded-full flex justify-center items-center
                                border-2 border-gray-500 text-gray-100 text-5xl font-bold animate-pulse"
                                >
                                    {getAvatarTitle(
                                        friends[
                                            friends.findIndex((x) => x.id === otherUserId)
                                            ]?.username || ""
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="relative w-full h-full">
                                {remoteStream && (
                                    <div className="absolute top-0 left-0 w-full h-full">
                                        <Video
                                            stream={remoteStream}
                                            isLocalStream={false}
                                            avatarTitle={getAvatarTitle(
                                                friends[
                                                    friends.findIndex((x) => x.id === otherUserId)
                                                    ]?.username || ""
                                            )}
                                        />
                                        <div className="absolute top-1 left-0 w-full flex justify-center text-lightgrey">
                                            {
                                                friends[
                                                    friends.findIndex((x) => x.id === otherUserId)
                                                    ]?.username
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Local stream in the corner */}
                                {localStream && (
                                    <div
                                        title={
                                            localStreamVisible
                                                ? "Minimize the window"
                                                : "Maximize the window"
                                        }
                                        className={`absolute bottom-0 right-0 z-[201] bg-midgrey-1 rounded-tl-lg overflow-clip
                                    border-0 border-l-2 border-t-2 border-green ${
                                            localStreamVisible
                                                ? ""
                                                : "translate-x-[90%] hover:translate-x-[70%]"
                                        } ${
                                            props.isRoomMinimized
                                                ? "w-[100px] h-[100px]"
                                                : "w-[150px] h-[150px]"
                                        } cursor-pointer transition-all`}
                                        onClick={() =>
                                            set_localStreamVisible(!localStreamVisible)
                                        }
                                    >
                                        <Video
                                            stream={
                                                screenSharingStream
                                                    ? screenSharingStream
                                                    : localStream
                                            }
                                            isLocalStream={true}
                                            avatarTitle={getAvatarTitle(userDetails?.username)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

};

export default VideosContainer;