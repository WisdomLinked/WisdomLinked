import { atom } from "jotai";

export interface GroupChatMember {
  userId: string;
  username: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface GroupChat {
  id: string;
  name: string;
  description: string | null;
  members: GroupChatMember[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export const groupChatsAtom = atom<GroupChat[]>([]);
export const activeGroupChatIdAtom = atom<string | null>(null);
