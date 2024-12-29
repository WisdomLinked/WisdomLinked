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


// const peerConfiguration = () => {
//
//     if (process.env.REACT_APP_TURN_URL) {
//         console.log("Using only TURN server");
//         return {
//             iceServers: [
//                 {
//                     urls: [
//                         `turn:${process.env.REACT_APP_TURN_URL}:3478?transport=udp`,
//                         `turn:${process.env.REACT_APP_TURN_URL}:80?transport=tcp`
//                     ],
//                     username: "efA389S6BJFSNKYQP2",
//                     credential: "dkvSztjG5Rs60Er0"
//                 }
//             ]
//         }
//     } else {
//         console.log("Using only STUN server");
//         return {
//             iceServers: [
//                 {
//                     urls: "stun:stun.l.google.com:19302",
//                 },
//             ],
//         };
//     }
// };

// const peerConfiguration = () => {
//     const iceServers = [];
//
//     // Add STUN server first
//     iceServers.push({
//         urls: "stun:stun.l.google.com:19302",
//     });
//
//     // If TURN server is available, add it after STUN
//     if (process.env.REACT_APP_TURN_URL) {
//         console.log("Using both STUN and TURN servers");
//         iceServers.push({
//             urls: [
//                 `turn:${process.env.REACT_APP_TURN_URL}:3478?transport=udp`,
//                 `turn:${process.env.REACT_APP_TURN_URL}:80?transport=tcp`,
//             ],
//             username: "efA389S6BJFSNKYQP2",
//             credential: "dkvSztjG5Rs60Er0",
//         });
//     } else {
//         console.log("Using only STUN server");
//     }
//
//     return {
//         iceServers,
//     };
// };

const peerConfiguration = () => {
    const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
        // Google STUN servers
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.l.google.com:5349" },
        { urls: "stun:stun1.l.google.com:3478" },
        { urls: "stun:stun1.l.google.com:5349" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:5349" },
        { urls: "stun:stun3.l.google.com:3478" },
        { urls: "stun:stun3.l.google.com:5349" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:5349" },

        // Additional STUN servers
        { urls: "stun:23.21.150.121:3478" },
        { urls: "stun:iphone-stun.strato-iphone.de:3478" },
        { urls: "stun:numb.viagenie.ca:3478" },
        { urls: "stun:s1.taraba.net:3478" },
        { urls: "stun:s2.taraba.net:3478" },
        { urls: "stun:stun.12connect.com:3478" },
        { urls: "stun:stun.12voip.com:3478" },
        { urls: "stun:stun.1und1.de:3478" },
        { urls: "stun:stun.2talk.co.nz:3478" },
        { urls: "stun:stun.2talk.com:3478" },
        { urls: "stun:stun.3clogic.com:3478" },
        { urls: "stun:stun.3cx.com:3478" },
        { urls: "stun:stun.a-mm.tv:3478" },
        { urls: "stun:stun.aa.net.uk:3478" },
        { urls: "stun:stun.acrobits.cz:3478" },
        { urls: "stun:stun.actionvoip.com:3478" },
        { urls: "stun:stun.advfn.com:3478" },
        { urls: "stun:stun.aeta-audio.com:3478" },
        { urls: "stun:stun.aeta.com:3478" },
        { urls: "stun:stun.alltel.com.au:3478" },
        { urls: "stun:stun.altar.com.pl:3478" },
        { urls: "stun:stun.annatel.net:3478" },
        { urls: "stun:stun.antisip.com:3478" },
        { urls: "stun:stun.arbuz.ru:3478" },
    ];

    // Add TURN server if available
    if (process.env.REACT_APP_TURN_URL) {
        console.log("Using both STUN and TURN servers");
        iceServers.push({
            urls: [
                `turn:${process.env.REACT_APP_TURN_URL}:3478?transport=udp`,
                `turn:${process.env.REACT_APP_TURN_URL}:80?transport=tcp`,
            ],
            username: "efA389S6BJFSNKYQP2",
            credential: "dkvSztjG5Rs60Er0",
        });
    } else {
        console.log("Using only STUN servers");
    }

    return {
        iceServers,
    };
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