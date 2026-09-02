import test from "node:test";
import assert from "node:assert/strict";
import {
    isMachineRoomLabel,
    parseGroupChatIdFromRoomName,
    pickRoomDisplayLabel,
} from "../utils/chatRoomLabels";

test("parseGroupChatIdFromRoomName extracts the group chat id", () => {
    assert.equal(
        parseGroupChatIdFromRoomName("wl-group-6a3d8082d453a05cdb82c2db"),
        "6a3d8082d453a05cdb82c2db",
    );
    assert.equal(parseGroupChatIdFromRoomName("WL-GROUP-6A3D8082D453A05CDB82C2DB"), "6a3d8082d453a05cdb82c2db");
});

test("parseGroupChatIdFromRoomName ignores non-group names", () => {
    assert.equal(parseGroupChatIdFromRoomName("tmp group with Honai"), null);
    assert.equal(parseGroupChatIdFromRoomName("wl-group-notanid"), null);
    assert.equal(parseGroupChatIdFromRoomName(""), null);
    assert.equal(parseGroupChatIdFromRoomName(undefined), null);
});

test("isMachineRoomLabel flags Rocket.Chat slugs", () => {
    assert.equal(isMachineRoomLabel("wl-group-6a3d8082d453a05cdb82c2db"), true);
    assert.equal(isMachineRoomLabel("wl_abc123"), true);
    assert.equal(isMachineRoomLabel("pradyumnayerabati14_gmail_com"), true);
    assert.equal(isMachineRoomLabel("u_14_gmail_com"), true);
    assert.equal(isMachineRoomLabel(""), true);
    assert.equal(isMachineRoomLabel(null), true);
});

test("isMachineRoomLabel keeps human titles", () => {
    assert.equal(isMachineRoomLabel("tmp group with Honai"), false);
    assert.equal(isMachineRoomLabel("Test with Dr Wang"), false);
    assert.equal(isMachineRoomLabel("Xiubin"), false);
    assert.equal(isMachineRoomLabel("john_doe"), false);
});

test("pickRoomDisplayLabel prefers the resolved name", () => {
    assert.equal(
        pickRoomDisplayLabel("tmp group with Honai", "wl-group-6a3d8082d453a05cdb82c2db", "Community"),
        "tmp group with Honai",
    );
});

test("pickRoomDisplayLabel falls back when only a slug is available", () => {
    assert.equal(pickRoomDisplayLabel("", "wl-group-6a3d8082d453a05cdb82c2db", "Community"), "Community");
    assert.equal(pickRoomDisplayLabel(null, "pradyumnayerabati14_gmail_com", "Someone"), "Someone");
});

test("pickRoomDisplayLabel uses a human raw room name when nothing was resolved", () => {
    assert.equal(pickRoomDisplayLabel("", "Test with Dr Wang", "Community"), "Test with Dr Wang");
});
