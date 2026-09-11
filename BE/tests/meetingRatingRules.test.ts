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


import {
    buildMeetingFeedbackEntry,
    upsertMeetingFeedback,
    averageFeedbackRating,
} from "../utils/meetingRatingRules";

const meeting1to1 = {
    _id: "m1",
    conversationId: "c1",
    startedAt: new Date("2026-01-01T10:00:00Z"),
    endedAt: new Date("2026-01-01T10:30:00Z"),
    duration: 1800,
};

test("meeting feedback entry matches the shape the admin page renders", () => {
    const entry = buildMeetingFeedbackEntry({
        meeting: meeting1to1,
        raterUserId: "student1",
        score: 5,
        comment: "  Great session  ",
    });
    // otherUserId is the rater: the entry lives on the person being rated.
    assert.equal(entry.otherUserId, "student1");
    assert.equal(entry.rating, 5);
    assert.equal(entry.description, "Great session");
    assert.equal(entry.meetingThreadId, "m1");
    assert.equal(entry.groupChatId, null);
    assert.equal(entry.eventType, "meeting");
    assert.equal(entry.totalTimeSpent, 30, "seconds must be converted to minutes");
});

test("group meeting entry carries the groupChatId so the session name resolves", () => {
    const entry = buildMeetingFeedbackEntry({
        meeting: { _id: "m2", groupChatId: "g9", duration: 600 },
        raterUserId: "student1",
        score: 4,
    });
    assert.equal(entry.groupChatId, "g9");
    assert.equal(entry.eventType, "group-meeting");
    assert.equal(entry.description, "");
});

test("re-rating the same meeting updates in place instead of double counting", () => {
    const first = buildMeetingFeedbackEntry({ meeting: meeting1to1, raterUserId: "student1", score: 5 });
    let list = upsertMeetingFeedback([], first);
    assert.equal(list.length, 1);

    const revised = buildMeetingFeedbackEntry({
        meeting: meeting1to1,
        raterUserId: "student1",
        score: 2,
        comment: "changed my mind",
    });
    list = upsertMeetingFeedback(list, revised);
    assert.equal(list.length, 1, "an edited rating must not append a second entry");
    assert.equal(list[0].rating, 2);
    assert.equal(list[0].description, "changed my mind");
    assert.equal(averageFeedbackRating(list), 2);
});

test("a different rater on the same meeting adds a separate entry", () => {
    const a = buildMeetingFeedbackEntry({ meeting: meeting1to1, raterUserId: "student1", score: 5 });
    const b = buildMeetingFeedbackEntry({ meeting: meeting1to1, raterUserId: "student2", score: 3 });
    const list = upsertMeetingFeedback(upsertMeetingFeedback([], a), b);
    assert.equal(list.length, 2);
    assert.equal(averageFeedbackRating(list), 4);
});

test("the same rater on a different meeting adds a separate entry", () => {
    const a = buildMeetingFeedbackEntry({ meeting: meeting1to1, raterUserId: "student1", score: 5 });
    const b = buildMeetingFeedbackEntry({
        meeting: { ...meeting1to1, _id: "m-other" },
        raterUserId: "student1",
        score: 1,
    });
    const list = upsertMeetingFeedback(upsertMeetingFeedback([], a), b);
    assert.equal(list.length, 2);
});

test("existing leaveFeedback entries are preserved untouched", () => {
    const legacy = { rating: 4, description: "from the old flow", otherUserId: "student9", date: new Date() };
    const entry = buildMeetingFeedbackEntry({ meeting: meeting1to1, raterUserId: "student1", score: 5 });
    const list = upsertMeetingFeedback([legacy], entry);
    assert.equal(list.length, 2);
    assert.deepEqual(list[0], legacy, "a legacy entry must not be rewritten");
    assert.equal(averageFeedbackRating(list), 4.5);
});

test("average ignores unrated entries and empty lists", () => {
    assert.equal(averageFeedbackRating([]), 0);
    assert.equal(averageFeedbackRating(null), 0);
    assert.equal(averageFeedbackRating([{ rating: 5 }, { description: "no score" }]), 5);
});

test("editing keeps the original date so it does not resurface as new", () => {
    const original = new Date("2026-01-01T00:00:00Z");
    const first = buildMeetingFeedbackEntry({ meeting: meeting1to1, raterUserId: "s1", score: 5, now: original });
    const later = buildMeetingFeedbackEntry({
        meeting: meeting1to1, raterUserId: "s1", score: 1, now: new Date("2026-02-02T00:00:00Z"),
    });
    const list = upsertMeetingFeedback(upsertMeetingFeedback([], first), later);
    assert.equal(list[0].date.toISOString(), original.toISOString());
    assert.equal(list[0].rating, 1);
});

test("meeting duration in seconds is stored as whole minutes", () => {
    const mk = (seconds: number) =>
        buildMeetingFeedbackEntry({
            meeting: { _id: "m", duration: seconds },
            raterUserId: "s1",
            score: 5,
        }).totalTimeSpent;
    assert.equal(mk(1800), 30);
    assert.equal(mk(3600), 60);
    assert.equal(mk(90), 2, "rounds to the nearest minute");
    assert.equal(mk(0), 0);
    assert.equal(mk(undefined as any), 0);
});
