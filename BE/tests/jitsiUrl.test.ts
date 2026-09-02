import test from "node:test";
import assert from "node:assert/strict";
import { appendJitsiMobileWebOverrides } from "../utils/jitsiUrl";

test("appends mobile web overrides when URL has no hash", () => {
    const url = appendJitsiMobileWebOverrides("https://meet.wisdomlinked.com/room-123");
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123#config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=true",
    );
});

test("appends mobile web overrides after jwt query string", () => {
    const url = appendJitsiMobileWebOverrides("https://meet.wisdomlinked.com/room-123?jwt=abc");
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=true",
    );
});

test("adds overrides to existing hash config", () => {
    const url = appendJitsiMobileWebOverrides("https://meet.wisdomlinked.com/room-123#config.prejoinConfig.enabled=true");
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123#config.prejoinConfig.enabled=true&config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=true",
    );
});

test("adds application return URL overrides when provided", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-123?jwt=abc",
        "https://wisdomlinked.com/user",
    );
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=true&config.wisdomlinkedReturnUrl=https%3A%2F%2Fwisdomlinked.com%2Fuser",
    );
});

test("does not use whitelist-stripped welcomePage config for the return URL", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-123?jwt=abc",
        "https://wisdomlinked.com/user",
    );
    assert.ok(!url.includes("welcomePage"));
});

test("adds WisdomLinked meeting id for Jitsi UI customization", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-123?jwt=abc",
        undefined,
        true,
        "meeting-thread-123",
    );
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=true&config.wisdomlinkedMeetingId=meeting-thread-123",
    );
});

test("adds whiteboard initials hash when provided", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-1?jwt=abc",
        undefined,
        true,
        "meeting-thread-123",
        undefined,
        undefined,
        "KP",
    );
    assert.ok(url.includes("config.wisdomlinkedWhiteboardInitials=KP"));
});

test("adds meeting chat sync token and API base when provided", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-1?jwt=abc",
        undefined,
        true,
        "mid-1",
        "tok-abc",
        "https://api.example.com",
    );
    assert.ok(url.includes("config.wisdomlinkedChatSyncToken=tok-abc"));
    assert.ok(url.includes("config.wisdomlinkedChatSyncApiBase=https%3A%2F%2Fapi.example.com"));
});

test("adds messenger origin hash when provided", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-1?jwt=abc",
        undefined,
        true,
        "mid-1",
        undefined,
        undefined,
        undefined,
        undefined,
        "https://staging.wisdomlinked.com",
    );
    assert.ok(url.includes("config.wisdomlinkedMessengerOrigin=https%3A%2F%2Fstaging.wisdomlinked.com"));
});

test("adds meeting moderator hash when provided", () => {
    const modUrl = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-1?jwt=abc",
        undefined,
        true,
        "mid-1",
        undefined,
        undefined,
        undefined,
        true,
    );
    assert.ok(modUrl.includes("config.wisdomlinkedIsMeetingModerator=true"));

    const partUrl = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-1?jwt=abc",
        undefined,
        true,
        "mid-1",
        undefined,
        undefined,
        undefined,
        false,
    );
    assert.ok(partUrl.includes("config.wisdomlinkedIsMeetingModerator=false"));
});

test("disables whiteboard when explicitly requested", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-123?jwt=abc",
        undefined,
        false,
    );
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=false",
    );
});

