import type { ClientRow } from './clientModel';

export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A] focus-visible:ring-offset-2';

export const PRIMARY_BUTTON = `inline-flex items-center justify-center gap-2 rounded-full bg-[#234C6A] px-4 text-sm font-semibold text-white transition hover:bg-[#1b3c53] disabled:opacity-50 ${FOCUS_RING}`;

export const ICON_BUTTON = `relative inline-flex shrink-0 items-center justify-center rounded-xl border border-[#E5E2DB] bg-white text-[#234C6A] transition hover:bg-[#E8EEF4] ${FOCUS_RING}`;

export interface ClientActions {
  onOpenProfile: (row: ClientRow) => void;
  onMessage: (row: ClientRow) => void;
  onPropose: (row: ClientRow) => void;
}
