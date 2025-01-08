    import React, {useEffect, useRef} from 'react'
    import { styled } from "@mui/system";
    import Backdrop from '@mui/material/Backdrop';
    import Typography from "@mui/material/Typography";
    import IconButton from "@mui/material/IconButton";
    import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
    import PhoneDisabledIcon from "@mui/icons-material/PhoneDisabled";
    import VideocamIcon from "@mui/icons-material/Videocam";
    import { useAppSelector } from '../store';
    import { callResponse } from '../socket/socketConnection';

    const MainContainer = styled("div")({
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: "15px 20px",
        borderRadius: "30px",
    });

    const IncomingCall = () => {
        const callRequest = useAppSelector(state => state.videoChat.callRequest);
        const audioRef = useRef<HTMLAudioElement>(null);

        const handleCall = (accepted: boolean, audioOnly: boolean) => {
            // Stop the ringing sound
            if (audioRef.current) {
                console.log("Stopping audio playback...");
                audioRef.current.pause();
                audioRef.current.currentTime = 0; // Reset to the start
            }

            // Respond to the call
            callResponse({
                callerId: callRequest!.callerUserId,
                callerName: callRequest!.callerName,
                accepted,
                audioOnly
            });
        };

        useEffect(() => {
            if (callRequest?.callerUserId && audioRef.current) {
                console.log("Incoming call detected. Attempting to play audio...");
                audioRef.current
                    .play()
                    .then(() => {
                        console.log("Audio playback started successfully.");
                    })
                    .catch((err) => {
                        console.error("Error playing the audio:", err);
                    });
            } else if (!callRequest?.callerUserId && audioRef.current) {
                console.log("No active call. Stopping audio playback...");
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }, [callRequest]);

        return (
            <Backdrop
                sx={{
                    color: "#fff",
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                open={!!callRequest?.callerUserId}
            >
                {/* Audio element for the ringing sound */}
                <audio ref={audioRef} loop preload="auto">
                    <source
                        src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3"
                        type="audio/mp3"
                    />
                    Your browser does not support the audio element.
                </audio>
                <MainContainer>
                    <Typography
                        sx={{
                            color: "black",
                            marginBottom: "3px",
                            fontSize: "16px",
                            fontWeight: "bold",
                        }}
                    >
                        Incoming {callRequest?.audioOnly ? "audio" : "video"} call from{" "}
                        {callRequest?.callerName}
                    </Typography>

                    <div>
                        {!callRequest?.audioOnly && (
                            <IconButton
                                color="success"
                                onClick={() => {
                                    handleCall(true, false);
                                }}
                            >
                                <VideocamIcon />
                            </IconButton>
                        )}

                        <IconButton
                            color="success"
                            onClick={() => {
                                handleCall(true, true);
                            }}
                        >
                            <PhoneInTalkIcon />
                        </IconButton>

                        <IconButton
                            color="error"
                            onClick={() => {
                                handleCall(false, true);
                            }}
                        >
                            <PhoneDisabledIcon />
                        </IconButton>
                    </div>
                </MainContainer>
            </Backdrop>
        );
    }

    export default IncomingCall