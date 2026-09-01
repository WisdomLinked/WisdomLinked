const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const { apiLimiter } = require("../middlewares/rateLimit");
const { getReceipt } = require("../controllers/receipt.controller");

router.use(apiLimiter);

router.get("/:paymentId", requireAuth(false), getReceipt);

module.exports = router;
