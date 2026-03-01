import { atom } from "jotai";

export interface FriendUser {
  id: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  isOnline: boolean;
}

export interface FriendInvitation {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export const friendsListAtom = atom<FriendUser[]>([]);
export const pendingInvitationsAtom = atom<FriendInvitation[]>([]);
export const sentInvitationsAtom = atom<FriendInvitation[]>([]);
