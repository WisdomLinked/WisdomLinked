const express = require("express");
const router = express.Router();

const {
    getGroupChat,
    resolveGroupMemberByRcSlug,
    joinGroupChat,
    createGroupChat,
    createGroupChatByUser,
    proposeIndividualAppointment,
    ensureSeminarChannel,
    registerForSeminar,
    requestSeminarSeat,
    approveSeminarSeatRequest,
    rejectSeminarSeatRequest,
    inviteToSeminar,
    paySeminarSeatRequest,
    getSeminarSeatRequests,
    getMySeatRequests,
    getMyDecisionNotices,
    markDecisionNoticeRead,
    acceptIndividualAppointment,
    cancelIndividualAppointment,
    leaveGroup,
    deleteGroup,
    updateGroupChat,
    joinGeneralChat,
    joinPrivateChat,
    createCommunityChat,
    joinCommunityChat,
    addParticipantsToCommunityChat,
    getAllCommunityChats,
    removeMemberFromCommunityChat,
    setCommunityCoModerator,
} = require("../controllers/groupChat.controller");

const { requireAuth, expertAuth } = require("../middlewares/requireAuth");
const { apiLimiter } = require("../middlewares/rateLimit");

// Rate-limit every group-chat route (mirrors authRoutes / customerRoutes).
router.use(apiLimiter);

// IMPORTANT: Specific routes must come before parameterized routes
router.get(
    "/get-all-community-chats",
    requireAuth(false),
    getAllCommunityChats
);

// expert lists pending overflow seat requests for their seminars
router.get(
    "/seat-requests",
    expertAuth(true),
    getSeminarSeatRequests
);

// student lists their own seat requests (for pending-status badges)
router.get(
    "/my-seat-requests",
    requireAuth(true),
    getMySeatRequests
);

// student reads the notes experts attached to their recent accept/decline decisions
router.get(
    "/decision-notices",
    requireAuth(true),
    getMyDecisionNotices
);

// student dismisses one of those notices
router.post(
    "/decision-notices/read",
    requireAuth(true),
    markDecisionNoticeRead
);

router.get(
    "/:groupChatId/resolve-participant",
    requireAuth(true),
    resolveGroupMemberByRcSlug
);

router.get(
    "/:groupChatId",
    requireAuth(true),
    getGroupChat
);

router.post(
    "/join",
    requireAuth(true),
    joinGroupChat
);

// create a groupChat
router.post(
    "/",
    expertAuth(true),
    createGroupChat
);

//create a groupChat by a user
router.post(
    "/create-by-user",
    requireAuth(true),
    createGroupChatByUser
);

// expert proposes a 1:1 session to a student (expert sets the final price)
router.post(
    "/propose-individual-appointment",
    expertAuth(true),
    proposeIndividualAppointment
);

// ensure (lazily create) a seminar's group chat channel
router.post(
    "/ensure-seminar-channel",
    requireAuth(true),
    ensureSeminarChannel
);

// accept individual appointment
router.post(
    "/accept-individual-appointment",
    requireAuth(true),
    acceptIndividualAppointment
);

// update a groupChat
router.post(
    "/update",
    expertAuth(false),
    updateGroupChat
);

// register a student for a seminar (direct enroll — no host approval)
router.post(
    "/register-seminar",
    requireAuth(true),
    registerForSeminar
);

// overflow: request a seat in a full seminar (funds authorized, pending host approval)
router.post(
    "/request-seminar-seat",
    requireAuth(true),
    requestSeminarSeat
);

// host approves an overflow seat request (captures the held funds)
router.post(
    "/approve-seat-request",
    expertAuth(true),
    approveSeminarSeatRequest
);

// host declines an overflow seat request (releases the hold)
router.post(
    "/reject-seat-request",
    expertAuth(true),
    rejectSeminarSeatRequest
);

// host invites students — followers or by email — to one of their seminars
router.post(
    "/invite-to-seminar",
    expertAuth(true),
    inviteToSeminar
);

// student settles an approved wallet seat within their payment window
router.post(
    "/pay-seat-request",
    requireAuth(true),
    paySeminarSeatRequest
);

router.post(
    "/joinGeneralChat",
    requireAuth(false),
    joinGeneralChat
);

router.post(
    "/joinPrivateChat",
    requireAuth(false),
    joinPrivateChat
);

router.post(
    "/create-community-chat",
    requireAuth(false),
    createCommunityChat
);

router.post(
    "/join-community-chat",
    requireAuth(false),
    joinCommunityChat
);

router.post(
    "/add-participants-to-community-chat",
    requireAuth(false),
    addParticipantsToCommunityChat
);

router.post("/cancel-individual-appointment", 
    requireAuth(false), 
    cancelIndividualAppointment
);

router.post(
    "/leave",
    requireAuth(true),
    leaveGroup
);

router.post(
    "/remove-community-member",
    requireAuth(true),
    removeMemberFromCommunityChat
);

router.post(
    "/set-community-co-moderator",
    requireAuth(true),
    setCommunityCoModerator
);

// delete a group (controller checks admin; use requireAuth so community admin can be non-expert after transfer)
router.post(
    "/delete",
    requireAuth(true),
    deleteGroup
);


module.exports = router;
