import test from "node:test";
import assert from "node:assert/strict";
import { resolveMeetingRatingTargetUserId } from "../utils/meetingRatingRules";

test("1:1 meeting returns the other participant as target", () => {
    const target = resolveMeetingRatingTargetUserId(
        { conversationId: "c1", participants: ["u1", "u2"], startedBy: "u1" },
        "u1",
    );
    assert.equal(target, "u2");
});

test("seminar meeting returns moderator as target", () => {
    const target = resolveMeetingRatingTargetUserId(
        { groupChatId: "g1", participants: ["u1", "u2", "u3"], startedBy: "u1" },
        "u2",
    );
    assert.equal(target, "u1");
});

test("moderator cannot self-rate in seminar flow", () => {
    const target = resolveMeetingRatingTargetUserId(
        { groupChatId: "g1", participants: ["u1", "u2"], startedBy: "u1" },
        "u1",
    );
    assert.equal(target, null);
});

test("non-participant cannot rate", () => {
    const target = resolveMeetingRatingTargetUserId(
        { conversationId: "c1", participants: ["u1", "u2"], startedBy: "u1" },
        "u9",
    );
    assert.equal(target, null);
});

