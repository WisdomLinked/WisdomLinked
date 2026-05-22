import { describe, expect, it, vi } from "vitest";
import { isMeetingChatSelf, isTranscriptLineSelf } from "./meetingChatSelf";

describe("isMeetingChatSelf", () => {
  const student = {
    _id: "student-id",
    username: "Student User",
    email: "student@tamu.edu",
  };

  it("defers to isOutgoingMessage when true", () => {
    const isOutgoing = vi.fn(() => true);
    expect(
      isMeetingChatSelf(
        { author: { _id: "rc-unknown" } },
        { author: "Expert", guest: false },
        student,
        isOutgoing,
      ),
    ).toBe(true);
    expect(isOutgoing).toHaveBeenCalled();
  });

  it("matches payload senderId to logged-in user", () => {
    expect(
      isMeetingChatSelf(
        { author: { _id: "rc-1" } },
        { author: "Student User", guest: false, senderId: "student-id" },
        student,
        () => false,
      ),
    ).toBe(true);
  });

  it("matches payload author display name when RC author is wrong", () => {
    expect(
      isMeetingChatSelf(
        { author: { _id: "rc-999", username: "wrong" } },
        { author: "Student User", guest: false },
        student,
        () => false,
      ),
    ).toBe(true);
  });

  it("does not treat guest lines as self for WL users", () => {
    expect(
      isMeetingChatSelf(
        { author: { _id: "student-id" } },
        { author: "Student User", guest: true, senderId: "student-id" },
        student,
        () => false,
      ),
    ).toBe(false);
  });

  it("returns false for another participant's line", () => {
    expect(
      isMeetingChatSelf(
        { author: { _id: "rc-x" } },
        { author: "Expert Name", guest: false, senderId: "expert-id" },
        student,
        () => false,
      ),
    ).toBe(false);
  });
});

describe("isTranscriptLineSelf", () => {
  const student = {
    _id: "student-id",
    username: "Student User",
    email: "student@tamu.edu",
  };

  it("matches transcript author Mongo id", () => {
    expect(
      isTranscriptLineSelf(
        { authorName: "Student User", author: { _id: "student-id" }, content: "hi" },
        student,
      ),
    ).toBe(true);
  });

  it("matches authorName when author id missing", () => {
    expect(
      isTranscriptLineSelf(
        { authorName: "Student User", content: "hi" },
        student,
      ),
    ).toBe(true);
  });

  it("returns false for other participant", () => {
    expect(
      isTranscriptLineSelf(
        { authorName: "Expert Name", author: { _id: "expert-id" }, content: "hi" },
        student,
      ),
    ).toBe(false);
  });
});
