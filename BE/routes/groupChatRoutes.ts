const express = require("express");
const router = express.Router();

const {
    getGroupChat,
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
    getAllCommunityChats
} = require("../controllers/groupChat.controller");

const { requireAuth, expertAuth } = require("../middlewares/requireAuth");

// IMPORTANT: Specific routes must come before parameterized routes
router.get(
    "/get-all-community-chats",
    requireAuth(false),
    getAllCommunityChats
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


// delete a group
router.post(
    "/delete",
    expertAuth(false),
    deleteGroup
);


module.exports = router;
