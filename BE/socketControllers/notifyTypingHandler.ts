const { getActiveConnections } = require("../socket/connectedUsers");
const GroupChat = require("../models/GroupChat");

const notifyTypingHandler = async (socket, io, data) => {

    const { chatId, receiverId, typing } = data;

    if (receiverId) {

        const activeConnections = getActiveConnections(receiverId?.toString());

        activeConnections.forEach((socketId) => {
            io.to(socketId).emit("notify-typing", {
                chatId: null,
                senderUserId: socket.user.userId,
                typing
            });
        });
    } else if (chatId) {
        let groupChat = await GroupChat.findById(chatId);
        let participants = groupChat.participants;
        participants.map((participant) => {
            if (participant.toString() !== socket.user.userId) {
                const activeConnections = getActiveConnections(participant?.toString());

                activeConnections.forEach((socketId) => {
                    io.to(socketId).emit("notify-typing", {
                        chatId: chatId,
                        senderUserId: socket.user.userId,
                        typing
                    });
                });
            }
        })
    }
}


module.exports = notifyTypingHandler;