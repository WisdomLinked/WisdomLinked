const express = require("express");
const router = express.Router();

const {
    createGroupChat,
    addMemberToPendingGroup,
    addMemberToGroup,
    leaveGroup,
    deleteGroup,
    updateGroupChat,
    joinGeneralChat
} = require("../controllers/groupChat.controller");

const { requireAuth, expertAuth } = require("../middlewares/requireAuth");

// create a groupChat
router.post(
    "/",
    expertAuth(true),
    createGroupChat
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

// delete a group
router.post(
    "/delete",
    expertAuth(false),
    deleteGroup
);


module.exports = router;
