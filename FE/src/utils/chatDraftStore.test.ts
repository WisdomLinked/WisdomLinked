import { beforeEach, describe, expect, it } from "vitest";
import { chatDraftKey, clearDraft, readDraft, writeDraft } from "./chatDraftStore";

const STORAGE_KEY = "wl_chat_drafts_v1";

const ME = "user-1";

describe("chatDraftKey", () => {
    it("keys a group thread by its group id", () => {
        expect(chatDraftKey(ME, null, { groupId: "g1" })).toBe("user-1|group|g1");
    });

    it("keys a DM by the peer's user id", () => {
        expect(chatDraftKey(ME, { userId: "u2" }, null)).toBe("user-1|dm|u2");
    });

    it("falls back to _id when a group carries no groupId", () => {
        expect(chatDraftKey(ME, null, { _id: "g9" })).toBe("user-1|group|g9");
    });

    it("prefers the DM, matching the thread a send would go to", () => {
        expect(chatDraftKey(ME, { userId: "u2" }, { groupId: "g1" })).toBe("user-1|dm|u2");
    });

    it("returns null without a signed-in owner, so drafts are never unattributed", () => {
        expect(chatDraftKey(null, null, { groupId: "g1" })).toBeNull();
        expect(chatDraftKey("", null, { groupId: "g1" })).toBeNull();
    });

    it("returns null when no conversation is open", () => {
        expect(chatDraftKey(ME, null, null)).toBeNull();
        expect(chatDraftKey(ME, { userId: "" }, { groupId: "" })).toBeNull();
    });

    it("treats stringified null/undefined ids as absent", () => {
        expect(chatDraftKey(ME, { userId: null }, { groupId: undefined })).toBeNull();
        expect(chatDraftKey(ME, null, { groupId: "undefined" })).toBeNull();
    });

    it("separates the same conversation for different signed-in users", () => {
        expect(chatDraftKey("a", null, { groupId: "g1" })).not.toBe(
            chatDraftKey("b", null, { groupId: "g1" }),
        );
    });

    it("accepts numeric ids", () => {
        expect(chatDraftKey(1, { userId: 2 }, null)).toBe("1|dm|2");
    });
});

describe("draft read/write", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("returns an empty string when nothing was stored", () => {
        expect(readDraft("k1")).toBe("");
    });

    it("round-trips a draft", () => {
        writeDraft("k1", "<p>hello</p>");
        expect(readDraft("k1")).toBe("<p>hello</p>");
    });

    it("keeps drafts for different conversations apart", () => {
        writeDraft("k1", "<p>seminar</p>");
        writeDraft("k2", "<p>community</p>");
        expect(readDraft("k1")).toBe("<p>seminar</p>");
        expect(readDraft("k2")).toBe("<p>community</p>");
    });

    it("overwrites an existing draft for the same conversation", () => {
        writeDraft("k1", "<p>first</p>");
        writeDraft("k1", "<p>second</p>");
        expect(readDraft("k1")).toBe("<p>second</p>");
    });

    it("treats Quill's empty editor as no draft", () => {
        writeDraft("k1", "<p>typed</p>");
        writeDraft("k1", "<p><br></p>");
        expect(readDraft("k1")).toBe("");
    });

    it("treats blank text as no draft", () => {
        writeDraft("k1", "<p>typed</p>");
        writeDraft("k1", "   ");
        expect(readDraft("k1")).toBe("");
    });

    it("stores nothing for an empty draft on a conversation that had none", () => {
        writeDraft("k1", "<p><br></p>");
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("clearDraft removes only the conversation it names", () => {
        writeDraft("k1", "<p>a</p>");
        writeDraft("k2", "<p>b</p>");
        clearDraft("k1");
        expect(readDraft("k1")).toBe("");
        expect(readDraft("k2")).toBe("<p>b</p>");
    });

    it("ignores a null key rather than storing an orphan draft", () => {
        writeDraft(null, "<p>a</p>");
        clearDraft(null);
        expect(readDraft(null)).toBe("");
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("survives a corrupted store instead of throwing", () => {
        localStorage.setItem(STORAGE_KEY, "not json");
        expect(readDraft("k1")).toBe("");
        writeDraft("k1", "<p>a</p>");
        expect(readDraft("k1")).toBe("<p>a</p>");
    });

    it("ignores a store holding the wrong shape", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(["nope"]));
        expect(readDraft("k1")).toBe("");
    });

    it("skips entries whose html is missing", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ k1: { at: 1 }, k2: { html: "<p>b</p>", at: 2 } }));
        expect(readDraft("k1")).toBe("");
        expect(readDraft("k2")).toBe("<p>b</p>");
    });

    it("drops the oldest drafts past the cap and keeps the newest", () => {
        for (let i = 0; i < 105; i += 1) {
            writeDraft(`k${i}`, `<p>${i}</p>`);
        }
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        expect(Object.keys(stored).length).toBe(100);
        expect(readDraft("k104")).toBe("<p>104</p>");
    });
});
