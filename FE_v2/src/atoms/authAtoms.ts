import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { UserRole } from "@/api/authApi";

export type { UserRole };

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface Session {
  id: string;
  ipAddress: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
  };
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export type TokenType = string | null;
export type UserType = User | null;
export type SessionsType = Session[];

const defaultTokenValue: TokenType = null;
const defaultUserValue: UserType = null;
const defaultSessionsValue: SessionsType = [];

const tokenStorage = {
  getItem: (key: string, initialValue: TokenType): TokenType => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) {
      return initialValue;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (typeof parsed === "string" || parsed === null) {
        return parsed;
      }
      return initialValue;
    } catch {
      // Backward compatibility for legacy plain-string tokens.
      return rawValue;
    }
  },
  setItem: (key: string, value: TokenType) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(key);
  },
};

// Token stored in localStorage with automatic sync
export const tokenAtom = atomWithStorage<TokenType>('token', defaultTokenValue, tokenStorage, {
  getOnInit: true,
});

// User state (not stored in localStorage)
export const userAtom = atom<UserType>(defaultUserValue);

// Sessions stored in localStorage with automatic sync
export const sessionsAtom = atomWithStorage<SessionsType>('sessions', defaultSessionsValue, undefined, {
  getOnInit: true,
});

// Loading state
export const isLoadingAuthAtom = atom(false);

// Derived atoms
export const isAuthenticatedAtom = atom((get) => get(userAtom) !== null);
export const isAdminAtom = atom((get) => {
  const user = get(userAtom);
  return user?.role === "admin";
});
export const isCustomerAtom = atom((get) => {
  const user = get(userAtom);
  return user?.role === "customer";
});
export const isExpertAtom = atom((get) => {
  const user = get(userAtom);
  return user?.role === "expert";
});
