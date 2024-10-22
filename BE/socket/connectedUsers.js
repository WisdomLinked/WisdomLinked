// const connectedUsers = new Map();
let connectedUsers = [];
let io = null;

const addNewConnectedUser = ({ socketId, userId }) => {
    // connectedUsers.set(socketId, { userId });
    connectedUsers.push({
        userId: userId,
        socketId: socketId
    })
    console.log('Total active connections:', connectedUsers.length);
};

const removeConnectedUser = ({ socketId }) => {
    // if (connectedUsers.has(socketId)) {
    //     connectedUsers.delete(socketId);
    // }
    let index = connectedUsers.findIndex(x => x.socketId === socketId)
    if (index > -1) {
        connectedUsers.splice(index, 1)
    }
};

// get active connections of a particular user
const getActiveConnections = (userId) => {
    // get user's socket ids(active socket connections)
    const activeConnections = [];
    
    // connectedUsers.forEach((value, key) => {
    //     if (value.userId === userId) {
    //         activeConnections.push(key);
    //     }
    // });

    connectedUsers.map((user) => {
        if (user.userId === userId)
            activeConnections.push(user.socketId)
    })

    return activeConnections;
};

const getOnlineUsers = () => {
    // const onlineUsers = [];

    // connectedUsers.forEach((value, key) => {
    //     onlineUsers.push({
    //         userId: value.userId,
    //         socketId: key,
    //     });
    // });

    // return onlineUsers;
    return connectedUsers
};

const setServerSocketInstance = (ioInstance) => {
    io = ioInstance;
};

const getServerSocketInstance = () => {
    return io;
};

module.exports = {
    addNewConnectedUser,
    removeConnectedUser,
    getActiveConnections,
    setServerSocketInstance,
    getServerSocketInstance,
    getOnlineUsers,
};
