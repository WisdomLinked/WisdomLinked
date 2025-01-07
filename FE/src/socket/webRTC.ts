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
       // videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 }, // Adjusted for compatibility
                height: { ideal: 720 },
                facingMode: "user",
            },
            audio: false,
        });

    } catch (error) {
        console.error("Error capturing video stream:", error);
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

    const stream = store.getState().videoChat.localStream

    if (!stream) {
        throw new Error("No local stream");

    }

    console.log("from web ", stream);

    const configuration = peerConfiguration();
    const peer = new Peer({
        initiator: initiator,
        trickle: false,
        config: configuration,
        stream: stream,
    });



    return peer;
}


let peers: any = {};

//OG
// export const prepareNewPeerConnection = (connUserSocketId: string, isInitiator: boolean) => {
//     // connUserSocketId; -> who has joined the room
//
//     const localStream = store.getState().room.localStreamRoom;
//
//     if (isInitiator) {
//         console.log("preparing new peer connection as initiator");
//     } else {
//         console.log("preparing new peer connection as not initiator");
//     }
//
//     // if(!localStream) {
//     //     return
//     // }
//
//     console.log("localStream", localStream)
//
//     console.log("hello")
//
//     peers[connUserSocketId] = new Peer({
//         initiator: isInitiator,
//         config: peerConfiguration(),
//         stream: localStream!,
//     });
//
//     peers[connUserSocketId].on("signal", (data: Peer.SignalData) => {
//         const signalData = {
//             signal: data,
//             connUserSocketId: connUserSocketId,
//         };
//
//         signalPeerData(signalData);
//     });
//
//     peers[connUserSocketId].on("stream", (remoteStream: any) => {
//         // TODO
//         // add new remote stream (of connUserSocketId who has joined the room) to our server store
//         console.log("remote stream came from other user");
//         console.log("direct connection has been established");
//         remoteStream.connUserSocketId = connUserSocketId;
//         addNewRemoteStream(remoteStream);
//     });
// };
export const prepareNewPeerConnection = (connUserSocketId: string, isInitiator: boolean) => {
    const localStream = store.getState().room.localStreamRoom;

    console.log("Preparing peer connection", { isInitiator, localStream });

    // Handle stream properly for iOS devices
    if (!localStream) {
        console.error("Local stream not available for peer connection.");
        return;
    }

    peers[connUserSocketId] = new Peer({
        initiator: isInitiator,
        config: peerConfiguration(),
        stream: localStream,
    });

    peers[connUserSocketId].on("signal", (data: Peer.SignalData) => {
        const signalData = {
            signal: data,
            connUserSocketId: connUserSocketId,
        };
        signalPeerData(signalData);
    });

    peers[connUserSocketId].on("stream", (remoteStream: any) => {
        console.log("Received remote stream:", remoteStream);
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
