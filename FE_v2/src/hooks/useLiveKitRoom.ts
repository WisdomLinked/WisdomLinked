/**
 * useLiveKitRoom — fetches a LiveKit room token from the backend.
 *
 * Uses native fetch (not apiClient) so that a 404/error on the token endpoint
 * does NOT trigger the global apiClient error-toast interceptor.
 * The caller sees `{ token: null, error: "..." }` and renders a placeholder.
 *
 * When the /api/v1/video/token endpoint is wired up on the backend, the hook
 * will automatically start returning real tokens.
 */

import { useEffect, useState } from "react";

import { useAtomValue } from "jotai";

import { tokenAtom } from "@/atoms/authAtoms";
import { getFrontendEnvironmentConfig } from "@/config/env";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LiveKitRoomState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

// ── Pure helper: extract token string from an unknown response body ───────────

function extractToken(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  return typeof obj["token"] === "string" ? obj["token"] : null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveKitRoom(roomName: string): LiveKitRoomState {
  const authToken = useAtomValue(tokenAtom);

  const [state, setState] = useState<LiveKitRoomState>({
    token: null,
    loading: roomName !== "",
    error: null,
  });

  useEffect(() => {
    if (roomName === "") {
      setState({ token: null, loading: false, error: "No room name provided" });
      return;
    }

    let cancelled = false;
    const { apiBaseUrl } = getFrontendEnvironmentConfig();

    const fetchToken = async () => {
      setState({ token: null, loading: true, error: null });

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (authToken !== null) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/video/token`, {
          method: "POST",
          headers,
          body: JSON.stringify({ roomName }),
        });

        if (!response.ok) {
          if (!cancelled) {
            setState({
              token: null,
              loading: false,
              error: "Video token endpoint is not yet configured",
            });
          }
          return;
        }

        const raw: unknown = await response.json();
        const tokenValue = extractToken(raw);

        if (!cancelled) {
          setState({
            token: tokenValue,
            loading: false,
            error:
              tokenValue === null ? "Invalid token response from server" : null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            token: null,
            loading: false,
            error: "Unable to reach video service",
          });
        }
      }
    };

    fetchToken();

    return () => {
      cancelled = true;
    };
  }, [roomName, authToken]);

  return state;
}
