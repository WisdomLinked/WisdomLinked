const GroupChat = require("../models/GroupChat");
const { getServerSocketInstance } = require("../socket/connectedUsers");

const groupChatHistoryHandler = async (socket, groupChatId, currentPage) => {
    try {
        // get the group chat
        const groupChat = await GroupChat.findById(groupChatId).populate({
            path: "messages",
            model: "Message",
            populate: {
                path: "author",
                select: "username _id image role status",
                model: "User"
            }
        });

        if (!groupChat) {
            return;
        }

        const io = getServerSocketInstance();
        const limit = 20
        const messages = groupChat.messages.reverse().slice(currentPage * limit, (currentPage + 1) * limit)

        // initial chat history update
        return io.to(socket.id).emit("group-chat-history", {
            messages: messages,
            groupChatId: groupChat._id.toString(),
        });

    } catch (err) {
        console.log(err);
    }
};

module.exports = groupChatHistoryHandler;
