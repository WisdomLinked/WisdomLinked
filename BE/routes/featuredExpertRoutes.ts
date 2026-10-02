const express = require('express');
const router = express.Router();
const { apiLimiter } = require('../middlewares/rateLimit');
const { listPublicFeaturedExperts } = require('../controllers/featuredExpert.controller');

router.use(apiLimiter);
router.get('/', listPublicFeaturedExperts);

module.exports = router;
