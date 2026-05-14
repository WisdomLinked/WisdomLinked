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
    }
  | {
      type: "chat-line";
      meetingThreadId: string;
      author: string;
      guest: boolean;
      msg: string;
    };

const stripHtml = (value: string): string =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

function decodeBase64UrlToUtf8(b64: string): string | null {
  try {
    let s = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

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
  if (text.startsWith("__MEETING_CHAT__::")) {
    const rest = text.slice("__MEETING_CHAT__::".length);
    const sep = rest.indexOf("::");
    if (sep < 0) return null;
    const meetingThreadId = rest.slice(0, sep).trim();
    const b64 = rest.slice(sep + 2).trim();
    if (!meetingThreadId || !b64) return null;
    const json = decodeBase64UrlToUtf8(b64);
    if (!json) return null;
    let payload: { v?: number; author?: string; guest?: boolean; msg?: string };
    try {
      payload = JSON.parse(json) as typeof payload;
    } catch {
      return null;
    }
    if (payload.v !== 1 || typeof payload.author !== "string" || typeof payload.msg !== "string") return null;
    return {
      type: "chat-line",
      meetingThreadId,
      author: payload.author,
      guest: Boolean(payload.guest),
      msg: payload.msg,
    };
  }
  return null;
};
