import test from "node:test";
import assert from "node:assert/strict";
import { isMeetingModerator, isMeetingModeratorWithDelegates } from "../utils/meetingRoleRules";

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

test("delegated user is moderator in DM when listed", () => {
    assert.equal(
        isMeetingModeratorWithDelegates({
            conversationId: "conv1",
            userId: "u-co",
            startedBy: "u1",
            delegatedModeratorIds: ["other", "u-co"],
        }),
        true,
    );
});

test("delegated user is moderator in group when listed", () => {
    assert.equal(
        isMeetingModeratorWithDelegates({
            userId: "u2",
            groupAdminId: "admin-1",
            delegatedModeratorIds: ["u2"],
        }),
        true,
    );
});

test("non-delegated non-host is still not moderator in group", () => {
    assert.equal(
        isMeetingModeratorWithDelegates({
            userId: "u2",
            groupAdminId: "admin-1",
            delegatedModeratorIds: [],
        }),
        false,
    );
});

