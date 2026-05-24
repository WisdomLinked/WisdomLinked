import test from "node:test";
import assert from "node:assert/strict";

const expertController = require("../controllers/expert.controller");
const User = require("../models/User");
const { assertNotBlockedDate } = require("../utils/bookingValidation");

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

test("setBlockedBookingDates persists via userId and returns JSON", async () => {
  const original = User.findByIdAndUpdate;
  let capturedUpdate: any = null;

  try {
    User.findByIdAndUpdate = (filter: any, update: any) => {
      capturedUpdate = { filter, update };
      const doc = {
        blockedBookingDates: update.blockedBookingDates,
        bookingNoticeHours: 24,
        timeZone: "America/New_York",
        email: "expert@test.com",
      };
      return {
        select: () => Promise.resolve(doc),
      };
    };

    const req: any = {
      user: { userId: "expert-123", email: "expert@test.com" },
      body: { dates: ["2026-06-15", "2026-06-15", "invalid", "2026-06-20"] },
    };
    const res = createRes();

    await expertController.setBlockedBookingDates(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.blockedBookingDates, ["2026-06-15", "2026-06-20"]);
    assert.equal(capturedUpdate.filter._id, "expert-123");
    assert.deepEqual(capturedUpdate.update.blockedBookingDates, [
      "2026-06-15",
      "2026-06-20",
    ]);
  } finally {
    User.findByIdAndUpdate = original;
  }
});

test("setBlockedBookingDates returns 404 when user missing", async () => {
  const original = User.findByIdAndUpdate;
  try {
    User.findByIdAndUpdate = () => ({
      select: () => Promise.resolve(null),
    });
    const req: any = {
      user: { userId: "missing" },
      body: { dates: ["2026-06-15"] },
    };
    const res = createRes();
    await expertController.setBlockedBookingDates(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, "User not found");
  } finally {
    User.findByIdAndUpdate = original;
  }
});

test("setBlockedBookingDates returns 400 for non-array dates", async () => {
  const req: any = {
    user: { userId: "expert-123" },
    body: { dates: "2026-06-15" },
  };
  const res = createRes();
  await expertController.setBlockedBookingDates(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body.error), /array/i);
});

test("assertNotBlockedDate rejects booking on stored blocked YMD in expert TZ", () => {
  const expert = {
    blockedBookingDates: ["2026-05-01"],
    timeZone: "UTC",
  };
  assert.throws(
    () => assertNotBlockedDate(expert, new Date("2026-05-01T12:00:00.000Z")),
    /not accepting bookings/i,
  );
});
