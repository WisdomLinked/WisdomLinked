const express = require("express");
const multer = require("multer");
const { uploadImageToStorage } = require("../services/imageUploadService");

const router = express.Router();

// Configure multer for file handling
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;

        console.log("Received file:", file);

        if (!file) {
            return res.status(400).json({ message: "Image file is required." });
        }

        const result = await uploadImageToStorage(file);

        return res.status(200).json({ message: "Image uploaded successfully.", data: result });
    } catch (error) {
        console.error("Error uploading image:", error);
        return res.status(500).json({ message: "Failed to upload image.", error: error.message });
    }
});

module.exports = router;
