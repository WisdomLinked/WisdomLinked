const express = require("express");
const router = express.Router();
const { apiLimiter } = require("../middlewares/rateLimit");
const { requireAuth } = require("../middlewares/requireAuth");
const {
    getCurrentSharedTerms,
    getRequiredTerms,
    getCurrentTerms,
    acceptTerms,
} = require("../controllers/terms.controller");

router.use(apiLimiter);

router.get("/shared/current", getCurrentSharedTerms);
router.get("/required", requireAuth(false), getRequiredTerms);
router.get("/current/:audience", requireAuth(false), getCurrentTerms);
router.post("/accept", requireAuth(false), acceptTerms);

module.exports = router;
