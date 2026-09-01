import { describe, it, expect } from 'vitest';
import {
  OVERLAY_Z_DIALOG,
  OVERLAY_Z_DOCUMENT_PREVIEW,
  OVERLAY_Z_PANEL,
  OVERLAY_Z_PROFILE_CARD,
} from './overlayLayers';

describe('overlay stacking order', () => {
  it('puts a document preview above the profile card that opens it', () => {
    // Regression: the preview sat at 500 while the card moved to 1500, so a
    // resume opened from a user card rendered behind the card.
    expect(OVERLAY_Z_DOCUMENT_PREVIEW).toBeGreaterThan(OVERLAY_Z_PROFILE_CARD);
  });

  it('keeps the whole ladder in order', () => {
    expect(OVERLAY_Z_PANEL).toBeLessThan(OVERLAY_Z_DIALOG);
    expect(OVERLAY_Z_DIALOG).toBeLessThan(OVERLAY_Z_PROFILE_CARD);
    expect(OVERLAY_Z_PROFILE_CARD).toBeLessThan(OVERLAY_Z_DOCUMENT_PREVIEW);
  });
});
