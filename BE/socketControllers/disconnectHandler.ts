const { leaveAllRooms } = require("../socket/activeRooms");
const { removeConnectedUser, getOnlineUsers } = require("../socket/connectedUsers");
const { updateRooms } = require("./notifyConnectedSockets");

const disconnectHandler = (socket, io) => {
    removeConnectedUser({ socketId: socket.id });

    // emit online users to all connected users
    io.emit("online-users", getOnlineUsers());

    const myActiveRooms = leaveAllRooms(socket.id)
    myActiveRooms.map((room) => {
        room.participants.forEach((participant) => {
          socket.to(participant.socketId).emit("room-participant-left", {
            connUserSocketId: socket.id,
          });
        });
    })
    
    updateRooms();
}

module.exports = disconnectHandler;