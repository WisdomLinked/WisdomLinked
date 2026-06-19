import test from "node:test";
import assert from "node:assert/strict";

const groupController = require("../controllers/groupChat.controller");
const User = require("../models/User");
const Event = require("../models/Event");
const GroupChat = require("../models/GroupChat");

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

const expertDoc = {
  _id: "expert-id-1",
  email: "expert@test.com",
  username: "Expert",
  timeSlots: [18, 19, 20],
  timeZone: "UTC",
  blockedBookingDates: [],
  groupChats: [],
  save: async () => {},
  populate: async () => {},
};

const baseBody = {
  name: "Session",
  description: "d",
  services: [],
  keywords: [],
  // Fixed UTC window (same calendar day) so CI is not flaky near midnight.
  start: "2026-06-25T18:00:00.000Z",
  end: "2026-06-25T19:00:00.000Z",
  duration: 60,
  price: 0,
  expert: "expert-id-1",
  payment_intent: "pi_test",
};

test("createGroupChatByUser rejects blocked booking date", async () => {
  const originalFindById = User.findById;
  const originalEventFind = Event.find;
  const originalGroupFind = GroupChat.find;

  try {
    User.findById = async () => ({
      ...expertDoc,
      blockedBookingDates: [
        new Date(baseBody.start).toISOString().slice(0, 10),
      ],
    });
    Event.find = () => ({ select: async () => [] });
    GroupChat.find = () => ({ select: async () => [] });

    const req: any = {
      user: { userId: "customer-1" },
      body: baseBody,
    };
    const res = createRes();

    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(String(res.body), /not accepting bookings/i);
  } finally {
    User.findById = originalFindById;
    Event.find = originalEventFind;
    GroupChat.find = originalGroupFind;
  }
});

test("createGroupChatByUser rejects slot outside availability", async () => {
  const originalFindById = User.findById;
  const originalEventFind = Event.find;
  const originalGroupFind = GroupChat.find;

  try {
    User.findById = async () => ({
      ...expertDoc,
      timeSlots: [0, 1],
    });
    Event.find = () => ({ select: async () => [] });
    GroupChat.find = () => ({ select: async () => [] });

    const req: any = {
      user: { userId: "customer-1" },
      body: baseBody,
    };
    const res = createRes();

    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(String(res.body), /outside expert availability/i);
  } finally {
    User.findById = originalFindById;
    Event.find = originalEventFind;
    GroupChat.find = originalGroupFind;
  }
});
