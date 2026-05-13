import test from "node:test";
import assert from "node:assert/strict";

import { endMeeting, getMeetingJoinInfo } from "../controllers/meeting.controller";

const MeetingThread = require("../models/MeetingThread");
const Conversation = require("../models/Conversation");

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
  };
  return res;
};

test("meeting join expires stale active meetings", async () => {
  const originalFindByIdMeeting = MeetingThread.findById;
  const staleMeeting: any = {
    _id: "meeting-stale",
    status: "active",
    startedAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    save: async () => undefined,
  };

  try {
    MeetingThread.findById = () => ({
      select: async () => staleMeeting,
    });

    const req: any = {
      user: { userId: "user-1" },
      params: { meetingThreadId: "meeting-stale" },
    };
    const res = createRes();

    await getMeetingJoinInfo(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, "Meeting is no longer active");
    assert.equal(staleMeeting.status, "ended");
    assert.ok(staleMeeting.duration > 0);
  } finally {
    MeetingThread.findById = originalFindByIdMeeting;
  }
});

test("non-participant cannot end a meeting", async () => {
  const originalFindByIdMeeting = MeetingThread.findById;
  const originalFindByIdConversation = Conversation.findById;

  try {
    MeetingThread.findById = () => ({
      populate: async () => ({
        _id: "meeting-1",
        status: "active",
        startedAt: new Date(),
        conversationId: "conv-1",
        participants: ["owner"],
        removedParticipants: [],
        startedBy: { _id: "owner" },
        save: async () => undefined,
      }),
    });
    Conversation.findById = () => ({
      select: () => ({
        lean: async () => ({ _id: "conv-1", participants: ["owner", "other-participant"] }),
      }),
    });

    const req: any = {
      user: { userId: "intruder" },
      body: { meetingThreadId: "meeting-1" },
    };
    const res = createRes();

    await endMeeting(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, "You do not have access to this meeting");
  } finally {
    MeetingThread.findById = originalFindByIdMeeting;
    Conversation.findById = originalFindByIdConversation;
  }
});
