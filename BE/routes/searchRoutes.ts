const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../middlewares/rateLimit');
const { optionalAuth } = require('../middlewares/requireAuth');
const { search } = require('../controllers/search.controller');

router.get('/', apiLimiter, optionalAuth, search);

module.exports = router;
