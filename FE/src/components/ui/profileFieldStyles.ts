/** Shared Expert Profile input chrome — border, radius, focus ring. */
export const PROFILE_INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#234C6A] focus:bg-white focus:ring-2 focus:ring-[#234C6A]/10';

/** Select trigger chrome shared by MajorSelect and MultiSelect (pair with an `*_STATE` class). */
export const SELECT_TRIGGER_CLASS =
  'w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left outline-none';
export const SELECT_TRIGGER_STATE = 'border-slate-200 bg-white';
export const SELECT_TRIGGER_ERROR_STATE = 'border-rose-300 bg-rose-50/30';
export const SELECT_FOCUS_RING = 'focus:ring-2 focus:ring-[#234C6A]/60 focus:border-[#234C6A]';
export const SELECT_FOCUS_WITHIN_RING =
  'focus-within:ring-2 focus-within:ring-[#234C6A]/60 focus-within:border-[#234C6A]';

export const SELECT_MENU_CLASS =
  'absolute z-50 mt-1 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col';
export const SELECT_MENU_LIST_CLASS = 'scrollbar-thin max-h-72 overflow-y-auto py-1 pr-1';
export const SELECT_OPTION_CLASS =
  'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors';
export const SELECT_OPTION_SELECTED = 'bg-[#D9EAFD]/70 text-[#234C6A] font-semibold';
export const SELECT_OPTION_IDLE = 'text-slate-700 hover:bg-[#D9EAFD]/60';
export const SELECT_OPTION_ACTIVE = 'bg-[#D9EAFD]/60';
