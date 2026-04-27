import { describe, expect, it } from "vitest";
import { parseMeetingMessageContent } from "./meetingMessage";

describe("parseMeetingMessageContent", () => {
  it("parses meeting started payload", () => {
    const raw = "__MEETING_STARTED__::thread-1::wl-room-1::Alice";
    expect(parseMeetingMessageContent(raw)).toEqual({
      type: "started",
      meetingThreadId: "thread-1",
      jitsiRoomName: "wl-room-1",
      starterName: "Alice",
    });
  });

  it("parses HTML-wrapped meeting started payload", () => {
    const raw = "<p>__MEETING_STARTED__::thread-2::wl-room-2::Bob</p>";
    expect(parseMeetingMessageContent(raw)).toEqual({
      type: "started",
      meetingThreadId: "thread-2",
      jitsiRoomName: "wl-room-2",
      starterName: "Bob",
    });
  });

  it("parses meeting ended payload", () => {
    const raw = "__MEETING_ENDED__::thread-3::930::4";
    expect(parseMeetingMessageContent(raw)).toEqual({
      type: "ended",
      meetingThreadId: "thread-3",
      duration: 930,
      participantCount: 4,
    });
  });

  it("returns null for non-meeting message", () => {
    expect(parseMeetingMessageContent("hello world")).toBeNull();
  });
});

