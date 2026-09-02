import test from "node:test";
import assert from "node:assert/strict";

const User = require("../models/User");
const { getExpertById } = require("../controllers/customer.controller");

const createRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

// Normalize a populate() argument list into the field names it requests,
// so the assertions don't care about string-vs-object form.
const pathNames = (paths: any[]) =>
  paths.map((p) => (typeof p === "string" ? p : p?.path));

test("getExpertById populates the booking fields the overlap check needs", async () => {
  const originalFindById = User.findById;
  const fakeExpert = { _id: "expert-1", username: "jane" };
  let capturedPaths: any[] = [];

  try {
    User.findById = () => ({
      populate: (paths: any[]) => {
        capturedPaths = paths;
        return Promise.resolve(fakeExpert);
      },
    });

    const req: any = { params: { id: "expert-1" } };
    const res = createRes();

    await getExpertById(req, res);

    assert.equal(res.statusCode, 200);

    assert.equal(res.body?.result?._id, fakeExpert._id);
    assert.equal(res.body?.result?.username, fakeExpert.username);

    const names = pathNames(capturedPaths);
    // Existing profile data must still be populated.
    assert.ok(names.includes("keywords"), "keywords populated");
    assert.ok(names.includes("services"), "services populated");
    // The booking-overlap fields that were previously missing.
    assert.ok(names.includes("events"), "events populated");
    assert.ok(names.includes("groupChats"), "groupChats populated");
    assert.ok(
      names.includes("pendingGroupChats"),
      "pendingGroupChats populated",
    );
  } finally {
    User.findById = originalFindById;
  }
});

test("getExpertById deep-populates pendingGroupChats.groupChatId", async () => {
  // Regression: a shallow pendingGroupChats populate leaves groupChatId as a
  // bare ObjectId, so the picker reads item.groupChatId.start === undefined and
  // the conflict filter silently passes. The nested populate is what makes the
  // pending appointment's start/end/name available to the overlap check.
  const originalFindById = User.findById;
  let capturedPaths: any[] = [];

  try {
    User.findById = () => ({
      populate: (paths: any[]) => {
        capturedPaths = paths;
        return Promise.resolve({ _id: "expert-1" });
      },
    });

    await getExpertById({ params: { id: "expert-1" } } as any, createRes());

    const pending = capturedPaths.find(
      (p) => typeof p !== "string" && p?.path === "pendingGroupChats",
    );
    assert.ok(pending, "pendingGroupChats must be an object populate, not a string");

    const nested = pathNames(
      Array.isArray(pending.populate) ? pending.populate : [pending.populate],
    );
    assert.ok(
      nested.includes("groupChatId"),
      "pendingGroupChats.groupChatId must be deep-populated",
    );
  } finally {
    User.findById = originalFindById;
  }
});
