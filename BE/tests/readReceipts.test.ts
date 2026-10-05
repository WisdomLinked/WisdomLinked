import test from "node:test";
import assert from "node:assert/strict";
import {
    GROUP_SEEN_MEMBER_CAP,
    distinctMemberIds,
    isGroupSeenTrackable,
    lastReadMsForMembers,
    resolveRoomSeenMs,
} from "../utils/readReceipts";

test("a room is seen only up to the member who read least recently", () => {
    assert.equal(resolveRoomSeenMs([3000, 1000, 2000]), 1000);
});

test("one member is the whole answer in a two-person room", () => {
    assert.equal(resolveRoomSeenMs([5000]), 5000);
});

test("a member who has never opened the room blocks the whole room", () => {
    assert.equal(resolveRoomSeenMs([3000, null, 2000]), null);
    assert.equal(resolveRoomSeenMs([undefined, 2000]), null);
});

test("no members means nothing can be seen", () => {
    assert.equal(resolveRoomSeenMs([]), null);
    assert.equal(resolveRoomSeenMs(null as any), null);
});

test("a NaN timestamp is treated as no evidence, not as zero", () => {
    assert.equal(resolveRoomSeenMs([Number.NaN, 2000]), null);
});

test("epoch zero is a real timestamp, not a missing one", () => {
    assert.equal(resolveRoomSeenMs([0, 2000]), 0);
});

test("small rooms are tracked, empty and oversized ones are not", () => {
    assert.equal(isGroupSeenTrackable(1), true);
    assert.equal(isGroupSeenTrackable(GROUP_SEEN_MEMBER_CAP), true);
    assert.equal(isGroupSeenTrackable(GROUP_SEEN_MEMBER_CAP + 1), false);
    assert.equal(isGroupSeenTrackable(0), false);
});

test("the cap is overridable for callers that want a different ceiling", () => {
    assert.equal(isGroupSeenTrackable(5, 4), false);
    assert.equal(isGroupSeenTrackable(4, 4), true);
});

test("the admin, who is also a participant, is counted once and not twice", () => {
    // Every group this codebase creates lists the admin in `participants` too.
    assert.deepEqual(distinctMemberIds(["admin", "admin", "student"]), ["admin", "student"]);
});

test("a co-moderator who is also a participant is counted once", () => {
    assert.deepEqual(distinctMemberIds(["admin", "admin", "mod", "mod"]), ["admin", "mod"]);
});

test("a duplicated peer still leaves one other member to ask about", () => {
    const members = distinctMemberIds(["expert", "expert", "student"]);
    const others = members.filter((id) => id !== "student");
    assert.deepEqual(others, ["expert"]);
    assert.equal(isGroupSeenTrackable(others.length), true);
});

test("a cap-sized room is still trackable once duplicates are removed", () => {
    const real = Array.from({ length: GROUP_SEEN_MEMBER_CAP }, (_, i) => `u${i}`);
    assert.equal(isGroupSeenTrackable(real.concat(real[0]).length), false);
    assert.equal(isGroupSeenTrackable(distinctMemberIds(real.concat(real[0])).length), true);
});

test("blank and missing ids are dropped, order of first appearance is kept", () => {
    assert.deepEqual(distinctMemberIds(["b", "", null, "a", undefined, " ", "b"]), ["b", "a"]);
    assert.deepEqual(distinctMemberIds(null as any), []);
});

test("stored read rows are lined up against the members asked about, in order", () => {
    const rows = [
        { userId: "b", lastReadAt: new Date(2000) },
        { userId: "a", lastReadAt: new Date(1000) },
    ];
    assert.deepEqual(lastReadMsForMembers(rows, ["a", "b"]), [1000, 2000]);
});

test("a member with no stored row reports null, not a missing slot", () => {
    const rows = [{ userId: "a", lastReadAt: new Date(1000) }];
    assert.deepEqual(lastReadMsForMembers(rows, ["a", "never-opened"]), [1000, null]);
});

test("a member who has never opened the room keeps the room from being seen", () => {
    const rows = [{ userId: "a", lastReadAt: new Date(5000) }];
    const perMember = lastReadMsForMembers(rows, ["a", "b"]);
    assert.equal(resolveRoomSeenMs(perMember), null);
});

test("once everyone has a row, the room is seen up to the earliest of them", () => {
    const rows = [
        { userId: "a", lastReadAt: new Date(5000) },
        { userId: "b", lastReadAt: new Date(3000) },
    ];
    assert.equal(resolveRoomSeenMs(lastReadMsForMembers(rows, ["a", "b"])), 3000);
});

test("a populated userId object is matched as well as a bare id", () => {
    const rows = [{ userId: { _id: "a" }, lastReadAt: new Date(1000) }];
    assert.deepEqual(lastReadMsForMembers(rows, ["a"]), [1000]);
});

test("an unparseable or missing lastReadAt is treated as never read", () => {
    assert.deepEqual(lastReadMsForMembers([{ userId: "a", lastReadAt: null }], ["a"]), [null]);
    assert.deepEqual(lastReadMsForMembers([{ userId: "a", lastReadAt: "nonsense" }], ["a"]), [null]);
    assert.deepEqual(lastReadMsForMembers([{ userId: "", lastReadAt: new Date(1) }], ["a"]), [null]);
});

test("a blank id never resolves to a read, even if asked about", () => {
    assert.deepEqual(lastReadMsForMembers([{ userId: "", lastReadAt: new Date(5000) }], [""]), [null]);
});

test("rows for people we did not ask about are ignored", () => {
    const rows = [
        { userId: "stranger", lastReadAt: new Date(9999) },
        { userId: "a", lastReadAt: new Date(1000) },
    ];
    assert.deepEqual(lastReadMsForMembers(rows, ["a"]), [1000]);
});

test("if duplicate rows ever appear, the newer read wins whatever order they arrive in", () => {
    const newestFirst = [
        { userId: "a", lastReadAt: new Date(7000) },
        { userId: "a", lastReadAt: new Date(1000) },
    ];
    assert.deepEqual(lastReadMsForMembers(newestFirst, ["a"]), [7000]);
    const newestLast = [
        { userId: "a", lastReadAt: new Date(1000) },
        { userId: "a", lastReadAt: new Date(7000) },
    ];
    assert.deepEqual(lastReadMsForMembers(newestLast, ["a"]), [7000]);
});

test("no rows and no members are both handled", () => {
    assert.deepEqual(lastReadMsForMembers([], ["a"]), [null]);
    assert.deepEqual(lastReadMsForMembers(null as any, ["a"]), [null]);
    assert.deepEqual(lastReadMsForMembers([], []), []);
});
