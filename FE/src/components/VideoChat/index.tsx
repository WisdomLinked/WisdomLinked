import React, {useCallback, useRef, useState} from "react";
import VideosContainer from "./VideosContainer";
import RoomButtons from "./RoomButtons";
import { useAppSelector } from "../../store";
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';

const VideoChat = () => {
    const [isRoomMinimized, setIsRoomMinimized] = useState(true);
    const {videoChat, app: { feedbackModalShow }} = useAppSelector((state) => state);
    const [hidden, set_hidden] = useState(false)
    const [position, setPosition] = useState({ x: window.innerWidth - 300, y: 63 });
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const roomResizeHandler = () => {
        setIsRoomMinimized(!isRoomMinimized);
    };

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        const startX = e.clientX - position.x;
        const startY = e.clientY - position.y;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            let newX = e.clientX - startX;
            let newY = e.clientY - startY;

            // Constrain movement within the viewport
            const containerWidth = containerRef.current?.offsetWidth || 0;
            const containerHeight = containerRef.current?.offsetHeight || 0;
            newX = Math.max(0, Math.min(newX, window.innerWidth - containerWidth));
            newY = Math.max(63, Math.min(newY, window.innerHeight - containerHeight));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [position]);

    return (
        <React.Fragment> 
            {
                hidden ?
                    <button 
                        className="absolute top-[63px] right-0 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000] bg-green"
                        title='show call window'
                        onClick={() => set_hidden(false)}
                    >
                        <VisibilityIcon />
                    </button> :
                    <div
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        style={{
                            position: 'absolute',
                            left: `${position.x}px`,
                            top: `${position.y}px`,
                            cursor: 'grab'
                        }}
                        className={`
                            absolute top-[63px] right-0 flex flex-col items-center justify-center bg-black border-2 border-green rounded-[8px] transition-all z-[200] overflow-clip
                            ${isRoomMinimized ? 'w-[300px] h-[300px]' : 'w-[100vw] md:w-[calc(100vw-70px)] h-[calc(100vh-63px)]'}
                        `}
                    >
                        <button 
                            className="absolute top-1 right-1 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000]"
                            title='hide call window'
                            onClick={() => set_hidden(true)}
                        >
                            <VisibilityOffIcon />
                        </button>
                        <VideosContainer videoChat={videoChat} isRoomMinimized={isRoomMinimized}/>
                        <RoomButtons
                            isRoomMinimized={isRoomMinimized}
                            handleRoomResize={roomResizeHandler}
                        />
                    </div>
            }
        </React.Fragment>
    );
};

export default VideoChat;
