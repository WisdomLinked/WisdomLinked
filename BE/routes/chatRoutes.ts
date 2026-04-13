const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/requireAuth');

import {
    getOrCreateDM,
    sendMessage,
    getDirectHistory,
    sendGroupMessage,
    getGroupHistory,
    getRCToken,
} from '../controllers/chat.controller';

// DM routes
router.post('/dm', requireAuth(false), getOrCreateDM);
router.post('/send', requireAuth(false), sendMessage);
router.get('/history/:conversationId', requireAuth(false), getDirectHistory);

// Group routes
router.post('/group/send', requireAuth(false), sendGroupMessage);
router.get('/group/history/:groupChatId', requireAuth(false), getGroupHistory);

// RC token for frontend realtime
router.get('/rc-token', requireAuth(false), getRCToken);

module.exports = router;
