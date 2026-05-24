import test from "node:test";
import assert from "node:assert/strict";

import { joinMeetingFromGuestInvite } from "../controllers/meeting.controller";

const MeetingGuestInvite = require("../models/MeetingGuestInvite");
const MeetingThread = require("../models/MeetingThread");
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
  };
  return res;
};

test("guest invite join allows any authenticated account with valid token", async () => {
  const originalFindOne = MeetingGuestInvite.findOne;
  const originalFindByIdMeeting = MeetingThread.findById;
  const originalFindByIdUser = User.findById;

  try {
    const meetingDoc: any = {
      _id: "meeting-1",
      jitsiRoomName: "wl-room-1",
      status: "active",
      removedParticipants: [],
      joinEvents: [],
      participants: [],
      save: async () => undefined,
    };

    MeetingGuestInvite.findOne = () => ({
      lean: async () => ({
        _id: "invite-1",
        meetingThreadId: "meeting-1",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
    });

    MeetingThread.findById = () => ({
      select: async () => meetingDoc,
    });

    User.findById = () => ({
      select: async () => ({
        _id: "user-not-in-participants",
        username: "Invited User",
        email: "invited@example.com",
        image: "",
      }),
    });

    const req: any = {
      user: { userId: "user-not-in-participants" },
      params: { token: "plain-token" },
    };
    const res = createRes();

    await joinMeetingFromGuestInvite(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.role, "participant");
    assert.equal(typeof res.body?.jitsiUrl, "string");
    assert.ok(meetingDoc.participants.includes("user-not-in-participants"));
    assert.equal(meetingDoc.joinEvents.length, 1);
    assert.equal(meetingDoc.joinEvents[0].source, "guest-invite");
  } finally {
    MeetingGuestInvite.findOne = originalFindOne;
    MeetingThread.findById = originalFindByIdMeeting;
    User.findById = originalFindByIdUser;
  }
});

test("guest invite join still blocks users removed by moderator", async () => {
  const originalFindOne = MeetingGuestInvite.findOne;
  const originalFindByIdMeeting = MeetingThread.findById;
  const originalFindByIdUser = User.findById;

  try {
    MeetingGuestInvite.findOne = () => ({
      lean: async () => ({
        _id: "invite-1",
        meetingThreadId: "meeting-1",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
    });

    MeetingThread.findById = () => ({
      select: async () => ({
        _id: "meeting-1",
        jitsiRoomName: "wl-room-1",
        status: "active",
        removedParticipants: [{ userId: "removed-user" }],
      }),
    });

    User.findById = () => ({
      select: async () => ({
        _id: "removed-user",
        username: "Removed User",
        email: "removed@example.com",
      }),
    });

    const req: any = {
      user: { userId: "removed-user" },
      params: { token: "plain-token" },
    };
    const res = createRes();

    await joinMeetingFromGuestInvite(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, "You were removed from this active call by an expert");
  } finally {
    MeetingGuestInvite.findOne = originalFindOne;
    MeetingThread.findById = originalFindByIdMeeting;
    User.findById = originalFindByIdUser;
  }
});

test("guest invite join works for active community meeting thread", async () => {
  const originalFindOne = MeetingGuestInvite.findOne;
  const originalFindByIdMeeting = MeetingThread.findById;
  const originalFindByIdUser = User.findById;

  try {
    const meetingDoc: any = {
      _id: "meeting-community-1",
      groupChatId: "community-123",
      jitsiRoomName: "wl-community-room-1",
      status: "active",
      removedParticipants: [],
      joinEvents: [],
      participants: ["community-admin"],
      save: async () => undefined,
    };

    MeetingGuestInvite.findOne = () => ({
      lean: async () => ({
        _id: "invite-community-1",
        meetingThreadId: "meeting-community-1",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
    });

    MeetingThread.findById = () => ({
      select: async () => meetingDoc,
    });

    User.findById = () => ({
      select: async () => ({
        _id: "new-auth-user",
        username: "Community Invitee",
        email: "community-invitee@example.com",
        image: "",
      }),
    });

    const req: any = {
      user: { userId: "new-auth-user" },
      params: { token: "plain-token-community" },
    };
    const res = createRes();

    await joinMeetingFromGuestInvite(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.role, "participant");
    assert.equal(res.body?.jitsiRoomName, "wl-community-room-1");
    assert.ok(meetingDoc.participants.includes("new-auth-user"));
    assert.equal(meetingDoc.joinEvents[0].source, "guest-invite");
  } finally {
    MeetingGuestInvite.findOne = originalFindOne;
    MeetingThread.findById = originalFindByIdMeeting;
    User.findById = originalFindByIdUser;
  }
});
