import { wlDisplayName } from "./displayName";

export type MeetingChatLineInfo = {
  author: string;
  guest: boolean;
  senderId?: string;
};

export type MeetingChatSelfUser = {
  _id?: string;
  id?: string;
  userId?: string;
  username?: string;
  email?: string;
};

function normalizeLabel(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function myWlUserIds(user: MeetingChatSelfUser | null | undefined): string[] {
  if (!user) return [];
  return [user._id, user.id, user.userId]
    .filter((x) => x != null && x !== "")
    .map((x) => String(x));
}

/**
 * Whether an in-meeting chat line was sent by the logged-in WL user.
 * RC envelope author is unreliable for meet lines; payload author/sub are preferred.
 */
export function isMeetingChatSelf(
  message: { author?: { _id?: string; id?: string } } | null | undefined,
  chatLine: MeetingChatLineInfo,
  userDetails: MeetingChatSelfUser | null | undefined,
  isOutgoingMessage: (message: unknown) => boolean,
): boolean {
  if (!userDetails) return false;

  if (message && isOutgoingMessage(message)) return true;

  if (chatLine.guest) return false;

  const senderId = String(chatLine.senderId || "").trim();
  if (senderId) {
    const mine = myWlUserIds(userDetails);
    if (mine.includes(senderId)) return true;
  }

  const payloadAuthor = normalizeLabel(chatLine.author);
  const myLabel = normalizeLabel(wlDisplayName(userDetails));
  if (payloadAuthor && myLabel && payloadAuthor === myLabel) return true;

  const rawUsername = normalizeLabel(String(userDetails.username || ""));
  if (payloadAuthor && rawUsername && payloadAuthor === rawUsername) return true;

  return false;
}
