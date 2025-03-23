require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const friendInvitationRoutes = require("./routes/friendInvitationRoutes");
const groupChatRoutes = require("./routes/groupChatRoutes")
const expertRoutes = require("./routes/expertRoutes")
const customerRoutes = require("./routes/customerRoutes")
const adminRoutes = require("./routes/adminRoutes")
const { appendDefaultServices, appendAdminUser, initAppStates } = require('./initDB')

const { createSocketServer } = require("./socket/socketServer");

const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log("Connected to MongoDB Server");
        appendDefaultServices()
        appendAdminUser()
        initAppStates()
    })
    .catch((err) => {
        console.log("database connection failed. Server not started");
        console.error(err);
    });

// const httpApp = express();
// httpApp.get("*", function (req, res, next) {
//     res.redirect(301, `https://${req.headers.host}${req.url}`);
// });
// httpApp.listen(PORT)

const app = express();
const maxRequestBodySize = process.env.MAX_REQUEST_BODY_SIZE || '1mb';
app.use(express.json({limit: maxRequestBodySize}));
app.use(express.urlencoded({limit: maxRequestBodySize}));
app.use(cookieParser());
app.use(express.json());
const corsOptions = {
        origin: [process.env.FE_URL, "https://www.wisdomlinked.com" ],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
    };
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions)); // Pre-flight handling

// register the routes
app.use("/api/auth", authRoutes);
app.use("/api/invite-friend", friendInvitationRoutes);
app.use("/api/group-chat", groupChatRoutes);
app.use("/api/expert", expertRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static('../FE/build'));
app.get('/*', (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, '../FE/build/') });
});

var fs = require('fs')
var https = require('https');
var privateKey = fs.readFileSync('./cert/privkey.pem', 'utf8');
var certificate = fs.readFileSync('./cert/fullchain.pem', 'utf8');
var credentials = { key: privateKey, cert: certificate };
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(443, function () {
    console.log(`Example app listening on port 443.`);
  });

// socket connection
createSocketServer(httpsServer);
