const { addNewActiveRoom } = require("../../socket/activeRooms");
const { updateRooms } = require("../notifyConnectedSockets");
const GroupChat = require("../../models/GroupChat");
const { getActiveConnections, getServerSocketInstance } = require("../../socket/connectedUsers");

const roomCreateHandler = async (socket, data) => {
  console.log("handling room create event");
  const socketId = socket.id;
  const { userId, username } = socket.user;

  const roomDetails = addNewActiveRoom(userId, username, socketId, data.groupId);
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
