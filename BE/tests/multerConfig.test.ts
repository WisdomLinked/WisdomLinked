import test from "node:test";
import assert from "node:assert/strict";

const {
  isAllowedChatFileExtension,
  MAX_CHAT_FILE_SIZE_BYTES,
  MAX_GENERAL_FILE_SIZE_BYTES,
  CHAT_FILE_REQUIREMENTS_MESSAGE,
  CHAT_FILE_SIZE_EXCEEDED_MESSAGE,
  mapChatUploadMulterError,
} = require("../middlewares/multerConfig");

test("chat upload allows whitelisted extensions (case-insensitive)", () => {
  assert.equal(isAllowedChatFileExtension("resume.PDF"), true);
  assert.equal(isAllowedChatFileExtension("notes.Docx"), true);
  assert.equal(isAllowedChatFileExtension("photo.JpEg"), true);
});

test("chat upload rejects unknown or missing extensions", () => {
  assert.equal(isAllowedChatFileExtension("archive.zip"), false);
  assert.equal(isAllowedChatFileExtension("filename"), false);
  assert.equal(isAllowedChatFileExtension(""), false);
});

test("chat and general size limits stay isolated", () => {
  assert.equal(MAX_CHAT_FILE_SIZE_BYTES, 1 * 1024 * 1024);
  assert.equal(MAX_GENERAL_FILE_SIZE_BYTES, 20 * 1024 * 1024);
  assert.ok(MAX_GENERAL_FILE_SIZE_BYTES > MAX_CHAT_FILE_SIZE_BYTES);
});

test("chat upload maps multer file-size error to clear message", () => {
  const err = { name: "MulterError", code: "LIMIT_FILE_SIZE", message: "File too large" };
  assert.equal(mapChatUploadMulterError(err), CHAT_FILE_SIZE_EXCEEDED_MESSAGE);
});

test("chat upload uses explicit error message when present", () => {
  assert.equal(
    mapChatUploadMulterError(new Error(CHAT_FILE_REQUIREMENTS_MESSAGE)),
    CHAT_FILE_REQUIREMENTS_MESSAGE,
  );
});

test("chat upload falls back to requirements message for unknown errors", () => {
  assert.equal(mapChatUploadMulterError({}), CHAT_FILE_REQUIREMENTS_MESSAGE);
});
