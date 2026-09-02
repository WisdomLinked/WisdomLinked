import test from "node:test";
import assert from "node:assert/strict";

const {
  buildStoredProfileFilename,
  isProfileImageStorageConfigured,
} = require("../services/profileImageStorage");

test("buildStoredProfileFilename sanitizes and adds timestamp", () => {
  const name = buildStoredProfileFilename("My Photo (1).PNG");
  assert.match(name, /^My_Photo_1__\d+\.png$/);
});

test("isProfileImageStorageConfigured is false without env", () => {
  const prev = {
    DO_SPACES_BUCKET: process.env.DO_SPACES_BUCKET,
    DO_SPACES_KEY: process.env.DO_SPACES_KEY,
    DO_SPACES_SECRET: process.env.DO_SPACES_SECRET,
    DO_SPACES_ENDPOINT: process.env.DO_SPACES_ENDPOINT,
  };
  delete process.env.DO_SPACES_BUCKET;
  delete process.env.DO_SPACES_KEY;
  delete process.env.DO_SPACES_SECRET;
  delete process.env.DO_SPACES_ENDPOINT;
  assert.equal(isProfileImageStorageConfigured(), false);
  Object.assign(process.env, prev);
});

test("buildStoredProfileFilename defaults extension when missing", () => {
  const name = buildStoredProfileFilename("avatar");
  assert.match(name, /^avatar_\d+\.jpg$/);
});
