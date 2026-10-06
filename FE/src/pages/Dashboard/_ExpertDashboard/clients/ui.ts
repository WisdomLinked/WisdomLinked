import type { ClientRow } from './clientModel';

export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A] focus-visible:ring-offset-2';

export const PRIMARY_BUTTON = `inline-flex items-center justify-center gap-2 rounded-full bg-[#234C6A] px-4 text-sm font-semibold text-white transition hover:bg-[#1b3c53] disabled:opacity-50 ${FOCUS_RING}`;

export const OUTLINE_BUTTON = `inline-flex items-center justify-center gap-2 rounded-full border border-[#234C6A] bg-white px-4 text-sm font-semibold text-[#234C6A] transition hover:bg-[#E8EEF4] ${FOCUS_RING}`;

export const ICON_BUTTON = `relative inline-flex shrink-0 items-center justify-center rounded-xl border border-[#E5E2DB] bg-white text-[#234C6A] transition hover:bg-[#E8EEF4] ${FOCUS_RING}`;

/** Uppercase label above a filter control. */
export const FIELD_LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B6B63]';

/** Uppercase micro-label inside a card. */
export const MICRO_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B6B63]';

/** Extends a small control's hit area to 44px tall without changing its look. */
export const TOUCH_TARGET = "relative after:absolute after:-inset-x-0.5 after:-inset-y-1.5 after:content-['']";

export interface ClientActions {
  onOpenProfile: (row: ClientRow) => void;
  onMessage: (row: ClientRow) => void;
  onPropose: (row: ClientRow) => void;
}
