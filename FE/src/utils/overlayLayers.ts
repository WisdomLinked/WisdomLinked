// Stacking order for full-screen overlays. They all portal to document.body, so
// nothing but these numbers decides what covers what — and a layer written as a
// bare number next to a comment about its neighbours goes stale the moment one
// of those neighbours moves. Import from here instead.

/** Chat drawers and in-panel overlays inside the messenger. */
export const OVERLAY_Z_PANEL = 1000;

/**
 * The chat header menu (the three dots). It has to sit above the page chrome,
 * and under any dialog it opens — otherwise the participant list renders
 * behind the menu and the next click dismisses it.
 */
export const OVERLAY_Z_MENU = 1200;

/** Dialogs opened from a panel (participants, confirmations). */
export const OVERLAY_Z_DIALOG = 1300;

/** The shared person card (ProfileModal / CommunityProfileModal). */
export const OVERLAY_Z_PROFILE_CARD = 1500;

/**
 * Document and resume previews. Opened *from* the profile card, so it has to sit
 * above it — otherwise the resume renders behind the card that launched it.
 */
export const OVERLAY_Z_DOCUMENT_PREVIEW = 2000;
