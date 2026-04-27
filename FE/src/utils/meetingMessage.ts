export type ParsedMeetingMessage =
  | {
      type: "started";
      meetingThreadId: string;
      jitsiRoomName: string;
      starterName: string;
    }
  | {
      type: "ended";
      meetingThreadId: string;
      duration: number;
      participantCount: number;
    };

const stripHtml = (value: string): string =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

export const parseMeetingMessageContent = (content: string): ParsedMeetingMessage | null => {
  const text = stripHtml(content);
  if (text.startsWith("__MEETING_STARTED__::")) {
    const parts = text.split("::");
    return {
      type: "started",
      meetingThreadId: String(parts[1] || ""),
      jitsiRoomName: String(parts[2] || ""),
      starterName: String(parts[3] || "Unknown"),
    };
  }
  if (text.startsWith("__MEETING_ENDED__::")) {
    const parts = text.split("::");
    return {
      type: "ended",
      meetingThreadId: String(parts[1] || ""),
      duration: Number.parseInt(String(parts[2] || "0"), 10) || 0,
      participantCount: Number.parseInt(String(parts[3] || "0"), 10) || 0,
    };
  }
  return null;
};

