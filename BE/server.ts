require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const passport = require("./config/passport");
const { csrfProtection, csrfErrorHandler } = require("./config/csrf");
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
const chatRoutes = require("./routes/chatRoutes");
const meetingRoutes = require("./routes/meetingRoutes");

const { appendDefaultServices, appendAdminUserAndGroupChat, initAppStates } = require('./initDB')


const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI is not set. Set it in BE/.env (see BE/.env.example).");
    process.exit(1);
}

process.on("unhandledRejection", (reason: any) => {
    console.error("Unhandled promise rejection:", reason?.stack || reason?.message || reason);
});

const app = express();
const maxRequestBodySize = process.env.MAX_REQUEST_BODY_SIZE || '1mb';

const jitHost = String(process.env.JITSI_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const jitOrigin = jitHost ? `https://${jitHost}` : null;
const corsOptions = {
    origin: [process.env.FE_URL, "https://www.wisdomlinked.com", "http://localhost:3000", jitOrigin].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
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

app.use(csrfProtection);

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
app.use("/api/chat", chatRoutes);
app.use("/api/meeting", meetingRoutes);

app.use(csrfErrorHandler);

app.use(express.static('./uploads'));
app.get('/uploads/*', (req, res) => {
    const fileName = path.basename(req.path);
    res.sendFile(decodeURI(fileName), { root: path.join(__dirname, `.${req.path.replace(fileName, '')}`) });
});

// Wait for MongoDB before accepting traffic — avoids Mongoose "buffering timed out" on failed connects
mongoose
    .connect(MONGO_URI, { serverSelectionTimeoutMS: 15_000 })
    .then(() => {
        console.log("Connected to MongoDB Server");
        if (process.env.ROCKETCHAT_URL) {
            const tokSecret = (
                process.env.ROCKETCHAT_CREATE_TOKENS_SECRET ||
                process.env.CREATE_TOKENS_FOR_USERS_SECRET ||
                ''
            ).trim();
            if (!tokSecret) {
                console.warn(
                    '[Rocket.Chat] ROCKETCHAT_URL is set but ROCKETCHAT_CREATE_TOKENS_SECRET is empty. ' +
                        'Set it to the same value as Rocket.Chat Admin → Workspace → Create Personal Access Tokens Secret ' +
                        '(or CREATE_TOKENS_FOR_USERS_SECRET on the RC server). Without it, one side may see empty DM history in WL.'
                );
            }
        }
        appendDefaultServices();
        appendAdminUserAndGroupChat();
        initAppStates();

        // Release expired seminar seat-request holds on a timer (no cron infra;
        // reminders elsewhere rely on SendGrid sendAt, which can't run this logic).
        const { sweepExpiredSeatRequests } = require('./controllers/groupChat.controller');
        sweepExpiredSeatRequests();
        setInterval(sweepExpiredSeatRequests, 15 * 60 * 1000);

        const httpServer = require('http').Server(app);
        httpServer.listen(PORT, function () {
            console.log(`App listening on port ${PORT}.`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed — server not started.");
        console.error(err);
        console.error(
            "Tip: If the API runs in Docker, MONGO_URI must use hostname `mongo` (see BE/.env.example), not localhost."
        );
        process.exit(1);
    });
