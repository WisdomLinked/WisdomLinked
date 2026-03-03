const { getServerSocketInstance, getActiveConnections } = require("../socket/connectedUsers");
const { checkIfTheEventOngoing } = require("../controllers/event.controller")

const callRequestHandler = (socket, data) => {
    const { receiverUserId, callerName, audioOnly, signal, eventId } = data;
    const callerUserId = socket.user.userId;
    const io = getServerSocketInstance();

    if (checkIfTheEventOngoing([callerUserId, receiverUserId], eventId)) {
        // active connections of the receiver user
        const activeConnections = getActiveConnections(receiverUserId);
    
        // send call request to all the active connections of the receiver user
    
        activeConnections.forEach((socketId) => {
            io.to(socketId).emit("call-request", { callerName, callerUserId, audioOnly, signal });
        });
    } else {
        const activeConnections = getActiveConnections(callerUserId);
        activeConnections.forEach((socketId) => {
            io.to(socketId).emit("cancelCallRequest");
        });
    }
}


module.exports = callRequestHandler