const { v4: uuidv4 } = require("uuid");
const { getActiveConnections, getServerSocketInstance } = require("./connectedUsers");
// const { updateRooms } = require("../socketControllers/notifyConnectedSockets");

let activeRooms = [];

const addNewActiveRoom = (userId, username, socketId, groupId) => {
    const newActiveRoom = {
        roomCreator: {
            userId,
            socketId,
            username
        },
        participants: [
            {
                userId,
                username,
                socketId,
            },
        ],
        kickedParticipants: [],
        mutedParticipants: [],
        selfMutedParticipants: [],
        roomId: uuidv4(),
        groupId: groupId
    };

    activeRooms = [...activeRooms, newActiveRoom];

    console.log(activeRooms);

    return newActiveRoom;
};

const appendKickedParticipant = (userId, roomId) => {
    const room = activeRooms.find((room) => room.roomId === roomId);
    activeRooms = activeRooms.filter((room) => room.roomId !== roomId);
    const updatedRoom = {
        ...room,
        kickedParticipants: [...room.kickedParticipants, userId],
    };
    activeRooms.push(updatedRoom);
}

const appendMutedParticipant = (userId, roomId) => {
    const room = activeRooms.find((room) => room.roomId === roomId);
    activeRooms = activeRooms.filter((room) => room.roomId !== roomId);
    const updatedRoom = {
        ...room,
        mutedParticipants: room?.mutedParticipants.indexOf(userId) > -1 ? room.mutedParticipants : [...room.mutedParticipants, userId],
    };
    activeRooms.push(updatedRoom);
}

const removeMutedParticipant = (userId, roomId) => {
    const room = activeRooms.find((room) => room.roomId === roomId);
    activeRooms = activeRooms.filter((room) => room.roomId !== roomId);
    let mutedParticipants = room?.mutedParticipants
    mutedParticipants.splice(room?.mutedParticipants.indexOf(userId), 1)
    const updatedRoom = {
        ...room,
        mutedParticipants: mutedParticipants,
    };
    activeRooms.push(updatedRoom);
}

const appendSelfMutedParticipant = (userId, roomId) => {
    const room = activeRooms.find((room) => room.roomId === roomId);
    activeRooms = activeRooms.filter((room) => room.roomId !== roomId);
    const updatedRoom = {
        ...room,
        selfMutedParticipants: room?.selfMutedParticipants.indexOf(userId) > -1 ? room.selfMutedParticipants : [...room.selfMutedParticipants, userId]
    };
    activeRooms.push(updatedRoom);
}

const removeSelfMutedParticipant = (userId, roomId) => {
    const room = activeRooms.find((room) => room.roomId === roomId);
    activeRooms = activeRooms.filter((room) => room.roomId !== roomId);
    let selfMutedParticipants = room?.selfMutedParticipants
    selfMutedParticipants.splice(room?.selfMutedParticipants.indexOf(userId), 1)
    const updatedRoom = {
        ...room,
        selfMutedParticipants: selfMutedParticipants,
    };
    activeRooms.push(updatedRoom);
}

const getActiveRooms = () => {
    return [...activeRooms];
};

const getActiveRoom = (roomId, groupId) => {
    const activeRoom = roomId? 
            activeRooms.find((activeRoom) => activeRoom.roomId === roomId) :
            activeRooms.find((activeRoom) => activeRoom.groupId === groupId);

    if (activeRoom) {
        return {
            ...activeRoom,
        };
    } else {
        return null;
    }
};

const joinActiveRoom = (roomId, newParticipant) => {
    const room = activeRooms.find((room) => room.roomId === roomId);
    console.log("room has been found");

    activeRooms = activeRooms.filter((room) => room.roomId !== roomId);
    console.log(activeRooms);

    const updatedRoom = {
        ...room,
        participants: [...room?.participants, newParticipant],
    };

    activeRooms.push(updatedRoom);
};

const leaveActiveRoom = (roomId, participantSocketId, groupId) => {
    const activeRoom = roomId? 
        activeRooms.find((activeRoom) => activeRoom.roomId === roomId) :
        activeRooms.find((activeRoom) => activeRoom.groupId === groupId);

    if (activeRoom) {
        const copyOfActiveRoom = { ...activeRoom };

        copyOfActiveRoom.participants = copyOfActiveRoom.participants.filter(
            (participant) => participant.socketId !== participantSocketId
        );

        activeRooms = activeRooms.filter((room) => roomId? room.roomId !== roomId : room.groupId !== groupId);

        if (copyOfActiveRoom.participants.length > 0) {
            activeRooms.push(copyOfActiveRoom);
        }
    }
};

const leaveAllRooms = (connectedSocketId) => {
    const myActiveRooms = []
    const updatedActiveRooms = activeRooms.map((room) => {
        const updatedRoom = {
            ...room,
            participants: room.participants.filter((participant) => {
                return participant.socketId !== connectedSocketId;
            })
        }
        if (room.participants?.findIndex(x => x.socketId === connectedSocketId) > -1) {
            myActiveRooms.push(updatedRoom)
        }
        return updatedRoom
    })

    activeRooms = updatedActiveRooms;
    return myActiveRooms
}

const updateActiveRoomsOfUsers = (userId, groupChats) => {
    groupChats.map(groupChat => {
        const activeRoom = activeRooms.find((room) => room.groupId === groupChat._id.toString());
        if (activeRoom) {
            const activeConnections = getActiveConnections(userId)
            activeConnections.forEach((socketId) => {
                const io = getServerSocketInstance();
                io.to(socketId).emit("active-rooms", {
                    activeRooms,
                });
                
            });
        }
    })
}

module.exports = {
    addNewActiveRoom,
    getActiveRooms,
    getActiveRoom,
    joinActiveRoom,
    leaveActiveRoom,
    leaveAllRooms,
    updateActiveRoomsOfUsers,
    appendKickedParticipant,
    appendMutedParticipant,
    removeMutedParticipant,
    appendSelfMutedParticipant,
    removeSelfMutedParticipant
};
