import test from "node:test";
import assert from "node:assert/strict";

const expertController = require("../controllers/expert.controller");
const User = require("../models/User");

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

test("setBlockedBookingSlots normalizes keys/indices and persists via userId", async () => {
  const original = User.findByIdAndUpdate;
  let capturedUpdate: any = null;

  try {
    User.findByIdAndUpdate = (filter: any, update: any) => {
      capturedUpdate = { filter, update };
      const doc = {
        blockedBookingSlots: update.blockedBookingSlots,
        timeZone: "America/New_York",
        email: "expert@test.com",
      };
      return {
        select: () => Promise.resolve(doc),
      };
    };

    const req: any = {
      user: { userId: "expert-123", email: "expert@test.com" },
      body: {
        slots: {
          "2026-06-15": [18, 19, 19, 99, -1, 3.5],
          "bad-key": [10],
          "2026-06-20": [],
        },
      },
    };
    const res = createRes();

    await expertController.setBlockedBookingSlots(req, res);

    assert.equal(res.statusCode, 200);
    // Junk indices dropped, deduped/sorted; bad key and empty-array date dropped.
    assert.deepEqual(capturedUpdate.update.blockedBookingSlots, {
      "2026-06-15": [3, 18, 19],
    });
    assert.equal(capturedUpdate.filter._id, "expert-123");
    assert.deepEqual(res.body.blockedBookingSlots, { "2026-06-15": [3, 18, 19] });
  } finally {
    User.findByIdAndUpdate = original;
  }
});

test("setBlockedBookingSlots returns 400 when slots is not an object", async () => {
  const req: any = {
    user: { userId: "expert-123" },
    body: { slots: ["2026-06-15"] },
  };
  const res = createRes();
  await expertController.setBlockedBookingSlots(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body.error), /object/i);
});

test("setBlockedBookingSlots returns 404 when user missing", async () => {
  const original = User.findByIdAndUpdate;
  try {
    User.findByIdAndUpdate = () => ({
      select: () => Promise.resolve(null),
    });
    const req: any = {
      user: { userId: "missing" },
      body: { slots: { "2026-06-15": [18] } },
    };
    const res = createRes();
    await expertController.setBlockedBookingSlots(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, "User not found");
  } finally {
    User.findByIdAndUpdate = original;
  }
});
