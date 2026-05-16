import test from "node:test";
import assert from "node:assert/strict";

import { getMeetingPermissions } from "../controllers/meeting.controller";

const MeetingThread = require("../models/MeetingThread");
const Conversation = require("../models/Conversation");
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
  };
  return res;
};

const stubDmMeetingPermissions = (delegatedModerators: string[] = []) => {
  const convDoc = { _id: "conv-1", participants: ["owner", "guest"] };
  const meeting: any = {
    _id: "meeting-dm",
    status: "active",
    conversationId: "conv-1",
    groupChatId: undefined,
    removedParticipants: [],
    startedBy: "owner",
    delegatedModerators,
  };
  MeetingThread.findById = () => ({
    select: async () => meeting,
  });
  Conversation.findById = () => ({
    select: () => ({
      lean: async () => convDoc,
    }),
  });
  return meeting;
};

test("permissions: host can draw", async () => {
  const originalFindById = MeetingThread.findById;
  const originalConv = Conversation.findById;
  try {
    stubDmMeetingPermissions();
    const req: any = {
      query: { meetingThreadId: "meeting-dm" },
      meetingChatClaims: { typ: "wl-meeting-chat", mid: "meeting-dm", sub: "owner" },
    };
    const res = createRes();
    await getMeetingPermissions(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.canDrawWhiteboard, true);
  } finally {
    MeetingThread.findById = originalFindById;
    Conversation.findById = originalConv;
  }
});

test("permissions: delegated guest can draw", async () => {
  const originalFindById = MeetingThread.findById;
  const originalConv = Conversation.findById;
  try {
    stubDmMeetingPermissions(["guest"]);
    const req: any = {
      query: { meetingThreadId: "meeting-dm" },
      meetingChatClaims: { typ: "wl-meeting-chat", mid: "meeting-dm", sub: "guest" },
    };
    const res = createRes();
    await getMeetingPermissions(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.canDrawWhiteboard, true);
  } finally {
    MeetingThread.findById = originalFindById;
    Conversation.findById = originalConv;
  }
});

test("permissions: non-delegated guest cannot draw", async () => {
  const originalFindById = MeetingThread.findById;
  const originalConv = Conversation.findById;
  try {
    stubDmMeetingPermissions();
    const req: any = {
      query: { meetingThreadId: "meeting-dm" },
      meetingChatClaims: { typ: "wl-meeting-chat", mid: "meeting-dm", sub: "guest" },
    };
    const res = createRes();
    await getMeetingPermissions(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.canDrawWhiteboard, false);
  } finally {
    MeetingThread.findById = originalFindById;
    Conversation.findById = originalConv;
  }
});
