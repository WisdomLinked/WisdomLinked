import test from "node:test";
import assert from "node:assert/strict";
import { hasJoinedCommunity } from "../utils/communityMembership";

const COMMUNITY = "6aa24cdebfc78bbb55098f9d";
const ME = "6aa236cf1b9553b71d016d2d";
const SOMEONE_ELSE = "6aa236dc1b9553b71d016d34";

test("a user who pressed Join is joined", () => {
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY }, ME, [COMMUNITY]), true);
});

test("an invitee who has not pressed Join is NOT joined", () => {
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY }, ME, []), false);
});

test("the community admin never has to press Join", () => {
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY, admin: ME }, ME, []), true);
});

test("a co-moderator never has to press Join", () => {
    assert.equal(
        hasJoinedCommunity({ _id: COMMUNITY, coModerators: [SOMEONE_ELSE, ME] }, ME, []),
        true,
    );
});

test("someone else's admin or co-moderator status does not make me joined", () => {
    assert.equal(
        hasJoinedCommunity(
            { _id: COMMUNITY, admin: SOMEONE_ELSE, coModerators: [SOMEONE_ELSE] },
            ME,
            [],
        ),
        false,
    );
});

test("populated documents are accepted as well as raw ids", () => {
    assert.equal(
        hasJoinedCommunity({ _id: { toString: () => COMMUNITY } }, { _id: ME }, [{ _id: COMMUNITY }]),
        true,
    );
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY, admin: { _id: ME } }, ME, []), true);
});

test("a joined entry for a different community does not count", () => {
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY }, ME, [SOMEONE_ELSE]), false);
});

test("missing input never throws", () => {
    assert.equal(hasJoinedCommunity(null, ME, [COMMUNITY]), false);
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY }, null, [COMMUNITY]), false);
    assert.equal(hasJoinedCommunity({ _id: COMMUNITY }, ME, null), false);
    assert.equal(hasJoinedCommunity({}, ME, []), false);
});
