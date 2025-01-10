import React, { useEffect, useRef, useState } from "react";
import MicOffIcon from "@mui/icons-material/MicOff";
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { useAppSelector } from "../../store";
import { useDispatch } from "react-redux";
import { setVideoAudioStatus } from "../../actions/videoChatActions";

const Video = ({
                   stream,
                   isLocalStream,
                   avatarTitle,
                   remoteRoomStream,
                   selfMuted
               }: any) => {

    const dispatch = useDispatch();
    const {
        auth: { userDetails },
        chat: { currentEvent },
        room: { activeRooms, roomDetails },
        videoChat: { localVideoEnabled, localAudioEnabled, remoteVideoEnabled, remoteAudioEnabled },
    } = useAppSelector((state) => state);

    const videoRef = useRef<HTMLVideoElement>(null);
    const [forceMuted, set_forceMuted] = useState(false)

    useEffect(() => {
        if (stream && typeof stream !== "boolean") {
            console.log("Attaching Stream to Video:", stream);
            const video = videoRef.current;

            if (video) {
                video.srcObject = null;
                video.srcObject = stream;
                video.setAttribute("playsInline", "true");
                video.setAttribute("disablePictureInPicture", "true");

                video.onloadedmetadata = () => {
                    video.play().catch((err) => console.error("Video play error:", err));
                    if (isLocalStream) {
                        video.muted = true;
                        video.volume = 0;
                    }
                };

                // Attempt to set the audio output to speaker if it's a remote stream & browser supports setSinkId
                if (!isLocalStream && "setSinkId" in video) {
                    (video as HTMLVideoElement & {setSinkId: (sinkId: string) => Promise<void>})
                        .setSinkId("default")
                        .then(() => console.log("Audio output set to default speaker"))
                        .catch((err) => console.error("setSinkId error:", err));
                }

                const videoEnabled = stream.getVideoTracks()?.[0]?.enabled;
                const audioEnabled = stream.getAudioTracks()?.[0]?.enabled;

                // if (!remoteRoomStream) {
                //     dispatch(setVideoAudioStatus(videoEnabled, audioEnabled, isLocalStream));
                // }
                if (!remoteRoomStream) {
                    // Check if this is a screen share stream
                    const isScreenShare = stream.getVideoTracks()[0].label.includes('screen');

                    // If it's a screen share, only update video status
                    if (isScreenShare) {
                        dispatch(setVideoAudioStatus(videoEnabled, localAudioEnabled, isLocalStream));
                    } else {
                        dispatch(setVideoAudioStatus(videoEnabled, audioEnabled, isLocalStream));
                    }
                }
            }
        }
    }, [stream, isLocalStream]);

    useEffect(() => {
        if (roomDetails && isLocalStream) {
            const muted = roomDetails.mutedParticipants?.find(x => x === userDetails.userId)
            set_forceMuted(!!muted)
        } else {
            set_forceMuted(false)
        }
    }, [currentEvent, userDetails, roomDetails, isLocalStream])

    return (
        <div className="w-full h-full relative">
            <video
                ref={videoRef}
                disablePictureInPicture
                className={`${isLocalStream ? 'w-full h-full object-cover object-center' : 'w-full h-full object-contain object-center'}`}
                autoPlay
                playsInline
                webkit-playsinline
                muted={isLocalStream}
            />
            <div className={`w-full h-full flex justify-center items-center absolute top-0 left-0 bg-midgrey-1 ${((isLocalStream && !localVideoEnabled) || (!isLocalStream && !remoteVideoEnabled)) ? 'opacity-100' : 'opacity-0'} transition-all`}>
                {
                    isLocalStream ?
                        <div className="w-[60px] h-[60px] rounded-full flex justify-center items-center border-2 border-gray-500 text-gray-100 text-2xl font-bold">
                            {avatarTitle}
                        </div>
                        :
                        <div className="w-[100px] h-[100px] rounded-full flex justify-center items-center border-2 border-gray-500 text-gray-100 text-5xl font-bold">
                            {avatarTitle}
                        </div>
                }
            </div>
            {
                !remoteRoomStream ?
                    <div className={`absolute left-1 -top-1 text-red text-[30px] ${((isLocalStream && !localAudioEnabled) || (!isLocalStream && !remoteAudioEnabled)) ? 'opacity-100' : 'opacity-0'} transition-all`}>
                        <MicOffIcon />
                    </div> :
                    <div className={`absolute left-1 -top-1 text-red text-[30px] ${selfMuted ? 'opacity-100' : 'opacity-0'} transition-all`}>
                        <MicOffIcon />
                    </div>
            }
            <div className={`absolute left-8 -top-1 text-red text-[30px] ${forceMuted ? 'opacity-100' : 'opacity-0'} transition-all`}>
                <VolumeOffIcon />
            </div>
        </div>
    );
};

export default Video;
