import test from "node:test";
import assert from "node:assert/strict";

const expertController = require("../controllers/expert.controller");
const notifications = require("../services/notifications");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");

const createRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const SEMINAR_ID = "a".repeat(24);

const seminar = {
  _id: SEMINAR_ID,
  name: "Applying to US Graduate Programs",
  type: "seminar",
  admin: "host-1",
  participants: ["student-1"],
  coModerators: [],
};

const shared: any[] = [];

const withStubs = async (chat: any, run: () => Promise<void>) => {
  const originalFindById = GroupChat.findById;
  const originalFindOne = User.findOne;
  const originalShare = notifications.shareMeetingId;
  const originalGlobalShare = (globalThis as any).shareMeetingId;
  shared.length = 0;
  const recorder = (...args: any[]) => {
    shared.push(args);
  };
  try {
    GroupChat.findById = async () => chat;
    User.findOne = async () => null;
    notifications.shareMeetingId = recorder;
    (globalThis as any).shareMeetingId = recorder;
    await run();
  } finally {
    GroupChat.findById = originalFindById;
    User.findOne = originalFindOne;
    notifications.shareMeetingId = originalShare;
    (globalThis as any).shareMeetingId = originalGlobalShare;
  }
};

test("the seminar host can share the chat", async () => {
  await withStubs(seminar, async () => {
    const res = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "host-1" }, body: { email: "friend@example.com", groupchatId: SEMINAR_ID } },
      res,
    );
    assert.equal(res.statusCode, 200);
  });
});

test("an expert who is in the seminar can share it", async () => {
  await withStubs({ ...seminar, participants: ["student-1", "co-host-1"] }, async () => {
    const res = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "co-host-1" }, body: { email: "friend@example.com", groupchatId: SEMINAR_ID } },
      res,
    );
    assert.equal(res.statusCode, 200);
  });
});

test("an outsider cannot share a seminar they are not part of", async () => {
  await withStubs(seminar, async () => {
    const res = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "stranger-1" }, body: { email: "friend@example.com", groupchatId: SEMINAR_ID } },
      res,
    );
    assert.equal(res.statusCode, 403);
    assert.match(String(res.body), /Only people in this chat/i);
  });
});

test("a community is shareable by its moderators, not by every member", async () => {
  const community = { ...seminar, type: "community", participants: ["member-1"], coModerators: ["mod-1"] };

  await withStubs(community, async () => {
    const res = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "member-1" }, body: { email: "friend@example.com", groupchatId: SEMINAR_ID } },
      res,
    );
    assert.equal(res.statusCode, 403);
  });

  await withStubs(community, async () => {
    const res = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "mod-1" }, body: { email: "friend@example.com", groupchatId: SEMINAR_ID } },
      res,
    );
    assert.equal(res.statusCode, 200);
  });
});

test("a malformed address or id is refused before anything is sent", async () => {
  await withStubs(seminar, async () => {
    const badEmail = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "host-1" }, body: { email: "not-an-email", groupchatId: SEMINAR_ID } },
      badEmail,
    );
    assert.equal(badEmail.statusCode, 400);

    const badId = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "host-1" }, body: { email: "friend@example.com", groupchatId: "123" } },
      badId,
    );
    assert.equal(badId.statusCode, 400);

    assert.equal(shared.length, 0, "nothing is emailed for a rejected request");
  });
});

test("a missing seminar is a 404, not a crash", async () => {
  await withStubs(null, async () => {
    const res = createRes();
    await expertController.shareMeetingViaEmail(
      { user: { userId: "host-1" }, body: { email: "friend@example.com", groupchatId: SEMINAR_ID } },
      res,
    );
    assert.equal(res.statusCode, 404);
  });
});
