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
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&config.disableInviteFunctions=true&config.securityUi.enabled=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&interfaceConfig.MOBILE_APP_PROMO=true&config.whiteboard.enabled=true&config.welcomePage.customUrl=https%3A%2F%2Fwisdomlinked.com%2Fuser",
    );
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

