// webRTC.ts
import Peer from "simple-peer";
import { store } from "../store";

// Actions
import { setLocalStreamRoom, setRemoteStreams } from "../actions/roomActions";
import { setLocalStream } from "../actions/videoChatActions";
import { showAlert } from "../actions/alertActions";
import { actionTypes } from "../actions/types";

// Socket
import { signalPeerData } from "./socketConnection";

/**
 * Attempt to get local camera/mic stream(s).
 * This function tries to get them separately (video-only, audio-only),
 * which you then combine or pick constraints from.
 */
const getLocalStream = async () => {
    let videoStream: MediaStream | undefined;
    let audioStream: MediaStream | undefined;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        console.log("[getLocalStream] Successfully got video stream:", videoStream);
    } catch (err) {
        console.warn("[getLocalStream] Unable to get video stream:", err);
    }
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("[getLocalStream] Successfully got audio stream:", audioStream);
    } catch (err) {
        console.warn("[getLocalStream] Unable to get audio stream:", err);
    }
    return { videoStream, audioStream };
};

/**
 * Just a helper to check if you have any local devices available.
 * (Not used often, but you can keep it if needed.)
 */
export const checkLocalAudioVideoStreams = async () => {
    const { videoStream, audioStream } = await getLocalStream();
    store.dispatch({
        type: actionTypes.setLocalStreamAvailability,
        payload: {
            videoStream,
            audioStream,
        },
    });
};

/**
 * The main function used in your call flow.
 * - If audioOnly=false, we want to request {audio:true,video:true}.
 * - If audioOnly=true, we request {audio:true,video:false}.
 * - If room=true, we're in a "room seminar" scenario, so we store the result in roomActions.
 * - If room=false, store in videoChatActions (setLocalStream).
 */
export const getLocalStreamPreview = async (
    audioOnly: boolean,
    onSuccessCallback?: () => void,
    room?: boolean,
    onErrorCallback?: (err: any) => any
) => {
    // Decide constraints based on audioOnly
    const constraints = audioOnly
        ? { audio: true, video: false }
        : { audio: true, video: true };

    console.log("[getLocalStreamPreview] constraints:", constraints);

    // Actually request the combined stream
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
            console.log("[getLocalStreamPreview] Successfully got user media:", stream);
            if (room) {
                store.dispatch(setLocalStreamRoom(stream) as any);
            } else {
                store.dispatch(setLocalStream(stream) as any);
            }

            if (onSuccessCallback) {
                onSuccessCallback();
            }
        })
        .catch((err) => {
            console.error("[getLocalStreamPreview] Error getting local stream:", err);
            store.dispatch(
                showAlert(
                    room
                        ? "You don't have any media devices. Please check your microphone and camera."
                        : audioOnly
                            ? "You don't have any audio devices. Please check your microphone."
                            : "You don't have any video devices. Please check your camera."
                )
            );
            if (onErrorCallback) {
                onErrorCallback(err);
            }
        });
};

/**
 * Configure STUN/TURN servers.
 * If you have a TURN server, set REACT_APP_TURN_URL in .env
 * and it will add it below.
 */
const peerConfiguration = () => {
    const iceServers: RTCIceServer[] = [
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
        // (plus all the other STUNs you listed) ...
    ];

    // Add TURN server if available
    if (process.env.REACT_APP_TURN_URL) {
        console.log("[peerConfiguration] Using both STUN and TURN servers");
        iceServers.push({
            urls: [
                `turn:${process.env.REACT_APP_TURN_URL}:3478?transport=udp`,
                `turn:${process.env.REACT_APP_TURN_URL}:80?transport=tcp`,
            ],
            username: "efA389S6BJFSNKYQP2",
            credential: "dkvSztjG5Rs60Er0",
        });
    } else {
        console.log("[peerConfiguration] Using only STUN servers");
    }

    return { iceServers };
};

/**
 * For 1-to-1 calls (not the "room" scenario), we get the local
 * stream from store.getState().videoChat.localStream
 */
export const newPeerConnection = (initiator: boolean) => {
    const stream = store.getState().videoChat.localStream;
    if (!stream) {
        throw new Error("No local stream in store.videoChat.localStream. Did you call getLocalStreamPreview()?");
    }
    console.log("[newPeerConnection] localStream for call is:", stream);

    const configuration = peerConfiguration();
    const peer = new Peer({
        initiator,
        trickle: false,
        config: configuration,
        stream: stream,
    });

    return peer;
};

/**
 * For "room" scenarios. We store multiple peers in 'peers' obj.
 * key: connUserSocketId
 * value: the Peer instance
 */
let peers: Record<string, Peer.Instance> = {};

/**
 * Called when someone joins a room, to set up a new peer connection for them.
 * If isInitiator=true, you create the Peer with {initiator:true}, else false.
 */
export const prepareNewPeerConnection = (connUserSocketId: string, isInitiator: boolean) => {
    console.log("[prepareNewPeerConnection] socketId:", connUserSocketId, "isInitiator:", isInitiator);

    const localStream = store.getState().room.localStreamRoom;
    console.log("[prepareNewPeerConnection] localStreamRoom is:", localStream);

    peers[connUserSocketId] = new Peer({
        initiator: isInitiator,
        config: peerConfiguration(),
        trickle: false,
        stream: localStream || undefined,
    });

    peers[connUserSocketId].on("signal", (signalData: Peer.SignalData) => {
        console.log(`[prepareNewPeerConnection -> on.signal] for ${connUserSocketId}`);
        signalPeerData({
            signal: signalData,
            connUserSocketId: connUserSocketId,
        });
    });

    peers[connUserSocketId].on("stream", (remoteStream: MediaStream) => {
        console.log(
            `[prepareNewPeerConnection -> on.stream] remote stream from ${connUserSocketId}`,
            remoteStream
        );
        remoteStream.connUserSocketId = connUserSocketId as any;
        addNewRemoteStream(remoteStream);
    });

    peers[connUserSocketId].on("error", (err) => {
        console.error(`[prepareNewPeerConnection -> on.error] Peer error from ${connUserSocketId}:`, err);
    });
};

/**
 * When we get 'conn-signal' from the server, we pass it to the correct peer
 */
export const handleSignalingData = (data: { connUserSocketId: string; signal: Peer.SignalData }) => {
    const { connUserSocketId, signal } = data;
    console.log("[handleSignalingData]", data);

    const peer = peers[connUserSocketId];
    if (peer) {
        console.log("[handleSignalingData] signaling the existing peer");
        peer.signal(signal);
    } else {
        console.warn("[handleSignalingData] no peer found for connUserSocketId:", connUserSocketId);
    }
};

/**
 * Add the new remote stream into the Redux store under room.remoteStreams
 */
const addNewRemoteStream = (remoteStream: MediaStream) => {
    console.log("[addNewRemoteStream] Called with:", remoteStream);
    const remoteStreams = store.getState().room.remoteStreams;
    const newRemoteStreams = [...remoteStreams, remoteStream];
    store.dispatch(setRemoteStreams(newRemoteStreams) as any);

    // NOTE: This means your React UI must subscribe to room.remoteStreams
    // and attach each new stream to a <video> element to display it.
};

/**
 * Close out all existing Peer connections in the 'peers' object
 */
export const closeAllConnections = () => {
    console.log("[closeAllConnections] Closing all peer connections");
    Object.entries(peers).forEach(([connUserSocketId, peer]) => {
        console.log(`Destroying peer for socketId: ${connUserSocketId}`);
        peer.destroy();
        delete peers[connUserSocketId];
    });
    console.log("[closeAllConnections] All peer connections closed.");
};

/**
 * Called by 'room-participant-left' event if the server tells us the user left
 */
export const handleParticipantLeftRoom = (data: { connUserSocketId: string }) => {
    const { connUserSocketId } = data;
    const peer = peers[connUserSocketId];

    if (peer) {
        console.log(`[handleParticipantLeftRoom] Destroying peer for ${connUserSocketId}`);
        peer.destroy();
        delete peers[connUserSocketId];
    } else {
        console.log(`[handleParticipantLeftRoom] No peer connection found for ${connUserSocketId}`);
    }

    const remoteStreams = store.getState().room.remoteStreams;
    const newRemoteStreams = remoteStreams.filter(
        (stream: any) => stream.connUserSocketId !== connUserSocketId
    );
    store.dispatch(setRemoteStreams(newRemoteStreams) as any);
    console.log("[handleParticipantLeftRoom] Updated remoteStreams after participant left.");
};

/**
 * Switch tracks if, e.g., user toggles camera or changes mic.
 * This replaces the outgoing track in every peer with the new track(s).
 */
export const switchOutgoingTracks = (stream: MediaStream) => {
    console.log("[switchOutgoingTracks] Replacing tracks for all existing peers.");
    for (const socketId in peers) {
        const peer = peers[socketId];
        if (!peer || !peer.streams[0]) continue;

        const oldTracks = peer.streams[0].getTracks();
        const newTracks = stream.getTracks();

        for (let oldTrack of oldTracks) {
            // find matching kind from newTracks
            const matchingNewTrack = newTracks.find((t) => t.kind === oldTrack.kind);
            if (matchingNewTrack) {
                console.log(`[switchOutgoingTracks] Replacing track ${oldTrack.kind} in peer for ${socketId}`);
                peer.replaceTrack(oldTrack, matchingNewTrack, peer.streams[0]);
            }
        }
    }
};

/**
 * ===========================================
 * If you get "process is not defined" error:
 * 1) Make sure "simple-peer" is an up-to-date version,
 *    or:
 * 2) Add a polyfill for process:
 *    npm install process
 *    import process from "process";
 *    (window as any).process = process;
 * Or adjust your bundler config for Node polyfills.
 * ===========================================
 */
