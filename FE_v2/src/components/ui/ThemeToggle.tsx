/**
 * ThemeToggle — proof-of-concept component that lets the user switch themes.
 *
 * Uses the existing Select/SelectItem primitives and the useTheme hook from
 * ThemeProvider. Switching themes updates themeAtom → ThemeProvider effect →
 * DOM data-theme attribute + persistence. No page reload required.
 */

import type { ThemeId } from "../../atoms/appAtoms";
import { THEME_IDS } from "../../atoms/appAtoms";
import { useTheme } from "../../themes/ThemeProvider";
import { Select, SelectItem } from "./select";

const THEME_LABELS: Readonly<Record<ThemeId, string>> = {
  midnight: "🌑 Midnight",
  ocean: "🌊 Ocean",
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select
      value={theme}
      onValueChange={(value) => {
        // Validate the incoming string against the known ThemeId union
        const matched = THEME_IDS.find((id) => id === value);
        if (matched !== undefined) {
          setTheme(matched);
        }
      }}
      className="w-36"
    >
      {THEME_IDS.map((id) => (
        <SelectItem key={id} value={id}>
          {THEME_LABELS[id]}
        </SelectItem>
      ))}
    </Select>
  );
}
