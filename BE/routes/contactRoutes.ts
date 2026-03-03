const express = require("express");
const { sendContactDetails } = require("../services/utils"); // Import utils.js
const router = express.Router();

router.post("/send-contact", async (req, res) => {
    const { targetEmail, name, email, demand } = req.body;

    try {
        console.log("Send Contact Request Data:", { targetEmail, name, email, demand });
        await sendContactDetails(targetEmail, name, email, demand);
        res.status(200).json({ message: "Email sent successfully!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email." });
    }
});

module.exports = router;