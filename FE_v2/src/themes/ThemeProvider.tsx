/**
 * ThemeProvider — Jotai-based theme synchronization.
 *
 * Architecture:
 *   - themeAtom is initialized with the persisted theme at module load time
 *     (see appAtoms.ts), so there is no hydration flash.
 *   - ThemeProvider's single effect syncs the current theme to:
 *       1. document.documentElement's data-theme attribute (CSS selector target)
 *       2. the persistence boundary (localStorage via atoms/persistence.ts)
 *   - useTheme() is the public hook for reading and updating the active theme.
 *
 * Calling `setTheme(id)` from useTheme → updates themeAtom → triggers the
 * effect in ThemeProvider → DOM + persistence update. No duplicate persistence.
 */

import { useAtomValue, useSetAtom } from "jotai";
import React, { useEffect } from "react";

import {
  THEME_IDS,
  THEME_PERSISTENCE_KEY,
  THEME_SCHEMA_VERSION,
  themeAtom,
} from "../atoms/appAtoms";
import type { ThemeId } from "../atoms/appAtoms";
import { persistenceWrite } from "../atoms/persistence";

// ---------------------------------------------------------------------------
// ThemeProvider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    // 1. Apply to DOM so CSS [data-theme] selectors fire
    document.documentElement.setAttribute("data-theme", theme);

    // 2. Persist so the choice survives page reload
    //    Failures are structured inside persistenceWrite and do not crash the app.
    persistenceWrite(
      { key: THEME_PERSISTENCE_KEY, currentVersion: THEME_SCHEMA_VERSION },
      theme,
    );
  }, [theme]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// useTheme hook
// ---------------------------------------------------------------------------

export interface UseThemeResult {
  /** Currently active theme ID */
  readonly theme: ThemeId;
  /** Update the active theme (triggers DOM + persistence sync via ThemeProvider) */
  readonly setTheme: (newTheme: ThemeId) => void;
  /** All available theme IDs */
  readonly themes: readonly ThemeId[];
}

export function useTheme(): UseThemeResult {
  const theme = useAtomValue(themeAtom);
  const setTheme = useSetAtom(themeAtom);

  return { theme, setTheme, themes: THEME_IDS };
}
