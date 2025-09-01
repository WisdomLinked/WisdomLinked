const express = require("express");
const router = express.Router();
const { customerAuth } = require("../middlewares/requireAuth");
const {
    filterExperts,
    filterSeminars,
    getExpertById,
} = require('../controllers/customer.controller')
const {
    appendEvent,
    updateEvent,
    cancelEvent,
    createFeedback,
} = require('../controllers/event.controller')
const {
    cancelPendingSeminar,
    leftSeminar
} = require('../controllers/groupChat.controller')
const { appendPaymentHistory } = require('../controllers/payment.controller')

router.post("/filterExperts", customerAuth(false), filterExperts);
router.get("/getUser/:id",customerAuth(false),getExpertById)
router.post("/filterSeminars", customerAuth(false), filterSeminars);
router.post("/appendEvent", customerAuth(true), appendEvent);
router.post("/updateEvent", customerAuth(true), updateEvent);
router.post("/cancelEvent", customerAuth(false), cancelEvent);
router.post("/cancelPendingSeminar", customerAuth(false), cancelPendingSeminar);
router.post("/leftSeminar", customerAuth(false), leftSeminar);
router.post("/createEventFeedback", customerAuth(true), createFeedback);

router.post("/appendPaymentHistory", customerAuth(true), async (req, res) => {
    try {
    // Only allow customer to write their own charge record
    const { stripeMode, amountUSD, description, paymentIntent } = req.body;
    if (!stripeMode || !paymentIntent || typeof amountUSD !== 'number')
        return res.status(400).json({ message: "stripeMode, amountUSD, paymentIntent required" });
        await appendPaymentHistory({
            stripeMode,
            paymentType: 'adhoc',
            amount: Math.round(amountUSD * 100),
            currency: 'usd',
            description,
            paymentIntent,
            customer: req.user._id,
            adminNote: '', 
        });
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.log(e); return res.status(500).send(e.message);
      }
})

module.exports = router;
