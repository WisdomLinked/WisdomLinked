import test from "node:test";
import assert from "node:assert/strict";

const eventController = require("../controllers/event.controller");
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

test("appendEvent rejects outside expert availability", async () => {
  const originalFindOne = User.findOne;
  const originalEventFind = Event.find;
  const originalGroupFind = GroupChat.find;

  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  try {
    User.findOne = async (query: any) => {
      if (query.email === "expert@test.com") {
        return {
          _id: "expert-id",
          email: "expert@test.com",
          timeSlots: [0, 1],
          timeZone: "UTC",
          blockedBookingDates: [],
        };
      }
      return {
        _id: "customer-id",
        email: "customer@test.com",
      };
    };
    Event.find = () => ({ select: async () => [] });
    GroupChat.find = () => ({ select: async () => [] });

    const req: any = {
      body: {
        title: "Test",
        start: start.toISOString(),
        end: end.toISOString(),
        duration: 60,
        price: 0,
        expert: "expert@test.com",
        customer: "customer@test.com",
        payment_intent: "pi_test",
        createdBy: "customer-id",
      },
    };
    const res = createRes();

    await eventController.appendEvent(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(String(res.body), /outside expert availability/i);
  } finally {
    User.findOne = originalFindOne;
    Event.find = originalEventFind;
    GroupChat.find = originalGroupFind;
  }
});
