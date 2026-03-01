import { atom } from "jotai";
import { persistenceRead } from "./persistence";

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

// ---------------------------------------------------------------------------
// Theme atoms
// ---------------------------------------------------------------------------

export type ThemeId = "midnight" | "ocean";

export const THEME_IDS: readonly ThemeId[] = ["midnight", "ocean"] as const;

/** Persistence key following the app:<area>:<name>:v<version> convention */
export const THEME_PERSISTENCE_KEY = "app:prefs:theme:v1" as const;

/** Schema version for the persisted theme value */
export const THEME_SCHEMA_VERSION = 1 as const;

function isThemeId(raw: unknown): raw is ThemeId {
  return raw === "midnight" || raw === "ocean";
}

/**
 * Read the initial theme from persistence synchronously at module load time.
 * This eliminates FOUC: the atom is already set to the correct theme before
 * any React component renders.
 *
 * Called once during module initialization (safe for browser-only SPA).
 */
function readInitialTheme(): ThemeId {
  const result = persistenceRead<ThemeId>({
    key: THEME_PERSISTENCE_KEY,
    currentVersion: THEME_SCHEMA_VERSION,
    validate: isThemeId,
    migrations: {},
    defaultValue: "midnight",
  });
  return result.value;
}

export const themeAtom = atom<ThemeId>(readInitialTheme());
