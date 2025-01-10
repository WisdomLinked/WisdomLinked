const GroupChat = require("../models/GroupChat");
const Message = require("../models/Message");
const {
    sendNewGroupMessage,
} = require("./notifyConnectedSockets");

const groupMessageHandler = async (socket, data) => {
    try {
        console.log("Received group message data:", data);
        const { groupChatId, message } = data;
        const senderUserId = socket.user.userId;

        console.log("Creating new group message:", { author: senderUserId, content: message });
        const newMessage = await Message.create({
            author: senderUserId,
            content: message,
            type: "GROUP",
        });
        console.log("New message created with ID:", newMessage._id);

        // check if groupChat exists
        const groupChat = await GroupChat.findOne({ _id: groupChatId });

        if (!groupChat) {
            console.log("Group chat not found for ID:", groupChatId);
            return;
        }

        console.log("Before updating groupChat messages:", groupChat.messages);
        // append the message to the conversation
        groupChat.messages = [...groupChat.messages, newMessage._id];
        await groupChat.save();
        console.log("Updated groupChat messages:", groupChat.messages);

        console.log("Notifying participants with new group message...");
        // update the chat of the participants with newly sent message
        sendNewGroupMessage(groupChat._id.toString(), newMessage);

    } catch (err) {
        console.log(err);
    }
};

module.exports = groupMessageHandler;
