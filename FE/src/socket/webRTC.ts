import Peer from "simple-peer";
import { setLocalStreamRoom, setRemoteStreams } from "../actions/roomActions";
import { setLocalStream } from "../actions/videoChatActions";
import { store } from "../store";
import { signalPeerData } from "./socketConnection";
import { actionTypes } from "../actions/types";
import { showAlert } from "../actions/alertActions";

const getLocalStream = async () => {
    let videoStream, audioStream;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } catch (error) {
    }
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (error) {
    }
    return {
        videoStream,
        audioStream
    }
}

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

// export const getLocalStreamPreview = async (audioOnly: boolean, callback?: () => void, room?: boolean, failedCallback?: (err: any) => any) => {
//     console.log("Getting local stream preview");
//
//     const {videoStream, audioStream} = await getLocalStream()
//     const constraints = room ?
//         { audio: audioStream ? true : false, video: videoStream ? true : false} :
//         { audio: true, video: audioOnly ? false : true };
//
//     console.log("Media constraints:", constraints);
//
//     store.dispatch({
//         type: actionTypes.setLocalStreamAvailability,
//         payload: {
//             videoStream,
//             audioStream
//         }
//     })
//
//     navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
//         if (room) {
//             console.log("Local stream obtained:", stream);
//             store.dispatch(setLocalStreamRoom(stream) as any);
//         } else {
//             store.dispatch(setLocalStream(stream) as any);
//         }
//
//         if (callback) {
//             callback();
//         }
//
//     }).catch((err) => {
//         console.log(err);
//         console.log("Error getting local stream");
//         store.dispatch(showAlert(
//             room ?
//                 "You don't have any media devices, plesae check your microphone and camera" :
//                 audioOnly ?
//                     "You don't have any audio devices, plesae check your microphone" :
//                     "You don't have any video devices, plesae check your camera"
//         ))
//         if (failedCallback)
//             failedCallback(err)
//     })
// }
export const getLocalStreamPreview = async (
    audioOnly: boolean,
    callback?: () => void,
    room?: boolean,
    failedCallback?: (err: any) => any
) => {
    console.log("Getting local stream preview");

    // Stop and clear any existing local streams before fetching a new one
    const currentLocalStream = store.getState().videoChat.localStream;
    if (currentLocalStream) {
        console.log("Stopping existing local stream...");
        currentLocalStream.getTracks().forEach((track : any) => track.stop());
        store.dispatch(setLocalStream(null)); // Clear the existing stream in Redux
    }

    const constraints = room
        ? { audio: true, video: true } // Both audio and video for rooms
        : { audio: true, video: !audioOnly }; // Audio-only if specified

    console.log("Media constraints:", constraints);

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("New local stream obtained:", stream);

        if (room) {
            store.dispatch(setLocalStreamRoom(stream) as any);
        } else {
            store.dispatch(setLocalStream(stream) as any);
        }

        if (callback) {
            callback();
        }
    } catch (err) {
        console.error("Error getting local stream:", err);

        // Show relevant alert message
        store.dispatch(
            showAlert(
                room
                    ? "You don't have any media devices, please check your microphone and camera."
                    : audioOnly
                        ? "You don't have any audio devices, please check your microphone."
                        : "You don't have any video devices, please check your camera."
            )
        );

        if (failedCallback) {
            failedCallback(err);
        }
    }
};

const peerConfiguration = () => {
    console.log("Configuring ICE servers");

    const stunServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:3478" },
        { urls: "stun:stun2.l.google.com:3478" },
        { urls: "stun:stun3.l.google.com:3478" },
        { urls: "stun:stun4.l.google.com:3478" },
    ];

    const turnServers = process.env.REACT_APP_TURN_URL
        ? [
            {
                urls: `turn:${process.env.REACT_APP_TURN_URL}:3478`, // TURN over UDP
                username: "efA389S6BJFSNKYQP2", // Your TURN username
                credential: "dkvSztjG5Rs60Er0", // Your TURN password
            },
            {
                urls: `turn:${process.env.REACT_APP_TURN_URL}:80?transport=tcp`, // TURN over TCP
                username: "efA389S6BJFSNKYQP2",
                credential: "dkvSztjG5Rs60Er0",
            },
        ]
        : [];

    return {
        iceServers: [...stunServers, ...turnServers],
    };
};


export const newPeerConnection = (initiator: boolean) => {
    const stream = store.getState().videoChat.localStream
    console.log("Creating new peer connection. Initiator:", initiator, "Stream:", stream);

    if (!stream) {
        console.error("No local stream available. Cannot create peer connection.");
        throw new Error("No local stream");
    }

    const configuration = peerConfiguration();

    const peer = new Peer({
        initiator: initiator,
        trickle: false,
        config: configuration,
        stream: stream,
    });

    console.log("Peer connection created:", peer);
    return peer;
}

let peers: any = {};

export const prepareNewPeerConnection = (connUserSocketId: string, isInitiator: boolean) => {
    console.log("Preparing new peer connection. Initiator:", isInitiator, "Socket ID:", connUserSocketId);

    const localStream = store.getState().room.localStreamRoom;

    if (!localStream) {
        console.warn("No local stream available. Skipping peer preparation.");
        return;
    }

    if (isInitiator) {
        console.log("preparing new peer connection as initiator");
    } else {
        console.log("preparing new peer connection as not initiator");
    }

    console.log("Using local stream for peer connection:", localStream);

    peers[connUserSocketId] = new Peer({
        initiator: isInitiator,
        config: peerConfiguration(),
        stream: localStream!,
    });

    peers[connUserSocketId].on("signal", (data: Peer.SignalData) => {
        console.log("Generated signaling data for connection:", data);
        const signalData = {signal: data, connUserSocketId: connUserSocketId,};
        signalPeerData(signalData);
    });

    peers[connUserSocketId].on("stream", (remoteStream: any) => {
        // TODO
        console.log("Received remote stream from peer:", connUserSocketId, remoteStream);
        remoteStream.connUserSocketId = connUserSocketId;
        addNewRemoteStream(remoteStream);
    });
};

export const handleSignalingData = (data: {
    connUserSocketId: string;
    signal: Peer.SignalData;
}) => {
    console.log("Handling incoming signaling data:", data);
    const { connUserSocketId, signal } = data;

    if (peers[connUserSocketId]) {
        console.log("Adding signaling data to peer connection:", connUserSocketId);
        peers[connUserSocketId].signal(signal);
    } else {
        console.warn("Peer connection not found for:", connUserSocketId);
    }
};

const addNewRemoteStream = (remoteStream: MediaStream | Boolean) => {
    const remoteStreams = store.getState().room.remoteStreams;
    const newRemoteStreams = [...remoteStreams, remoteStream];

    store.dispatch(setRemoteStreams(newRemoteStreams) as any);
};

export const closeAllConnections = () => {
    Object.entries(peers).forEach((mappedObject) => {
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
