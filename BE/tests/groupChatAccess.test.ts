import test from "node:test";
import assert from "node:assert/strict";

const groupController = require("../controllers/groupChat.controller");
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

test("invite-only community join rejects non-members", async () => {
  const originalFindOne = GroupChat.findOne;

  try {
    GroupChat.findOne = async () => ({
      _id: "community-1",
      type: "community",
      isOpenToAll: false,
      admin: "admin",
      participants: ["member-1"],
      coModerators: [],
    });

    const req: any = { user: { userId: "outsider" }, body: { communityChatId: "community-1" } };
    const res = createRes();

    await groupController.joinCommunityChat(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, "This community is invite-only");
  } finally {
    GroupChat.findOne = originalFindOne;
  }
});

test("non-admin cannot update seminar/group details", async () => {
  const originalFindById = GroupChat.findById;

  try {
    GroupChat.findById = async () => ({
      _id: "group-1",
      type: "individual",
      admin: "admin",
      participants: ["admin", "member-1"],
    });

    const req: any = {
      user: { userId: "member-1", email: "member@example.com" },
      body: { groupId: "group-1", name: "Hijacked" },
    };
    const res = createRes();

    await groupController.updateGroupChat(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body, "Forbidden");
  } finally {
    GroupChat.findById = originalFindById;
  }
});
