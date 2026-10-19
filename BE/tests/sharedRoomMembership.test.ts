import test from "node:test";
import assert from "node:assert/strict";
import { canAccessSharedRoom, sharedRoomMemberIds } from "../utils/sharedRoomMembership";

const EXPERT = "aaaaaaaaaaaaaaaaaaaaaaaa";
const EARLY = "bbbbbbbbbbbbbbbbbbbbbbbb";
const LATE = "cccccccccccccccccccccccc";
const ADMIN = "dddddddddddddddddddddddd";
const OUTSIDER = "eeeeeeeeeeeeeeeeeeeeeeee";

// A series where LATE registered after the first session had passed, so only later
// sessions list them — exactly what enrollAndConfirmSeminar produces.
const series = [
    { admin: EXPERT, participants: [EXPERT, EARLY], coModerators: [] },
    { admin: EXPERT, participants: [EXPERT, EARLY, LATE], coModerators: [] },
    { admin: EXPERT, participants: [EXPERT, EARLY, LATE], coModerators: [] },
];

test("a member of any session in the series can access the shared room", () => {
    assert.equal(canAccessSharedRoom(series, { userId: LATE, role: "customer" }), true);
    assert.equal(canAccessSharedRoom(series, { userId: EARLY, role: "customer" }), true);
    assert.equal(canAccessSharedRoom(series, { userId: EXPERT, role: "expert" }), true);
});

test("the late joiner is refused when only the first session is considered", () => {
    assert.equal(canAccessSharedRoom([series[0]], { userId: LATE, role: "customer" }), false);
});

test("someone in no session is refused", () => {
    assert.equal(canAccessSharedRoom(series, { userId: OUTSIDER, role: "customer" }), false);
});

test("members are the union across sessions, each listed once", () => {
    assert.deepEqual(sharedRoomMemberIds(series).sort(), [EXPERT, EARLY, LATE].sort());
});

test("co-moderators count as members", () => {
    assert.equal(
        canAccessSharedRoom([{ admin: EXPERT, participants: [], coModerators: [OUTSIDER] }], { userId: OUTSIDER }),
        true,
    );
});

test("populated documents and ObjectId-like values resolve to the same ids", () => {
    const populated = [{ admin: { _id: EXPERT }, participants: [{ _id: LATE }], coModerators: [] }];
    assert.deepEqual(sharedRoomMemberIds(populated).sort(), [EXPERT, LATE].sort());
    assert.equal(canAccessSharedRoom(populated, { userId: { toString: () => LATE } as any }), true);
});

test("a platform admin who joined as chat admin on any session can access", () => {
    const withAdmin = [series[0], { ...series[1], chatAdmins: [ADMIN] }];
    assert.equal(canAccessSharedRoom(withAdmin, { userId: ADMIN, role: "admin" }), true);
});

test("being listed as chat admin does not help a non-admin role", () => {
    const withAdmin = [{ ...series[0], chatAdmins: [OUTSIDER] }];
    assert.equal(canAccessSharedRoom(withAdmin, { userId: OUTSIDER, role: "customer" }), false);
});

test("no rooms, missing viewer or blank id are all refused", () => {
    assert.equal(canAccessSharedRoom([], { userId: LATE }), false);
    assert.equal(canAccessSharedRoom(null, { userId: LATE }), false);
    assert.equal(canAccessSharedRoom(series, null), false);
    assert.equal(canAccessSharedRoom(series, { userId: "  " }), false);
    assert.deepEqual(sharedRoomMemberIds(null), []);
});

test("a single non-series room behaves exactly as before", () => {
    const community = [{ admin: EXPERT, participants: [EXPERT, EARLY], coModerators: [LATE] }];
    assert.deepEqual(sharedRoomMemberIds(community).sort(), [EXPERT, EARLY, LATE].sort());
    assert.equal(canAccessSharedRoom(community, { userId: OUTSIDER }), false);
});
