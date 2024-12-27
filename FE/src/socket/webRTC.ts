import Peer from "simple-peer";
import { setLocalStreamRoom, setRemoteStreams } from "../actions/roomActions";
import { setLocalStream } from "../actions/videoChatActions";
import { store } from "../store";
import { signalPeerData } from "./socketConnection";
import { actionTypes } from "../actions/types";
import { showAlert } from "../actions/alertActions";

const getLocalStream = async () => {
    console.log("[WEBRTC] Fetching local video and audio streams");

    // Check available devices
    navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        const audioDevices = devices.filter((device) => device.kind === "audioinput");

        console.log("[WEBRTC] Available video devices:", videoDevices);
        console.log("[WEBRTC] Available audio devices:", audioDevices);

        if (videoDevices.length === 0) {
            console.warn("[WEBRTC] No video devices found. Video may not work.");
        }
        if (audioDevices.length === 0) {
            console.warn("[WEBRTC] No audio devices found. Audio may not work.");
        }
    });

    let videoStream, audioStream;

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        console.log("[WEBRTC] Video stream acquired:", videoStream);
    } catch (error) {
        console.error("[WEBRTC] Error acquiring video stream", error);
    }

    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("[WEBRTC] Audio stream acquired:", audioStream);
    } catch (error) {
        console.error("[WEBRTC] Error acquiring audio stream", error);
    }

    return { videoStream, audioStream };
};

export const checkLocalAudioVideoStreams = async () => {
    const {videoStream, audioStream} = await getLocalStream()
    store.dispatch({
        type: actionTypes.setLocalStreamAvailability,
        payload: {
            videoStream,
            audioStream
        }
    })
}

export const getLocalStreamPreview = async (audioOnly: boolean, callback?: () => void, room?: boolean, failedCallback?: (err: any) => any) => {

    const {videoStream, audioStream} = await getLocalStream()
    const constraints = room ? 
        { audio: audioStream ? true : false, video: videoStream ? true : false} : 
        { audio: true, video: audioOnly ? false : true };

    console.log("constraints", constraints);
    
    store.dispatch({
        type: actionTypes.setLocalStreamAvailability,
        payload: {
            videoStream,
            audioStream
        }
    })

    // FOR VIRTUAL STREAM -------------
    // if (room) {
    //     store.dispatch(setLocalStreamRoom(true) as any);
    // } else {
    //     store.dispatch(setLocalStream(true) as any);
    // }

    // if (callback) {
    //     callback();
    // }
    // return 

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        if (room) {
            store.dispatch(setLocalStreamRoom(stream) as any);
        } else {
            store.dispatch(setLocalStream(stream) as any);
        }

        if (callback) {
            callback();
        }

    }).catch((err) => {
        console.log(err);
        console.log("Error getting local stream");
        store.dispatch(showAlert(
            room ?
                "You don't have any media devices, plesae check your microphone and camera" :
                audioOnly ?
                    "You don't have any audio devices, plesae check your microphone" :
                    "You don't have any video devices, plesae check your camera"
        ))
        if (failedCallback)
            failedCallback(err)
    })
}


const peerConfiguration = () => {

    if (process.env.REACT_APP_TURN_URL) {
        console.log("Using only TURN server");
        return {
            iceServers: [
                {
                    urls: [
                        `turn:${process.env.REACT_APP_TURN_URL}:3478?transport=udp`,
                        `turn:${process.env.REACT_APP_TURN_URL}:80?transport=tcp`
                    ],
                    username: "efA389S6BJFSNKYQP2",
                    credential: "dkvSztjG5Rs60Er0"
                }
            ]
        }
    } else {
        console.log("Using only STUN server");
        return {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
            ],
        };
    }
};


export const newPeerConnection = (initiator: boolean) => {
    console.log("[WEBRTC] Creating a new Peer connection, initiator:", initiator);

    const stream = store.getState().videoChat.localStream;
    if (!stream) {
        console.error("[WEBRTC] No local stream found. Cannot create peer connection.");
        throw new Error("No local stream");
    }

    console.log("[WEBRTC] Local stream retrieved from store:", stream);

    // Fetch the ICE server configuration
    const configuration = peerConfiguration();
    console.log("[WEBRTC] Using ICE server configuration:", configuration);

    // Create a new Peer connection
    const peer = new Peer({
        initiator,
        trickle: false,
        config: configuration,
        stream,
    });

    console.log("[WEBRTC] New Peer connection instance created");

    // Log events for better debugging
    peer.on("signal", (signal) => {
        console.log("[WEBRTC] Peer emitted signal:", signal);
    });

    peer.on("connect", () => {
        console.log("[WEBRTC] Peer connection established successfully.");
    });

    peer.on("error", (error) => {
        console.error("[WEBRTC] Peer connection error:", error);
    });

    peer.on("close", () => {
        console.log("[WEBRTC] Peer connection closed.");
    });

    // Handle remote stream
    peer.on("stream", (remoteStream) => {
        console.log("[WEBRTC] Remote stream received:", remoteStream);

        // Ensure the stream is set correctly on the UI
        if (remoteStream && remoteStream.getVideoTracks().length > 0) {
            const videoElement = document.querySelector("#remote-video") as HTMLVideoElement;
            if (videoElement) {
                videoElement.srcObject = remoteStream;
                console.log("[WEBRTC] Remote video stream set on video element.");
            } else {
                console.error("[WEBRTC] Remote video element not found.");
            }
        } else {
            console.warn("[WEBRTC] No video tracks in the received stream. Possible audio-only connection.");
        }
    });

    // Check video visibility periodically
    const checkVideoVisibility = () => {
        const videoElement = document.querySelector("#remote-video") as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
            console.log("[DEBUG] Remote video element has a stream:", videoElement.srcObject);
        } else {
            console.warn("[DEBUG] Remote video element does not have a stream.");
        }
    };

    const visibilityCheckInterval = setInterval(checkVideoVisibility, 5000);

    // Handle connection closure
    peer.on("close", () => {
        console.log("[WEBRTC] Peer connection closed.");
        clearInterval(visibilityCheckInterval);
        console.log("[WEBRTC] Stopped periodic video visibility check.");
    });

    // Handle errors
    peer.on("error", (error) => {
        console.error("[WEBRTC] Peer connection encountered an error:", error);
    });

    console.log("[WEBRTC] Peer connection created successfully.");
    return peer;
};


let peers: any = {};

export const prepareNewPeerConnection = (connUserSocketId: string, isInitiator: boolean) => {
    // connUserSocketId; -> who has joined the room

    const localStream = store.getState().room.localStreamRoom;

    if (isInitiator) {
        console.log("preparing new peer connection as initiator");
    } else {
        console.log("preparing new peer connection as not initiator");
    }

    // if(!localStream) {
    //     return
    // }

    console.log("localStream", localStream)

    console.log("hello")

    peers[connUserSocketId] = new Peer({
        initiator: isInitiator,
        config: peerConfiguration(),
        stream: localStream!,
    });

    peers[connUserSocketId].on("signal", (data: Peer.SignalData) => {
        const signalData = {
            signal: data,
            connUserSocketId: connUserSocketId,
        };

        signalPeerData(signalData);
    });

    peers[connUserSocketId].on("stream", (remoteStream: any) => {
        // TODO
        // add new remote stream (of connUserSocketId who has joined the room) to our server store
        console.log("remote stream came from other user");
        console.log("direct connection has been established");
        remoteStream.connUserSocketId = connUserSocketId;
        addNewRemoteStream(remoteStream);
    });
};

export const handleSignalingData = (data: {
    connUserSocketId: string;
    signal: Peer.SignalData;
}) => {
    const { connUserSocketId, signal } = data;

    if (peers[connUserSocketId]) {
        peers[connUserSocketId].signal(signal);
    }
};

const addNewRemoteStream = (remoteStream: MediaStream | Boolean) => {
    console.log("Hi")
    const remoteStreams = store.getState().room.remoteStreams;
    const newRemoteStreams = [...remoteStreams, remoteStream];

    store.dispatch(setRemoteStreams(newRemoteStreams) as any);
};

export const closeAllConnections = () => {
    Object.entries(peers).forEach((mappedObject) => {
        console.log('Closing the connection',mappedObject);
        const connUserSocketId = mappedObject[0];
        if (peers[connUserSocketId]) {
            peers[connUserSocketId].destroy();
            delete peers[connUserSocketId];
        }
    });
};

export const handleParticipantLeftRoom = (data: { connUserSocketId: string }) => {
    const { connUserSocketId } = data;

    if (peers[connUserSocketId]) {
        peers[connUserSocketId].destroy();
        delete peers[connUserSocketId];
    }

    const remoteStreams = store.getState().room.remoteStreams;

    const newRemoteStreams = remoteStreams.filter(
        (remoteStream) =>
            (remoteStream as any).connUserSocketId !== connUserSocketId
    );

    store.dispatch(setRemoteStreams(newRemoteStreams) as any);
};

export const switchOutgoingTracks = (stream: MediaStream) => {
    for (let socket_id in peers) {
        for (let index in peers[socket_id].streams[0].getTracks()) {
            for (let index2 in stream.getTracks()) {
                if (
                    peers[socket_id].streams[0].getTracks()[index].kind ===
                    stream.getTracks()[index2].kind
                ) {
                    peers[socket_id].replaceTrack(
                        peers[socket_id].streams[0].getTracks()[index],
                        stream.getTracks()[index2],
                        peers[socket_id].streams[0]
                    );
                    break;
                }
            }
        }
    }
};
