const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const { uploadImageToStorage } = require("../services/imageUploadService");
const User = require("../models/User");

router.post("/upload", upload.single("image"), async (req, res) => {
    try {
      const imageUrl = await uploadImageToStorage(req.file);
  
      // Optional: Save to user profile
    //   const userId = req.user.id;
        const userId = "67c3a219a398892e87ad3a64"
      await User.findByIdAndUpdate(userId, { profileImageUrl: imageUrl });
  
      res.status(200).json({ imageUrl });
    } catch (error) {
      console.error("Upload failed:", error);
      res.status(500).json({ error: "Image upload failed" });
    }
});

module.exports = router;
