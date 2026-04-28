import test from "node:test";
import assert from "node:assert/strict";
import { appendJitsiMobileWebOverrides } from "../utils/jitsiUrl";

test("appends mobile web overrides when URL has no hash", () => {
    const url = appendJitsiMobileWebOverrides("https://meet.wisdomlinked.com/room-123");
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123#config.disableDeepLinking=true&config.deeplinking.disabled=true&interfaceConfig.MOBILE_APP_PROMO=true",
    );
});

test("appends mobile web overrides after jwt query string", () => {
    const url = appendJitsiMobileWebOverrides("https://meet.wisdomlinked.com/room-123?jwt=abc");
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&interfaceConfig.MOBILE_APP_PROMO=true",
    );
});

test("adds overrides to existing hash config", () => {
    const url = appendJitsiMobileWebOverrides("https://meet.wisdomlinked.com/room-123#config.prejoinConfig.enabled=true");
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123#config.prejoinConfig.enabled=true&config.disableDeepLinking=true&config.deeplinking.disabled=true&interfaceConfig.MOBILE_APP_PROMO=true",
    );
});

test("adds application return URL overrides when provided", () => {
    const url = appendJitsiMobileWebOverrides(
        "https://meet.wisdomlinked.com/room-123?jwt=abc",
        "https://wisdomlinked.com/user",
    );
    assert.equal(
        url,
        "https://meet.wisdomlinked.com/room-123?jwt=abc#config.disableDeepLinking=true&config.deeplinking.disabled=true&interfaceConfig.MOBILE_APP_PROMO=true&config.enableClosePage=false&config.welcomePage.customUrl=https%3A%2F%2Fwisdomlinked.com%2Fuser",
    );
});

