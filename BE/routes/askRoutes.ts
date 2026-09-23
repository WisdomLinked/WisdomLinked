const express = require('express');
const router = express.Router();
const { askLimiter } = require('../middlewares/askRateLimit');
const { optionalAuth } = require('../middlewares/requireAuth');
const { ask } = require('../controllers/ask.controller');

router.post('/', askLimiter, optionalAuth, ask);

module.exports = router;
