import test from "node:test";
import assert from "node:assert/strict";

const {
  pickUploadedProfileFilename,
  normalizeProfileImageRef,
} = require("../utils/profileImageFilename");

test("pickUploadedProfileFilename prefers uploaded detail row", () => {
  const name = pickUploadedProfileFilename(
    {
      message: "Files processed",
      details: [
        { filename: "bad.png", status: "failed" },
        { filename: "good.jpg", status: "uploaded" },
      ],
    },
    "fallback.jpg",
  );
  assert.equal(name, "good.jpg");
});

test("pickUploadedProfileFilename uses top-level filename when present", () => {
  assert.equal(
    pickUploadedProfileFilename({ filename: "avatar.png" }, "x.jpg"),
    "avatar.png",
  );
});

test("normalizeProfileImageRef stores filename only", () => {
  assert.equal(
    normalizeProfileImageRef("https://cdn.example.com/originals/user_1.jpg"),
    "user_1.jpg",
  );
  assert.equal(normalizeProfileImageRef("  my-photo.png  "), "my-photo.png");
  assert.equal(normalizeProfileImageRef("data:image/png;base64,abc"), null);
});
