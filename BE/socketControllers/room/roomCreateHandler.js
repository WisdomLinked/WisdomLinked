const { addNewActiveRoom } = require("../../socket/activeRooms");
const { updateRooms } = require("../notifyConnectedSockets");
const GroupChat = require("../../models/GroupChat");
const { getActiveConnections, getServerSocketInstance } = require("../../socket/connectedUsers");

const roomCreateHandler = async (socket, data) => {
  console.log("handling room create event");
  const socketId = socket.id;
  const { userId, username } = socket.user;

  const { getActiveRoom, joinActiveRoom } = require("../../socket/activeRooms");
  let roomDetails = getActiveRoom(null, data.groupId);

  if (roomDetails) {
    console.log("Room already exists, converting create request to join request");
    const participantDetails = { userId, socketId, username };

    const alreadyInRoom = roomDetails.participants.find(p => p.socketId === socketId);
    if (!alreadyInRoom) {
      joinActiveRoom(roomDetails.roomId, participantDetails);

      roomDetails.participants.forEach((participant) => {
        if (participant.socketId !== socketId) {
          socket.to(participant.socketId).emit("conn-prepare", {
            connUserSocketId: socketId,
          });
        }
      });
    }
  } else {
    roomDetails = addNewActiveRoom(userId, username, socketId, data.groupId);
  }

  socket.emit("room-create", {
    roomDetails
  });

  const groupChat = await GroupChat.findById(data.groupId);
  if (groupChat) {

    // Check if this groupChat is ongoing
    // TODO
    const io = getServerSocketInstance();
    groupChat.participants.forEach((participantId) => {
      const activeConnections = getActiveConnections(
        participantId.toString()
      );

      // send the new massage to all the active connections of this user(participantId)
      activeConnections.forEach((socketId) => {
        updateRooms(socketId);
      });
    });
  }

};

module.exports = roomCreateHandler;
