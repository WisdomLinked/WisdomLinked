import test from "node:test";
import assert from "node:assert/strict";
import { buildRemovedUserNotice, normalizeModerationReason } from "../utils/videoModerationNotice";

test("uses default reason when blank", () => {
    assert.equal(normalizeModerationReason(""), "due to concerns");
});

test("normalizes whitespace and truncates long reasons", () => {
    const long = "a".repeat(260);
    const normalized = normalizeModerationReason(`  ${long}   `);
    assert.equal(normalized.endsWith("..."), true);
    assert.equal(normalized.length <= 223, true);
});

test("builds user-facing removal notice", () => {
    const msg = buildRemovedUserNotice("being disruptive");
    assert.equal(msg.includes("being disruptive"), true);
    assert.equal(msg.includes("Contact Us"), true);
});

