import test from "node:test";
import assert from "node:assert/strict";
import { filterOnlineUserIdsByAllowedSet } from "../controllers/chat.controller";

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
