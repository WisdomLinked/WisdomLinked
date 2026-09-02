import test from "node:test";
import assert from "node:assert/strict";
import { deleteChatMessage, filterOnlineUserIdsByAllowedSet, markChatRead } from "../controllers/chat.controller";

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

test("returns only online users that requester can reach", () => {
  const users = [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }];
  const allowedIds = new Set(["u2", "u3", "u9"]);

  const result = filterOnlineUserIdsByAllowedSet(users, allowedIds);

  assert.deepEqual(result, [{ userId: "u2" }, { userId: "u3" }]);
});

test("drops invalid ids and empty user objects safely", () => {
  const users = [{}, { _id: "" }, { _id: null }, { _id: "u5" }];
  const allowedIds = new Set(["u5"]);

  const result = filterOnlineUserIdsByAllowedSet(users as any[], allowedIds);

  assert.deepEqual(result, [{ userId: "u5" }]);
});

test("markChatRead rejects arbitrary Rocket.Chat rooms", async () => {
  const originalConversationFindOne = Conversation.findOne;
  const originalGroupFindOne = GroupChat.findOne;

  try {
    Conversation.findOne = () => ({ select: () => ({ lean: async () => null }) });
    GroupChat.findOne = () => ({ select: () => ({ lean: async () => null }) });

    const req: any = { user: { userId: "u1" }, body: { roomId: "foreign-room" } };
    const res = createRes();

    await markChatRead(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, "You do not have access to this chat room");
  } finally {
    Conversation.findOne = originalConversationFindOne;
    GroupChat.findOne = originalGroupFindOne;
  }
});

test("delete-for-everyone rejects arbitrary Rocket.Chat rooms", async () => {
  const originalConversationFindOne = Conversation.findOne;
  const originalGroupFindOne = GroupChat.findOne;

  try {
    Conversation.findOne = () => ({ select: () => ({ lean: async () => null }) });
    GroupChat.findOne = () => ({ select: () => ({ lean: async () => null }) });

    const req: any = {
      user: { userId: "u1" },
      body: { roomId: "foreign-room", messageId: "msg-1", mode: "both" },
    };
    const res = createRes();

    await deleteChatMessage(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.error, "You do not have access to this chat room");
  } finally {
    Conversation.findOne = originalConversationFindOne;
    GroupChat.findOne = originalGroupFindOne;
  }
});
