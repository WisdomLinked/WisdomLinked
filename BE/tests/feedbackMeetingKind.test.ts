import test from "node:test";
import assert from "node:assert/strict";
import { resolveFeedbackMeetingKind, toLookupIds, isLookupId } from "../utils/feedbackMeetingKind";

test("seminar group chat yields the seminar name", () => {
    assert.deepEqual(
        resolveFeedbackMeetingKind({
            eventType: "group-meeting",
            groupChat: { name: "Intro to Quantum Computing", type: "seminar" },
        }),
        { kind: "seminar", name: "Intro to Quantum Computing" },
    );
});

test("a modern 1:1 is not mistaken for a seminar", () => {
    assert.deepEqual(
        resolveFeedbackMeetingKind({
            eventType: "group-meeting",
            groupChat: { name: "Session with Dr Wang", type: "individual" },
        }),
        { kind: "individual", name: null },
    );
});

test("community group chat is distinguished from a seminar", () => {
    assert.deepEqual(
        resolveFeedbackMeetingKind({
            eventType: "group-meeting",
            groupChat: { name: "Physics Community", type: "community" },
        }),
        { kind: "community", name: "Physics Community" },
    );
});

test("a DM meeting (no groupChatId) is a 1:1", () => {
    assert.deepEqual(
        resolveFeedbackMeetingKind({ eventType: "meeting", groupChat: null }),
        { kind: "individual", name: null },
    );
});

test("a legacy Event row falls back to its eventId", () => {
    assert.deepEqual(
        resolveFeedbackMeetingKind({ eventType: null, eventId: "e1", groupChat: null }),
        { kind: "individual", name: null },
    );
});

test("legacy leaveFeedback rows using the raw seminar type still resolve", () => {
    assert.deepEqual(
        resolveFeedbackMeetingKind({
            eventType: "seminar",
            groupChat: { name: "Old Seminar", type: undefined },
        }),
        { kind: "seminar", name: "Old Seminar" },
    );
});

test("a deleted session degrades to unknown instead of throwing", () => {
    assert.equal(
        resolveFeedbackMeetingKind({ eventType: "group-meeting", groupChat: null }).kind,
        "unknown",
    );
    assert.deepEqual(resolveFeedbackMeetingKind({}), { kind: "unknown", name: null });
});

test("lookup ids drop anything Mongoose could not cast", () => {
    // A single unparseable groupChatId used to make the whole admin feedback
    // page 500, because it reached GroupChat.find({ _id: { $in: [...] } }).
    assert.deepEqual(
        toLookupIds(["6aa24cdebfc78bbb55098f9d", "not-a-valid-objectid", null, undefined, "", "   "]),
        ["6aa24cdebfc78bbb55098f9d"],
    );
    assert.deepEqual(toLookupIds(["6aa24cdebfc78bbb55098f9d", "6aa24cdebfc78bbb55098f9d"]),
        ["6aa24cdebfc78bbb55098f9d"]);
    assert.equal(isLookupId("6aa24cdebfc78bbb55098f9d"), true);
    assert.equal(isLookupId("not-a-valid-objectid"), false);
    assert.equal(isLookupId(null), false);
});
