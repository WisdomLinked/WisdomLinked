import { atom } from "jotai";

export interface ConversationParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  sentAt: string;
  readAt: string | null;
}

export const conversationsAtom = atom<Conversation[]>([]);
export const activeConversationIdAtom = atom<string | null>(null);
export const messagesAtom = atom<Map<string, Message[]>>(new Map());
export const typingUsersAtom = atom<Map<string, string[]>>(new Map());
export const unreadCountAtom = atom<Map<string, number>>(new Map());
