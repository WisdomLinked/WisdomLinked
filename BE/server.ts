require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const passport = require("./config/passport");
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

const corsOptions = {
    origin: [process.env.FE_URL, "https://www.wisdomlinked.com", "http://localhost:3000"],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Pre-flight handling

// Stripe webhook needs raw body - must come BEFORE express.json()
const { handleStripeWebhook } = require('./controllers/stripe.controller');
app.post("/api/auth/stripe-webhook", express.raw({ type: 'application/json' }), handleStripeWebhook);

// Now apply JSON parsing for all other routes
app.use(express.json({ limit: maxRequestBodySize }));
app.use(express.urlencoded({ limit: maxRequestBodySize }));
app.use(cookieParser());
app.use(express.json());

// Session + Passport for OAuth
app.use(session({
    secret: process.env.JWT_SECRET || 'wisdomlinked-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 60000 } // short-lived, just for OAuth handshake
}));
app.use(passport.initialize());
app.use(passport.session());

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




var httpServer = require('http').Server(app)
httpServer.listen(PORT, function () {
    console.log(`App listening on port ${PORT}.`);
});

// socket connection
createSocketServer(httpServer);
