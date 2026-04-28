import test from "node:test";
import assert from "node:assert/strict";
import { buildMeetingInviteUrl, resolvePublicAppBaseUrl } from "../utils/inviteUrl";

test("resolvePublicAppBaseUrl prefers configured FE/app URL", () => {
    const base = resolvePublicAppBaseUrl("https://staging.wisdomlinked.com", {
        origin: "https://api.example.com",
        host: "api.example.com",
        xForwardedProto: "https",
    });
    assert.equal(base, "https://staging.wisdomlinked.com");
});

test("resolvePublicAppBaseUrl falls back to origin header", () => {
    const base = resolvePublicAppBaseUrl("", {
        origin: "https://staging.wisdomlinked.com",
    });
    assert.equal(base, "https://staging.wisdomlinked.com");
});

test("resolvePublicAppBaseUrl builds from forwarded proto and host", () => {
    const base = resolvePublicAppBaseUrl("", {
        xForwardedProto: "https",
        xForwardedHost: "staging.wisdomlinked.com",
    });
    assert.equal(base, "https://staging.wisdomlinked.com");
});

test("buildMeetingInviteUrl returns absolute invite URL", () => {
    const url = buildMeetingInviteUrl("https://staging.wisdomlinked.com", "abc123");
    assert.equal(url, "https://staging.wisdomlinked.com/meeting/invite/abc123");
});

test("buildMeetingInviteUrl falls back to relative path when base missing", () => {
    const url = buildMeetingInviteUrl("", "abc123");
    assert.equal(url, "/meeting/invite/abc123");
});

