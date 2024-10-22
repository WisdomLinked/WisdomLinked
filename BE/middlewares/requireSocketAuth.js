const jwt = require("jsonwebtoken");
const UserModel = require('../models/User')
const config = process.env;

const requireSocketAuth = async (socket, next) => {
    let email = socket.handshake.auth?.email

    try {

        if (!email) {
            throw new Error("A authentication is required for authentication");
        }

        const user = await UserModel.findOne({
            email: email
        }).select("+token");

        if (!user) {
            throw new Error("A authentication is required for authentication");
        }
        const accessToken = user.token
        if (!accessToken) {
            throw new Error("cookie has been expired");
        }
        if (user.status === 'blocked') {
            throw new Error("User is blocked");
        }
        const decodedAccessToken = jwt.verify(accessToken, process.env.JWT_SECRET)
        const now = Math.floor((new Date()).getTime() / 1000)
        if (now >= decodedAccessToken.exp)
            throw new Error("Cookie Expired");

        socket.user = { email: user.email, userId: user._id.toString() }
    } catch (err) {
        const error = new Error("403, Not authorized");
        return error;
    }

    return next();
};

module.exports = requireSocketAuth;
