const multer = require("multer");

const storage = multer.memoryStorage({
  destination: function (req, file, callback) {
    callback(null, "");
  },
});

const MAX_GENERAL_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB for profile/resume/contact flows
const uploadsGeneral = multer({
  storage,
  limits: { fileSize: MAX_GENERAL_FILE_SIZE_BYTES },
}).single("media");

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
const CHAT_FILE_SIZE_EXCEEDED_MESSAGE =
  "File is too large. Max size: 1 MB per file.";

const isAllowedChatFileExtension = (originalName: unknown): boolean => {
  const name = String(originalName || "");
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
  return !!ext && ALLOWED_CHAT_FILE_EXTENSIONS.has(ext);
};

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const uploadsProfilePhoto = multer({
  storage,
  limits: { fileSize: MAX_PROFILE_PHOTO_BYTES },
  fileFilter: (_req: any, file: any, callback: any) => {
    if (!file?.mimetype || !String(file.mimetype).startsWith("image/")) {
      callback(new Error("Profile photo must be an image file."));
      return;
    }
    callback(null, true);
  },
}).single("image");

const uploadsChatFile = multer({
  storage,
  limits: { fileSize: MAX_CHAT_FILE_SIZE_BYTES },
  fileFilter: (_req: any, file: any, callback: any) => {
    if (!isAllowedChatFileExtension(file?.originalname)) {
      callback(new Error(CHAT_FILE_REQUIREMENTS_MESSAGE));
      return;
    }
    callback(null, true);
  },
}).single("media");

const mapChatUploadMulterError = (err: any): string => {
  if (!err) return CHAT_FILE_REQUIREMENTS_MESSAGE;
  if (
    (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") ||
    String(err?.code || "") === "LIMIT_FILE_SIZE"
  ) {
    return CHAT_FILE_SIZE_EXCEEDED_MESSAGE;
  }
  const msg = String(err?.message || "").trim();
  if (msg) return msg;
  return CHAT_FILE_REQUIREMENTS_MESSAGE;
};

const parseMultipartFields = multer().none();

module.exports = {
    uploadsGeneral,
    uploadsProfilePhoto,
    uploadsChatFile,
    parseMultipartFields,
    MAX_GENERAL_FILE_SIZE_BYTES,
    MAX_CHAT_FILE_SIZE_BYTES,
    ALLOWED_CHAT_FILE_EXTENSIONS,
    CHAT_FILE_REQUIREMENTS_MESSAGE,
    CHAT_FILE_SIZE_EXCEEDED_MESSAGE,
    isAllowedChatFileExtension,
    mapChatUploadMulterError,
};