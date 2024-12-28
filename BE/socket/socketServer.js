const socket = require("socket.io");
const requireSocketAuth = require("../middlewares/requireSocketAuth");
const callRequestHandler = require("../socketControllers/callRequestHandler");
const callResponseHandler = require("../socketControllers/callResponseHandler");
const directChatHistoryHandler = require("../socketControllers/directChatHistoryHandler");
const directMessageHandler = require("../socketControllers/directMessageHandler");
const disconnectHandler = require("../socketControllers/disconnectHandler");
const groupMessageHandler = require("../socketControllers/groupMessageHandler");
const newConnectionHandler = require("../socketControllers/newConnectionHandler");
const notifyChatLeft = require("../socketControllers/notifyChatLeft");
const notifyTypingHandler = require("../socketControllers/notifyTypingHandler");
const { setServerSocketInstance, getOnlineUsers, getActiveConnections } = require("./connectedUsers");
const groupChatHistoryHandler = require("../socketControllers/groupChatHistoryHandler");
const roomJoinHandler = require("../socketControllers/room/roomJoinHandler");
const roomCreateHandler = require("../socketControllers/room/roomCreateHandler");
const {
    roomLeaveHandler, 
    kickCustomerFromRoomHandler, 
    forceMuteCustomerFromRoomHandler, 
    enableAudioCustomerFromRoomHandler,
    setAudioStatusInRoomHandler
} = require("../socketControllers/room/roomLeaveHandler");
const roomSignalingDataHandler = require("../socketControllers/room/roomSignalingDataHandler");
const roomInitializeConnectionHandler = require("../socketControllers/room/roomInitializeConnectionHandler");


const createSocketServer = (server) => {
    const io = socket(server, {
        cors: {
            origin: [process.env.FE_URL],
            methods: ["GET", "POST"],
        },
    });

    setServerSocketInstance(io);

    // check authentication of user
    io.use((socket, next) => {
        requireSocketAuth(socket, next);
    });

    io.on("connection", (socket) => {
        console.log(socket.user)
        console.log(`[SOCKET SERVER] New connection established: ${socket.id}`);
        newConnectionHandler(socket, io);

        socket.on("direct-message", (data) => {
            console.log("[SOCKET SERVER] Received direct message event", data);
            directMessageHandler(socket, data);
        })
        
        socket.on("setRemoteVideoAudioStatus", (data) => {
            const activeConnections = getActiveConnections(data.otherUserId);
            activeConnections.forEach((socketId) => {
                io.to(socketId).emit("setRemoteVideoAudioStatus", data);
            });
        })
        
        socket.on("cancelCallRequest", (data) => {
            const activeConnections = getActiveConnections(data.otherUserId);
            activeConnections.forEach((socketId) => {
                io.to(socketId).emit("cancelCallRequest");
            });
        })

        socket.on("group-message", (data) => {
            groupMessageHandler(socket, data);
        });

        socket.on("direct-chat-history", (data) => {
            directChatHistoryHandler(socket, data.receiverUserId, data.currentPage);
        });

        socket.on("group-chat-history", (data) => {
            groupChatHistoryHandler(socket, data.groupChatId, data.currentPage);
        });


        socket.on("notify-typing", (data) => {
            notifyTypingHandler(socket, io, data);
        });

        socket.on("call-request", (data) => {
            console.log("[SOCKET SERVER] Received call request", data);
            callRequestHandler(socket, data);
        })

        socket.on("call-response", (data) => {
            console.log("[SOCKET SERVER] Received call response", data);
            callResponseHandler(socket, data);
        })

        socket.on("notify-chat-left", (data) => {
            notifyChatLeft(socket, data);
        });


        // rooms 

        socket.on("room-create", (data) => {
            roomCreateHandler(socket, data);
        });

        socket.on("room-join", (data) => {
            roomJoinHandler(socket, data);
        });

        socket.on("room-leave", (data) => {
            roomLeaveHandler(socket, data);
        });

        socket.on("kickCustomerFromRoom", (data) => {
            kickCustomerFromRoomHandler(socket, data);
        });

        socket.on("forceMuteCustomerFromRoom", (data) => {
            forceMuteCustomerFromRoomHandler(socket, data);
        });

        socket.on("enableAudioCustomerFromRoom", (data) => {
            enableAudioCustomerFromRoomHandler(socket, data);
        });

        socket.on("setAudioStatusInRoom", (data) => {
            setAudioStatusInRoomHandler(socket, data);
        });

        socket.on("conn-init", (data) => {
            roomInitializeConnectionHandler(socket, data);
        });

        socket.on("conn-signal", (data) => {
            roomSignalingDataHandler(socket, data);
        });

        socket.on("log-out", () => {
            console.log(`Connected socket LOGGED OUT: ${socket.id}`);
            disconnectHandler(socket, io);
        });

        socket.on("disconnect", () => {
            console.log(`[SOCKET SERVER] Socket disconnected: ${socket.id}`);
            disconnectHandler(socket, io);
        });
    });

    // emit online users to all connected users every 10 seconds
    // setInterval(() => {
    //     io.emit("online-users", getOnlineUsers());
    // }, 10 * 1000)
};

module.exports = {
    createSocketServer,
}
