import test from "node:test";
import assert from "node:assert/strict";
import { isMeetingModerator } from "../utils/meetingRoleRules";

test("1:1 meeting starter is moderator", () => {
    assert.equal(
        isMeetingModerator({
            conversationId: "conv1",
            userId: "u1",
            startedBy: "u1",
        }),
        true,
    );
});

test("1:1 non-starter is participant", () => {
    assert.equal(
        isMeetingModerator({
            conversationId: "conv1",
            userId: "u2",
            startedBy: "u1",
        }),
        false,
    );
});

test("group admin is moderator", () => {
    assert.equal(
        isMeetingModerator({
            userId: "admin-1",
            groupAdminId: "admin-1",
        }),
        true,
    );
});

test("group co-moderator is not moderator in meeting role policy", () => {
    assert.equal(
        isMeetingModerator({
            userId: "co-mod-1",
            groupAdminId: "admin-1",
        }),
        false,
    );
});

