import { atom } from "jotai";

export type NotificationKind =
  | "friend_request"
  | "message"
  | "event_reminder"
  | "seminar_invite"
  | "payment_received"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  linkTo: string | null;
}

export const sidebarOpenAtom = atom<boolean>(true);
export const onlineUsersAtom = atom<Set<string>>(new Set<string>());
export const notificationsAtom = atom<AppNotification[]>([]);
