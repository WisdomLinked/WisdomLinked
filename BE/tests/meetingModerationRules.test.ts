import test from "node:test";
import assert from "node:assert/strict";
import { buildMeetingRoomName, canStartGroupMeeting } from "../utils/meetingModerationRules";

test("buildMeetingRoomName includes scope timestamp and random suffix", () => {
    const room = buildMeetingRoomName("group1", 1234567890, "abc123");
    assert.equal(room, "wl-group1-1234567890-abc123");
});

test("community/seminar start requires expert admin", () => {
    const group = { type: "community", admin: "u1", participants: ["u1", "u2"] };
    assert.equal(canStartGroupMeeting(group, { _id: "u1", role: "expert" }), true);
    assert.equal(canStartGroupMeeting(group, { _id: "u2", role: "expert" }), false);
    assert.equal(canStartGroupMeeting(group, { _id: "u1", role: "customer" }), false);
});

test("individual type allows participant starter", () => {
    const group = { type: "individual", admin: "u1", participants: ["u1", "u2"] };
    assert.equal(canStartGroupMeeting(group, { _id: "u2", role: "customer" }), true);
});

test("non participant cannot start", () => {
    const group = { type: "community", admin: "u1", participants: ["u1", "u2"] };
    assert.equal(canStartGroupMeeting(group, { _id: "u9", role: "expert" }), false);
});

