const Conversation = require("../models/Conversation");
const { updateChatHistory } = require("./notifyConnectedSockets");


const directChatHistoryHandler = async (socket, receiverUserId, currentPage) => {

    try {
        const senderUserId = socket.user.userId;
        console.log('[directChatHistoryHandler]', receiverUserId, currentPage)

        // get the conversation between the sender(logged in user) and receiver
        const conversation = await Conversation.findOne({
            participants: { $all: [receiverUserId, senderUserId] },
            type: "DIRECT",
        });

        if (!conversation) {
            return;
        }

        // update the chat history of the connecting user
        updateChatHistory(conversation._id.toString(), socket.id, currentPage);
    } catch (err) {
        console.log(err);
    }

}


module.exports = directChatHistoryHandler;