const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../middlewares/rateLimit');
const { getActiveAnnouncement } = require('../controllers/announcement.controller');

router.use(apiLimiter);
router.get('/active', getActiveAnnouncement);

module.exports = router;
