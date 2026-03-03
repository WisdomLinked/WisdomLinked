const {
    getServerSocketInstance,
    getActiveConnections,
} = require("../socket/connectedUsers");

const notifyChatLeft = (socket, data) => {
    const { receiverUserId, fromOngoing } = data;
    const { userId } = socket.user;
    console.log(userId, 'left the chat with', receiverUserId);

    // active connections of the receiver user
    const activeConnections = getActiveConnections(receiverUserId);

    // send call response(accepted or rejected) to all the active connections of the receiver user
    const io = getServerSocketInstance();

    activeConnections.forEach((socketId) => {
        io.to(socketId).emit("notify-chat-left", {userId, fromOngoing});
    });
};

module.exports = notifyChatLeft;
