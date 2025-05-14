import React, { useCallback, useEffect, useRef, useState } from "react";
import VideosContainer from "./VideosContainer";
import RoomButtons from "./RoomButtons";
import { useAppSelector } from "../../store";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useVideoChatContext } from "./VideoChatContext";
import { is } from "date-fns/locale";
import { getCustomerById, getExpertById } from "../../api/api";
import { setChosenChatDetails } from "../../actions/chatActions";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { actionTypes } from "../../actions/types";

const VideoChat = ({
    role,
    otherUserId
  }: any) => {
    const {isRoomMinimized, setIsRoomMinimized} = useVideoChatContext();
    const { videoChat, app: { feedbackModalShow } } = useAppSelector((state) => state);
    const [hidden, set_hidden] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const positionRef = useRef({ x: window.innerWidth - 300, y: 63 });
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const [, forceUpdate] = useState({});
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [otherUserInfo, setOtherUserInfo] = useState<any>(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const toggleChat = () => {
        setIsChatOpen(!isChatOpen);
      };

    const roomResizeHandler = () => {
        setIsRoomMinimized(!isRoomMinimized);
    };

    const updatePosition = useCallback((x: number, y: number) => {
        if (containerRef.current) {
            if (isRoomMinimized) {
                containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            } else {
                containerRef.current.style.transform = 'translate3d(0, 0, 0)';
            }
        }
    }, [isRoomMinimized]);


    const handleStart = useCallback((clientX: number, clientY: number) => {
        isDraggingRef.current = true;
        const startX = clientX - positionRef.current.x;
        const startY = clientY - positionRef.current.y;

        const handleMove = (moveClientX: number, moveClientY: number) => {
            if (!isDraggingRef.current) return;

            requestAnimationFrame(() => {
                if (isRoomMinimized) {
                    let newX = moveClientX - startX;
                    let newY = moveClientY - startY;

                    const maxX = window.innerWidth - 300;
                    const maxY = window.innerHeight - 300;
                    newX = Math.max(0, Math.min(newX, maxX));
                    newY = Math.max(63, Math.min(newY, maxY));

                    positionRef.current = { x: newX, y: newY };
                    updatePosition(newX, newY);
                }
            });
        };


        const handleEnd = () => {
            isDraggingRef.current = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
            forceUpdate({}); // Force a re-render to update the position state
        };

        const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault(); // Prevent scrolling while dragging
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        };

        const handleMouseUp = handleEnd;
        const handleTouchEnd = handleEnd;

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleTouchEnd);
    }, [updatePosition]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        handleStart(e.clientX, e.clientY);
    }, [handleStart]);

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }, [handleStart]);

    useEffect(() => {
        updatePosition(positionRef.current.x, positionRef.current.y);
    }, [updatePosition]);

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
            updatePosition(0, 0);
            dispatch(setChosenChatDetails({
                userId: otherUserInfo._id,
                username: otherUserInfo.username,
                image: otherUserInfo.image,
              }))
            dispatch({ type: actionTypes.updateMissedChats, payload: { receiverId: otherUserId, count: 0 } })
            const response = role === "expert"
                    ? navigate(`${process.env.REACT_APP_AUTH_URL}expertdashboard/chat`)
                    : navigate(`${process.env.REACT_APP_AUTH_URL}customerdashboard/chat`)
            
        } else {
            updatePosition(positionRef.current.x, positionRef.current.y);
        }
    }, [isRoomMinimized, updatePosition]);

    return (
        <React.Fragment>
            {hidden ? (
                <button
                    className="absolute top-[63px] right-0 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000] bg-green"
                    title="Show call window"
                    onClick={() => set_hidden(false)}
                >
                    <VisibilityIcon />
                </button>
            ) : null}

            <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    cursor: "grab",
                    willChange: "transform",
                    transition: isDraggingRef.current ? "none" : "transform 0.1s ease-out",
                    touchAction: "none",
                    display: hidden ? "none" : "block", // Use CSS to hide the component
                }}
    //             className={`flex flex-col items-center justify-center bg-black border-2 border-green rounded-[8px] z-[200] overflow-clip
    //     ${isRoomMinimized ? "w-[300px] h-[300px]" : "fixed top-[63px] left-0 w-screen h-[calc(100vh-63px)]"}
    // `}
                className={`flex flex-col items-center justify-center bg-black border-2 border-green rounded-[8px] z-[200] overflow-clip ${
                    isRoomMinimized
                        ? "w-[300px] h-[300px]"
                        : isChatOpen
                            ? "fixed top-[63px] left-0 w-[calc(100vw-350px)] h-[calc(100vh)]"
                            : "fixed top-[63px] left-0 w-screen h-[calc(100vh)]"
                }`}
            >
                <button
                    className="absolute top-1 right-1 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000]"
                    title="Hide call window"
                    onClick={() => set_hidden(true)}
                >
                    <VisibilityOffIcon />
                </button>
                <VideosContainer videoChat={videoChat} isRoomMinimized={isRoomMinimized} />
                <RoomButtons
                    isRoomMinimized={isRoomMinimized}
                    handleRoomResize={roomResizeHandler}
                    isChatOpen={isChatOpen}
                    toggleChat={toggleChat}
                />
            </div>
        </React.Fragment>
    );
};

export default VideoChat;
