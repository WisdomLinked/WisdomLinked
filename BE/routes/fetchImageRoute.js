// routes/fetchImageRoute.js
const express = require("express");
const fetchImageService = require("../services/fetchImageService");
const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { file, folder } = req.query;

        if (!file || !folder) {
            return res.status(400).json({ error: "File and folder parameters are required." });
        }

        const image = await fetchImageService.getImage(file, folder);

        // Set proper headers
        res.set({
            'Content-Type': image.contentType || 'image/png',
            'Content-Length': image.data.length,
            'Cache-Control': 'public, max-age=31557600'
        });

        // Send the binary data
        return res.send(image.data);
    } catch (error) {
        console.error("Error fetching image:", error);
        res.status(500).json({ error: "Failed to fetch image." });
    }
});

module.exports = router;
