const multer = require("multer");

const storage = multer.memoryStorage({
  destination: function (req, file, callback) {
    callback(null, "");
  },
});

const MAX_CHAT_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB per file
const ALLOWED_CHAT_FILE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "csv",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);
const CHAT_FILE_REQUIREMENTS_MESSAGE =
  "Unsupported file. Allowed formats: PDF, DOC, DOCX, TXT, CSV, JPG, JPEG, PNG, WEBP, GIF, XLS, XLSX, PPT, PPTX. Max size: 1 MB per file.";

const uploads = multer({
  storage,
  limits: { fileSize: MAX_CHAT_FILE_SIZE_BYTES },
  fileFilter: (_req: any, file: any, callback: any) => {
    const originalName = String(file?.originalname || "");
    const ext = originalName.includes(".")
      ? originalName.split(".").pop().toLowerCase()
      : "";
    if (!ext || !ALLOWED_CHAT_FILE_EXTENSIONS.has(ext)) {
      callback(new Error(CHAT_FILE_REQUIREMENTS_MESSAGE));
      return;
    }
    callback(null, true);
  },
}).single("media");

module.exports = {
    uploads
};