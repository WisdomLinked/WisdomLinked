export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-wl-brand/40 focus-visible:ring-offset-2';

export const FOCUS_RING_ON_DARK =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wl-brand';

export const EYEBROW = 'section-label text-res-blue';

export const MOTION = 'duration-200 motion-reduce:transition-none';

export const BUTTON_PRIMARY = `btn-primary inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white ${FOCUS_RING}`;

export const BUTTON_OUTLINE = `inline-flex h-11 items-center justify-center rounded-full border border-[#BCCCDC] bg-white px-6 text-sm font-semibold text-slate-900 transition-colors ${MOTION} hover:border-[#9AA6B2] hover:text-wl-brand ${FOCUS_RING}`;

export const BUTTON_ON_DARK = `inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-wl-brand transition-colors ${MOTION} hover:bg-res-soft ${FOCUS_RING_ON_DARK}`;
