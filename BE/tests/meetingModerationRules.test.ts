import test from "node:test";
import assert from "node:assert/strict";
import {
    buildMeetingRoomName,
    canStartGroupMeeting,
    canEndMeetingAsLastParticipant,
} from "../utils/meetingModerationRules";

test("buildMeetingRoomName includes scope timestamp and random suffix", () => {
    const room = buildMeetingRoomName("group1", 1234567890, "abc123");
    assert.equal(room, "wl-group1-1234567890-abc123");
});

test("community start allows admin and co-moderators", () => {
    const group = { type: "community", admin: "u1", participants: ["u1", "u2"], coModerators: ["u2"] };
    assert.equal(canStartGroupMeeting(group, { _id: "u1", role: "expert" }), true);
    assert.equal(canStartGroupMeeting(group, { _id: "u1", role: "customer" }), true);
    assert.equal(canStartGroupMeeting(group, { _id: "u2", role: "expert" }), true);
    assert.equal(canStartGroupMeeting(group, { _id: "u3", role: "expert" }), false);
});

test("group type still requires admin starter", () => {
    const group = { type: "individual", admin: "u1", participants: ["u1", "u2"] };
    assert.equal(canStartGroupMeeting(group, { _id: "u2", role: "customer" }), false);
});

test("non participant cannot start", () => {
    const group = { type: "community", admin: "u1", participants: ["u1", "u2"] };
    assert.equal(canStartGroupMeeting(group, { _id: "u9", role: "expert" }), false);
});


const NOW = 1_700_000_000_000;
const FRESH = 90_000;

test("a fresh heartbeat reporting other people blocks the end", () => {
    const meeting = { lastHeartbeatAt: new Date(NOW - 10_000), lastReportedRemoteCount: 2 };
    assert.equal(canEndMeetingAsLastParticipant(meeting, NOW, FRESH), false);
});

test("a fresh heartbeat reporting an empty room allows the end", () => {
    const meeting = { lastHeartbeatAt: new Date(NOW - 10_000), lastReportedRemoteCount: 0 };
    assert.equal(canEndMeetingAsLastParticipant(meeting, NOW, FRESH), true);
});

test("a stale heartbeat no longer describes the room, so the claim is refused", () => {
    const meeting = { lastHeartbeatAt: new Date(NOW - 120_000), lastReportedRemoteCount: 0 };
    assert.equal(canEndMeetingAsLastParticipant(meeting, NOW, FRESH), false);
});

test("no heartbeat at all is not evidence of an empty room", () => {
    assert.equal(canEndMeetingAsLastParticipant({}, NOW, FRESH), false);
    assert.equal(canEndMeetingAsLastParticipant(null, NOW, FRESH), false);
    assert.equal(
        canEndMeetingAsLastParticipant(
            { lastHeartbeatAt: new Date(NOW), lastReportedRemoteCount: null },
            NOW,
            FRESH,
        ),
        false,
    );
});

test("a heartbeat exactly at the freshness limit still counts", () => {
    const empty = { lastHeartbeatAt: new Date(NOW - FRESH), lastReportedRemoteCount: 0 };
    const busy = { lastHeartbeatAt: new Date(NOW - FRESH), lastReportedRemoteCount: 1 };
    assert.equal(canEndMeetingAsLastParticipant(empty, NOW, FRESH), true);
    assert.equal(canEndMeetingAsLastParticipant(busy, NOW, FRESH), false);
});
