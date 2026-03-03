const { 
  getActiveRoom, 
  leaveActiveRoom, 
  appendKickedParticipant, 
  appendMutedParticipant, 
  removeMutedParticipant,
  appendSelfMutedParticipant, 
  removeSelfMutedParticipant,
} = require("../../socket/activeRooms");
const { getActiveConnections } = require("../../socket/connectedUsers");
const { updateRooms } = require("../notifyConnectedSockets");

const roomLeaveByConnCloseHandler = (socket, groupId) => {

  const activeRoom = getActiveRoom(null, groupId);

  if (activeRoom) {
    leaveActiveRoom(null, socket.id, groupId);

    const updatedActiveRoom = getActiveRoom(groupId);

    if (updatedActiveRoom) {
      updatedActiveRoom.participants.forEach((participant) => {
        socket.to(participant.socketId).emit("room-participant-left", {
          connUserSocketId: socket.id,
        });
      });
    }

    updateRooms();
  }
};

const roomLeaveHandler = (socket, data) => {
  const { roomId } = data;

  const activeRoom = getActiveRoom(roomId);

  if (activeRoom) {
    leaveActiveRoom(roomId, socket.id);

    const updatedActiveRoom = getActiveRoom(roomId);

    if (updatedActiveRoom) {
      updatedActiveRoom.participants.forEach((participant) => {
        socket.to(participant.socketId).emit("room-participant-left", {
          connUserSocketId: socket.id,
        });
      });
    }

    updateRooms();
  }
};

const kickCustomerFromRoomHandler = (socket, data) => {
  const { customerId, roomId } = data;
  const activeConnections = getActiveConnections(customerId)
  const activeRoom = getActiveRoom(roomId);
  appendKickedParticipant(customerId, roomId)
  if (activeRoom) {
    activeConnections?.map((socketId) => {
      socket.to(socketId).emit("kicked-off-by-expert")
    })
  }

  updateRooms()
};

const forceMuteCustomerFromRoomHandler = (socket, data) => {
  const { customerId, roomId } = data;
  const activeConnections = getActiveConnections(customerId)
  const activeRoom = getActiveRoom(roomId);
  console.log(customerId, roomId, activeRoom, activeConnections)
  appendMutedParticipant(customerId, roomId)
  if (activeRoom) {
    activeConnections?.map((socketId) => {
      socket.to(socketId).emit("muted-by-expert")
    })
  }

  updateRooms()
};

const enableAudioCustomerFromRoomHandler = (socket, data) => {
  const { customerId, roomId } = data;
  const activeConnections = getActiveConnections(customerId)
  const activeRoom = getActiveRoom(roomId);
  console.log(customerId, roomId, activeRoom, activeConnections)
  removeMutedParticipant(customerId, roomId)
  if (activeRoom) {
    activeConnections?.map((socketId) => {
      socket.to(socketId).emit("enabled-audio-by-expert")
    })
  }

  updateRooms()
};

const setAudioStatusInRoomHandler = (socket, data) => {
  const { customerId, roomId, audioStatus } = data;
  if (!audioStatus) {
    appendSelfMutedParticipant(customerId, roomId)
  } else {
    removeSelfMutedParticipant(customerId, roomId)
  }
  updateRooms()
};

module.exports = {
  roomLeaveHandler,
  kickCustomerFromRoomHandler,
  forceMuteCustomerFromRoomHandler,
  enableAudioCustomerFromRoomHandler,
  setAudioStatusInRoomHandler,
};
