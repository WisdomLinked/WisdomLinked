const express = require("express");
const router = express.Router();

const {
    getGroupChat,
    resolveGroupMemberByRcSlug,
    joinGroupChat,
    createGroupChat,
    createGroupChatByUser,
    addMemberToPendingGroup,
    addMemberToGroup,
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

// add a friend to the group
router.post(
    "/add",
    expertAuth(true),
    addMemberToGroup
);

router.post(
    "/add-to-pending",
    requireAuth(true),
    addMemberToPendingGroup
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
