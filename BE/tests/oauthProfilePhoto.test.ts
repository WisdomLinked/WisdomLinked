import test from "node:test";
import assert from "node:assert/strict";

const {
  isOAuthPhotoUrlAllowed,
  importOAuthProfilePhoto,
} = require("../services/oauthProfilePhoto");

const SPACES_ENV_KEYS = [
  "DO_SPACES_BUCKET",
  "DO_SPACES_KEY",
  "DO_SPACES_SECRET",
  "DO_SPACES_ENDPOINT",
] as const;

function snapshotSpacesEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const k of SPACES_ENV_KEYS) {
    snap[k] = process.env[k];
  }
  return snap;
}

function restoreSpacesEnv(snap: Record<string, string | undefined>) {
  for (const k of SPACES_ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

function enableSpacesEnvForTest() {
  process.env.DO_SPACES_BUCKET = "test-bucket";
  process.env.DO_SPACES_KEY = "test-key";
  process.env.DO_SPACES_SECRET = "test-secret";
  process.env.DO_SPACES_ENDPOINT = "nyc3.digitaloceanspaces.com";
}

const tinyJpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

test("isOAuthPhotoUrlAllowed accepts https and rejects empty", () => {
  assert.equal(isOAuthPhotoUrlAllowed("https://lh3.googleusercontent.com/a/abc"), true);
  assert.equal(isOAuthPhotoUrlAllowed(""), false);
  assert.equal(isOAuthPhotoUrlAllowed("ftp://x.com/a.jpg"), false);
});

test("isOAuthPhotoUrlAllowed allows http on local FE_URL", () => {
  const prev = process.env.FE_URL;
  process.env.FE_URL = "http://localhost:5173";
  assert.equal(isOAuthPhotoUrlAllowed("http://127.0.0.1/photo.jpg"), true);
  if (prev === undefined) delete process.env.FE_URL;
  else process.env.FE_URL = prev;
});

test("importOAuthProfilePhoto skips when user already has image", async () => {
  const snap = snapshotSpacesEnv();
  enableSpacesEnvForTest();
  let fetchCalled = false;
  const user = {
    image: "existing.jpg",
    save: async () => {
      throw new Error("save should not run");
    },
  };
  const ok = await importOAuthProfilePhoto(user, "https://example.com/p.jpg", {
    fetchFn: async () => {
      fetchCalled = true;
      return new Response(tinyJpeg);
    },
    uploadFn: async () => {
      throw new Error("upload should not run");
    },
  });
  assert.equal(ok, false);
  assert.equal(fetchCalled, false);
  assert.equal(user.image, "existing.jpg");
  restoreSpacesEnv(snap);
});

test("importOAuthProfilePhoto skips without photo URL", async () => {
  const snap = snapshotSpacesEnv();
  enableSpacesEnvForTest();
  let fetchCalled = false;
  const user = { image: "", save: async () => {} };
  const ok = await importOAuthProfilePhoto(user, "", {
    fetchFn: async () => {
      fetchCalled = true;
      return new Response(tinyJpeg);
    },
  });
  assert.equal(ok, false);
  assert.equal(fetchCalled, false);
  restoreSpacesEnv(snap);
});

test("importOAuthProfilePhoto downloads and saves filename", async () => {
  const snap = snapshotSpacesEnv();
  enableSpacesEnvForTest();
  const saves: string[] = [];
  const user = {
    image: "",
    save: async () => {
      saves.push("saved");
    },
  };
  const ok = await importOAuthProfilePhoto(
    user,
    "https://lh3.googleusercontent.com/a/test-photo",
    {
      fetchFn: async () =>
        new Response(tinyJpeg, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
      uploadFn: async () => ({
        filename: "google_profile_123.jpg",
        details: [{ filename: "google_profile_123.jpg", status: "uploaded" }],
      }),
    },
  );
  assert.equal(ok, true);
  assert.equal(user.image, "google_profile_123.jpg");
  assert.deepEqual(saves, ["saved"]);
  restoreSpacesEnv(snap);
});

test("importOAuthProfilePhoto does not throw on fetch failure", async () => {
  const snap = snapshotSpacesEnv();
  enableSpacesEnvForTest();
  const user = { image: "", save: async () => {} };
  const ok = await importOAuthProfilePhoto(user, "https://example.com/p.jpg", {
    fetchFn: async () => new Response(null, { status: 404 }),
    uploadFn: async () => ({ filename: "x.jpg" }),
  });
  assert.equal(ok, false);
  assert.equal(user.image, "");
  restoreSpacesEnv(snap);
});

test("importOAuthProfilePhoto does not throw on upload failure", async () => {
  const snap = snapshotSpacesEnv();
  enableSpacesEnvForTest();
  const user = { image: "", save: async () => {} };
  const ok = await importOAuthProfilePhoto(user, "https://example.com/p.jpg", {
    fetchFn: async () =>
      new Response(tinyJpeg, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    uploadFn: async () => {
      throw new Error("spaces down");
    },
  });
  assert.equal(ok, false);
  assert.equal(user.image, "");
  restoreSpacesEnv(snap);
});

test("importOAuthProfilePhoto skips when Spaces is not configured", async () => {
  const snap = snapshotSpacesEnv();
  for (const k of SPACES_ENV_KEYS) delete process.env[k];
  let fetchCalled = false;
  const user = { image: "", save: async () => {} };
  const ok = await importOAuthProfilePhoto(user, "https://example.com/p.jpg", {
    fetchFn: async () => {
      fetchCalled = true;
      return new Response(tinyJpeg);
    },
  });
  assert.equal(ok, false);
  assert.equal(fetchCalled, false);
  restoreSpacesEnv(snap);
});
