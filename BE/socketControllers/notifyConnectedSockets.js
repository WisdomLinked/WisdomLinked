const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const FriendInvitation = require("../models/FriendInvitation");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const { getActiveConnections } = require("../socket/connectedUsers");
const { getServerSocketInstance } = require("../socket/connectedUsers");
const { getActiveRooms } = require("../socket/activeRooms");


const updateUsersInvitations = async (userId, isNew) => {

    if (isNew === "new") {
        console.log("new invitation");
    }


    // get the user's pending invitations
    const invitations = await FriendInvitation.find({
        receiverId: userId,
    }).populate("senderId", { username: 1, email: 1, _id: 1 });


    // get the users's active socket connections(socket ids)
    const activeConnections = getActiveConnections(userId);

    // send the list of invitations to all the active connections of this user(userId)

    const io = getServerSocketInstance();

    activeConnections.forEach(socketId => {
        io.to(socketId).emit("friend-invitations", invitations);
    })

}


const updateUsersGroupChatList = async (userId) => {
    // get the user's group chat list
    const user = await User.findById(userId).populate([
        {
            path: "groupChats",
            populate: {
                path: "participants",
                model: "User",
                select: "_id email username",
            },
        },
        {
            path: "pendingGroupChats",
            select: '_id name description start end duration price'
        },
        {
            path: "groupChats",
            populate: {
                path: "admin",
                model: "User",
                select: "_id email username role status",
            },
        },
        {
            path: "groupChats",
            populate: ["keywords", "services"]
        }
    ]);

    if (!user) {
        return;
    }

    const groupChats = user.groupChats
        ? user.groupChats.map((groupChat) => {
            return {
                groupId: groupChat._id,
                groupName: groupChat.name,
                description: groupChat.description,
                start: groupChat.start,
                end: groupChat.end,
                duration: groupChat.duration,
                price: groupChat.price,
                keywords: groupChat.keywords,
                services: groupChat.services,
                participants: groupChat.participants,
                admin: groupChat.admin,
                lastChatDate: groupChat?.updatedAt,
                missedChats: user.missedChats?.[groupChat._id] || 0
            };
        })
        : [];

    // get the users's active socket connections(socket ids)
    const activeConnections = getActiveConnections(userId);

    // send user's groupChats list to all the active connections of this user(userId)

    const io = getServerSocketInstance();

    activeConnections.forEach((socketId) => {
        io.to(socketId).emit("groupChats-list", groupChats || []);
    });
};


const updateUsersFriendsList = async (userId) => {
    // get the user's friends list
    const user = await User.findById(userId).populate("friends");

    if (!user) {
        return;
    }

    // const friends = user.friends
    //     ? user.friends.map((friend) => {
    //           return {
    //               id: friend._id,
    //               username: friend.username,
    //               email: friend.email,
    //           };
    //       })
    //     : [];

    const friends = []
    for (let i = 0; i < user.friends?.length; i++) {
        let friend = user.friends[i]
        const conversation = await Conversation.findOne({
            participants: { $all: [friend._id, userId] },
            type: "DIRECT",
        });
        let temp = {
            ...friend._doc,
            id: friend._id,
            password: null,
            friends: null,
            groupChats: null,
            missedChats: null,
            events: null,
            timeSlots: null,
            token: null,
            lastChatDate: conversation?.updatedAt,
            missedChats: user.missedChats?.[friend._id] || 0
        }
        friends.push(temp)
    }

    // get the users's active socket connections(socket ids)
    const activeConnections = getActiveConnections(userId);

    // send user's friends to all the active connections of this user(userId)

    const io = getServerSocketInstance();

    activeConnections.forEach((socketId) => {
        io.to(socketId).emit("friends-list", friends || []);
    });
};



const updateChatHistory = async (conversationId, toSpecificSocketId = null, currentPage) => {

    // get the conversation's chat history
    const conversation = await Conversation.findById(conversationId).populate({
        path: "messages",
        model: "Message",
        populate: {
            path: "author",
            select: "username _id image role status",
            model: "User",
        }
    });

    if (!conversation) {
        return;
    }

    const io = getServerSocketInstance();
    const limit = 20
    const messages = conversation.messages.reverse().slice(currentPage * limit, (currentPage + 1) * limit)

    if (toSpecificSocketId) {

        // initial chat history update
        return io.to(toSpecificSocketId).emit("direct-chat-history", {
            messages: messages,
            participants: conversation.participants
        });
    }


    // get the participant's active socket connections(socket ids)
    conversation.participants.forEach((participantId) => {

        const activeConnections = getActiveConnections(participantId.toString());

        // send the updated chat history to all the active connections of this user(participantId)
        activeConnections.forEach((socketId) => {
            io.to(socketId).emit("direct-chat-history", {
                messages: messages,
                participants: conversation.participants
            });
        });
    })
}


const sendNewDirectMessage = async (conversationId, newMessage) => {

    // get the conversation
    const conversation = await Conversation.findById(conversationId);

    const messageAuthor = await User.findById(newMessage.author);

    if (!messageAuthor || !conversation) {
        return;
    }

    const message = {
        __v: newMessage.__v,
        _id: newMessage._id,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt,
        type: newMessage.type,
        author: {
            _id: messageAuthor._id,
            username: messageAuthor.username,
        },
    };

    const io = getServerSocketInstance();


    // get the participant's active socket connections(socket ids)
    conversation.participants.forEach((participantId) => {
        console.log(participantId, '3333')
        const activeConnections = getActiveConnections(
            participantId.toString()
        );

        console.log(activeConnections, 'activeConnections')

        // send the new massage to all the active connections of this user(participantId)
        activeConnections.forEach((socketId) => {
            io.to(socketId).emit("direct-message", {
                newMessage: message,
                participants: conversation.participants,
            });
        });
    });
};


const sendNewGroupMessage = async (groupChatId, newMessage) => {

    // get the group chat
    const groupChat = await GroupChat.findById(groupChatId);

    const messageAuthor = await User.findById(newMessage.author);

    if (!messageAuthor || !groupChat) {
        return;
    }

    const message = {
        __v: newMessage.__v,
        _id: newMessage._id,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        updatedAt: newMessage.updatedAt,
        type: newMessage.type,
        author: {
            _id: messageAuthor._id,
            username: messageAuthor.username,
        },
    };

    const io = getServerSocketInstance();


    // get the participant's active socket connections(socket ids)
    groupChat.participants.forEach((participantId) => {
        const activeConnections = getActiveConnections(
            participantId.toString()
        );

        // send the new massage to all the active connections of this user(participantId)
        activeConnections.forEach((socketId) => {
            io.to(socketId).emit("group-message", {
                newMessage: message,
                groupChatId: groupChat._id.toString(),
            });
        });
    });
};


const updateRooms = (toSpecifiedSocketId = null) => {
    const io = getServerSocketInstance();
    const activeRooms = getActiveRooms();

    if (toSpecifiedSocketId) {
        io.to(toSpecifiedSocketId).emit("active-rooms", {
            activeRooms,
        });
    } else {
        io.emit("active-rooms", {
            activeRooms,
        });
    }
};


const initialRoomsUpdate = async (userId, socketId) => {

    const user = await User.findById(userId);

    if (!user) {
        return;
    }

    const io = getServerSocketInstance();
    const activeRooms = getActiveRooms();

    const rooms = [];

    activeRooms.forEach((room) => {
        const isRoomCreatedByMe = room.roomCreator.userId === userId;

        if (isRoomCreatedByMe) {
            rooms.push(room);
        } else {
            user.friends.forEach((f) => {
                if (f.toString() === room.roomCreator.userId.toString()) {
                    rooms.push(room);
                }
            });
        }
    });

    io.to(socketId).emit("active-rooms-initial", {
        activeRooms: rooms
    });

};



module.exports = {
    updateUsersInvitations,
    updateUsersFriendsList,
    updateUsersGroupChatList,
    updateChatHistory,
    sendNewDirectMessage,
    sendNewGroupMessage,
    updateRooms,
    initialRoomsUpdate
}