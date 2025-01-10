// import React, {useCallback, useEffect, useRef, useState} from "react";
// import VideosContainer from "./VideosContainer";
// import RoomButtons from "./RoomButtons";
// import { useAppSelector } from "../../store";
// import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
// import VisibilityIcon from '@mui/icons-material/Visibility';
//
// const VideoChat = () => {
//     const [isRoomMinimized, setIsRoomMinimized] = useState(true);
//     const {videoChat, app: { feedbackModalShow }} = useAppSelector((state) => state);
//     const [hidden, set_hidden] = useState(false)
//     const positionRef = useRef({ x: window.innerWidth - 300, y: 63 });
//     const containerRef = useRef<HTMLDivElement>(null);
//     const isDraggingRef = useRef(false);
//     const [, forceUpdate] = useState({});
//
//     const roomResizeHandler = () => {
//         setIsRoomMinimized(!isRoomMinimized);
//     };
//
//     const updatePosition = useCallback((x: number, y: number) => {
//         if (containerRef.current) {
//             containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
//         }
//     }, []);
//
//     const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
//         isDraggingRef.current = true;
//         const startX = e.clientX - positionRef.current.x;
//         const startY = e.clientY - positionRef.current.y;
//
//         let lastUpdateTime = 0;
//         const FRAME_RATE = 60;
//         const FRAME_DELAY = 1000 / FRAME_RATE;
//
//         const handleMouseMove = (e: MouseEvent) => {
//             if (!isDraggingRef.current) return;
//
//             const currentTime = Date.now();
//             if (currentTime - lastUpdateTime < FRAME_DELAY) return;
//
//             lastUpdateTime = currentTime;
//
//             requestAnimationFrame(() => {
//                 let newX = e.clientX - startX;
//                 let newY = e.clientY - startY;
//
//                 // Constrain movement within the viewport
//                 const containerWidth = containerRef.current?.offsetWidth || 0;
//                 const containerHeight = containerRef.current?.offsetHeight || 0;
//                 newX = Math.max(0, Math.min(newX, window.innerWidth - containerWidth));
//                 newY = Math.max(63, Math.min(newY, window.innerHeight - containerHeight));
//
//                 positionRef.current = { x: newX, y: newY };
//                 updatePosition(newX, newY);
//             });
//         };
//
//         const handleMouseUp = () => {
//             isDraggingRef.current = false;
//             document.removeEventListener('mousemove', handleMouseMove);
//             document.removeEventListener('mouseup', handleMouseUp);
//             forceUpdate({});  // Force a re-render to update the position state
//         };
//
//         document.addEventListener('mousemove', handleMouseMove);
//         document.addEventListener('mouseup', handleMouseUp);
//     }, [updatePosition]);
//
//     useEffect(() => {
//         updatePosition(positionRef.current.x, positionRef.current.y);
//     }, [updatePosition]);
//     return (
//         <React.Fragment>
//             {hidden ? (
//                 <button
//                     className="absolute top-[63px] right-0 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000] bg-green"
//                     title='show call window'
//                     onClick={() => set_hidden(false)}
//                 >
//                     <VisibilityIcon />
//                 </button>
//             ) : (
//                 <div
//                     ref={containerRef}
//                     onMouseDown={handleMouseDown}
//                     style={{
//                         position: 'absolute',
//                         left: 0,
//                         top: 0,
//                         cursor: 'grab',
//                         willChange: 'transform',
//                         transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out'
//                     }}
//                     className={`
//                         flex flex-col items-center justify-center bg-black border-2 border-green rounded-[8px] z-[200] overflow-clip
//                         ${isRoomMinimized ? 'w-[300px] h-[300px]' : 'w-[100vw] md:w-[calc(100vw-70px)] h-[calc(100vh-63px)]'}
//                     `}
//                 >
//                     <button
//                         className="absolute top-1 right-1 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000]"
//                         title='hide call window'
//                         onClick={() => set_hidden(true)}
//                     >
//                         <VisibilityOffIcon />
//                     </button>
//                     <VideosContainer videoChat={videoChat} isRoomMinimized={isRoomMinimized}/>
//                     <RoomButtons
//                         isRoomMinimized={isRoomMinimized}
//                         handleRoomResize={roomResizeHandler}
//                     />
//                 </div>
//             )}
//         </React.Fragment>
//     );
// };
//
// export default VideoChat;
//

import React, {useCallback, useEffect, useRef, useState} from "react";
import VideosContainer from "./VideosContainer";
import RoomButtons from "./RoomButtons";
import { useAppSelector } from "../../store";
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';

const VideoChat = () => {
    const [isRoomMinimized, setIsRoomMinimized] = useState(true);
    const {videoChat, app: { feedbackModalShow }} = useAppSelector((state) => state);
    const [hidden, set_hidden] = useState(false)
    const positionRef = useRef({ x: window.innerWidth - 300, y: 63 });
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const [, forceUpdate] = useState({});

    const roomResizeHandler = () => {
        setIsRoomMinimized(!isRoomMinimized);
    };

    const updatePosition = useCallback((x: number, y: number) => {
        if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
    }, []);

    const handleStart = useCallback((clientX: number, clientY: number) => {
        isDraggingRef.current = true;
        const startX = clientX - positionRef.current.x;
        const startY = clientY - positionRef.current.y;

        let lastUpdateTime = 0;
        const FRAME_RATE = 60;
        const FRAME_DELAY = 1000 / FRAME_RATE;

        const handleMove = (moveClientX: number, moveClientY: number) => {
            if (!isDraggingRef.current) return;

            const currentTime = Date.now();
            if (currentTime - lastUpdateTime < FRAME_DELAY) return;

            lastUpdateTime = currentTime;

            requestAnimationFrame(() => {
                let newX = moveClientX - startX;
                let newY = moveClientY - startY;

                // Constrain movement within the viewport
                const containerWidth = containerRef.current?.offsetWidth || 0;
                const containerHeight = containerRef.current?.offsetHeight || 0;
                newX = Math.max(0, Math.min(newX, window.innerWidth - containerWidth));
                newY = Math.max(63, Math.min(newY, window.innerHeight - containerHeight));

                positionRef.current = { x: newX, y: newY };
                updatePosition(newX, newY);
            });
        };

        const handleEnd = () => {
            isDraggingRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            forceUpdate({});  // Force a re-render to update the position state
        };

        const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault(); // Prevent scrolling while dragging
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        };

        const handleMouseUp = handleEnd;
        const handleTouchEnd = handleEnd;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
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

    return (
        <React.Fragment>
            {hidden ? (
                <button
                    className="absolute top-[63px] right-0 p-1 rounded-md text-white hover:bg-lightgrey hover:text-black z-[10000] bg-green"
                    title='show call window'
                    onClick={() => set_hidden(false)}
                >
                    <VisibilityIcon />
                </button>
            ) : (
                <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        cursor: 'grab',
                        willChange: 'transform',
                        transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
                        touchAction: 'none' // Prevent default touch actions
                    }}
                    className={`
                        flex flex-col items-center justify-center bg-black border-2 border-green rounded-[8px] z-[200] overflow-clip
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
            )}
        </React.Fragment>
    );
};

export default VideoChat;
