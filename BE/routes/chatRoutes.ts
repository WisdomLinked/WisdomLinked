const express = require('express');
const router = express.Router();
const { requireAuth, adminAuth } = require('../middlewares/requireAuth');
const { apiLimiter } = require('../middlewares/rateLimit');
router.use(apiLimiter);

import {
    getOrCreateDM,
    sendMessage,
    getDirectHistory,
    sendGroupMessage,
    getGroupHistory,
    getRCToken,
    markChatRead,
    getDmUnreadSnapshot,
    searchPrivateChatUsers,
    getReadReceiptsBatch,
    deleteChatMessage,
    hideDmFromList,
    clearDmThread,
    getDirectCallHistory,
    getOnlineUsers,
    getChatUserProfile,
    notifyExpertResumeFormat,
} from '../controllers/chat.controller';
import {
    searchAdminChatRooms,
    listAdminChatRooms,
    joinAdminChatRoom,
    leaveAdminChatRoom,
} from '../controllers/adminChat.controller';

// DM routes
router.post('/dm', requireAuth(false), getOrCreateDM);
router.post('/send', requireAuth(false), sendMessage);
router.get('/history/:conversationId', requireAuth(false), getDirectHistory);
router.get('/dm/call-history/:conversationId', requireAuth(false), getDirectCallHistory);

// Group routes
router.post('/group/send', requireAuth(false), sendGroupMessage);
router.get('/group/history/:groupChatId', requireAuth(false), getGroupHistory);

// RC token for frontend realtime
router.get('/rc-token', requireAuth(false), getRCToken);
router.post('/mark-read', requireAuth(false), markChatRead);
router.get('/dm-unread-snapshot', requireAuth(false), getDmUnreadSnapshot);
router.get('/search-users', requireAuth(false), searchPrivateChatUsers);
router.get('/user-profile/:userId', requireAuth(false), getChatUserProfile);
router.post('/notify-expert-resume-format', requireAuth(false), notifyExpertResumeFormat);
router.post('/rc-read-receipts', requireAuth(false), getReadReceiptsBatch);
router.post('/delete-message', requireAuth(false), deleteChatMessage);
router.post('/dm/hide', requireAuth(false), hideDmFromList);
router.post('/dm/clear-thread', requireAuth(false), clearDmThread);
router.get('/online-users', requireAuth(false), getOnlineUsers);

router.get('/admin/rooms', adminAuth, listAdminChatRooms);
router.get('/admin/rooms/search', adminAuth, searchAdminChatRooms);
router.post('/admin/rooms/join', adminAuth, joinAdminChatRoom);
router.post('/admin/rooms/leave', adminAuth, leaveAdminChatRoom);

module.exports = router;
