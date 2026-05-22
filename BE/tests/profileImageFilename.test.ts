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

test("pickUploadedProfileFilename reads nested data.details", () => {
  const name = pickUploadedProfileFilename(
    {
      data: {
        details: [{ filename: "nested.jpg", status: "uploaded" }],
      },
    },
    "fallback.jpg",
  );
  assert.equal(name, "nested.jpg");
});

test("pickUploadedProfileFilename uses first detail filename when no uploaded status", () => {
  const name = pickUploadedProfileFilename(
    {
      details: [{ filename: "only-row.webp", status: "pending" }],
    },
    "",
  );
  assert.equal(name, "only-row.webp");
});

test("pickUploadedProfileFilename returns fallback for empty result", () => {
  assert.equal(pickUploadedProfileFilename(null, "orig.gif"), "orig.gif");
  assert.equal(pickUploadedProfileFilename({}, ""), "");
});

test("normalizeProfileImageRef rejects empty and keeps path basename", () => {
  assert.equal(normalizeProfileImageRef(""), null);
  assert.equal(normalizeProfileImageRef(null), null);
  assert.equal(normalizeProfileImageRef("small/avatar_x.jpg"), "avatar_x.jpg");
});
