    require("dotenv").config();

    const express = require("express");
    const http = require("http");
    const cors = require("cors");
    const mongoose = require("mongoose");
    const cookieParser = require("cookie-parser");
    const path = require("path");
    const imageUploadRoutes = require("./routes/imageUploadRoutes");
    const fetchImageRoute = require("./routes/fetchImageRoute");

    const authRoutes = require("./routes/authRoutes");
    const friendInvitationRoutes = require("./routes/friendInvitationRoutes");
    const groupChatRoutes = require("./routes/groupChatRoutes")
    const expertRoutes = require("./routes/expertRoutes")
    const customerRoutes = require("./routes/customerRoutes")
    const adminRoutes = require("./routes/adminRoutes")
    const contactRoutes = require("./routes/contactRoutes")
    const meetingAnalyticsRoutes = require("./routes/meetingAnalyticsRoutes");

    const { appendDefaultServices, appendAdminUserAndGroupChat, initAppStates } = require('./initDB')

    const { createSocketServer } = require("./socket/socketServer");

    const PORT = process.env.PORT || 5000;

    const MONGO_URI = process.env.MONGO_URI

    mongoose
        .connect(MONGO_URI)
        .then(() => {
            console.log("Connected to MongoDB Server");
            appendDefaultServices()
            appendAdminUserAndGroupChat()
            initAppStates()
        })
        .catch((err) => {
            console.log("database connection failed. Server not started");
            console.error(err);
        });

    const app = express();
    const maxRequestBodySize = process.env.MAX_REQUEST_BODY_SIZE || '1mb';
    app.use(express.json({ limit: maxRequestBodySize }));
    app.use(express.urlencoded({ limit: maxRequestBodySize }));
    app.use(cookieParser());
    app.use(express.json());
    app.use(cors({
        origin: process.env.FE_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }));

    // register the routes
    app.use("/api/auth", authRoutes);
    app.use("/api/invite-friend", friendInvitationRoutes);
    app.use("/api/group-chat", groupChatRoutes);
    app.use("/api/expert", expertRoutes);
    app.use("/api/customer", customerRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/image-upload", imageUploadRoutes);
    app.use("/api/image-fetch", fetchImageRoute);
    app.use("/api", contactRoutes);
    app.use("/api/meeting-analytics", meetingAnalyticsRoutes);

    app.use(express.static('./uploads'));
    app.get('/uploads/*', (req, res) => {
        const fileName = path.basename(req.path);
        res.sendFile(decodeURI(fileName), { root: path.join(__dirname, `.${req.path.replace(fileName, '')}`) });
    });


    app.use(express.static('../FE/build'));
    app.get('/*', (req, res) => {
        res.sendFile('index.html', { root: path.join(__dirname, '../FE/build/') });
    });

    var httpServer = require('http').Server(app)
    httpServer.listen(PORT, function () {
        console.log(`App listening on port ${PORT}.`);
    });

    // socket connection
    createSocketServer(httpServer);