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
    joinPrivateChat
} = require("../controllers/groupChat.controller");

const { requireAuth, expertAuth } = require("../middlewares/requireAuth");


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
