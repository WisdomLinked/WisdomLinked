import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../store";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useVideoChatContext } from "./VideoChatContext";
import { getCustomerById, getExpertById } from "../../api/api";
import { setChosenChatDetails } from "../../actions/chatActions";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { actionTypes } from "../../actions/types";
import { JitsiMeeting } from '@jitsi/react-sdk';

const VideoChat = ({
    role,
    otherUserId
}: any) => {
    const { isRoomMinimized, setIsRoomMinimized } = useVideoChatContext();
    const {
        room: { roomDetails },
        auth: { userDetails }
    } = useAppSelector((state) => state);
    const [hidden, set_hidden] = useState(false);
    const [otherUserInfo, setOtherUserInfo] = useState<any>(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchOtherUser = async () => {
            try {
                const response = role === "expert"
                    ? await getCustomerById(otherUserId)
                    : await getExpertById(otherUserId);
                setOtherUserInfo(response.result);
            } catch (err) {
                console.error("Failed to fetch user data:", err);
            }
        };

        if (otherUserId) {
            fetchOtherUser();
        }
    }, [role, otherUserId]);

    useEffect(() => {
        if (!isRoomMinimized) {
            if (otherUserInfo) {
                dispatch(setChosenChatDetails({
                    userId: otherUserInfo._id,
                    username: otherUserInfo.username,
                    image: otherUserInfo.image,
                }))
            }
            dispatch({ type: actionTypes.updateMissedChats, payload: { receiverId: otherUserId, count: 0 } })
            role === "expert"
                ? navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`)
                : navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`);
        }
    }, [isRoomMinimized]);

    return (
        <React.Fragment>
            <div
                className={`fixed top-[63px] left-0 right-0 bottom-0 bg-black z-[200]`}
            >
                {hidden ? (
                    <button
                        className="absolute top-2 right-2 p-3 rounded-md text-white z-[10000] bg-green shadow-xl"
                        title="Show call window"
                        onClick={() => set_hidden(false)}
                    >
                        <VisibilityIcon />
                    </button>
                ) : (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {roomDetails?.roomId && (
                            <JitsiMeeting
                                roomName={roomDetails.roomId}
                                getIFrameRef={(iframeRef) => { iframeRef.style.height = '100%'; iframeRef.style.width = '100%'; }}
                                configOverwrite={{
                                    startWithAudioMuted: false,
                                    startWithVideoMuted: false,
                                }}
                                userInfo={{
                                    displayName: userDetails?.username || "Guest",
                                    email: userDetails?.email || "guest@wisdomlinked.com",
                                }}
                                onApiReady={(externalApi) => {
                                    externalApi.addListener('videoConferenceLeft', () => {
                                        // Automatically hide/close the component when the user hangs up inside Jitsi
                                        set_hidden(true);
                                    });
                                }}
                            />
                        )}
                        <button
                            className="absolute top-2 left-2 p-2 rounded-md text-white bg-red/50 hover:bg-black z-[10000] transition shadow-md"
                            title="Hide call window"
                            onClick={() => set_hidden(true)}
                        >
                            <VisibilityOffIcon /> Collapse Screen
                        </button>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
};

export default VideoChat;
