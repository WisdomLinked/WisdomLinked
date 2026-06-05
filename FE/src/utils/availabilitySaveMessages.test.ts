import { describe, expect, it } from 'vitest';
import {
  buildAvailabilitySaveSuccessMessage,
  buildBookingNoticeSaveSuccessMessage,
  mapAvailabilitySaveError,
  slotsIndicesEqual,
} from './availabilitySaveMessages';

describe('availabilitySaveMessages', () => {
  describe('slotsIndicesEqual', () => {
    it('returns true for same indices in different order', () => {
      expect(slotsIndicesEqual([20, 18, 19], [18, 19, 20])).toBe(true);
    });

    it('returns false when lengths differ', () => {
      expect(slotsIndicesEqual([18, 19], [18, 19, 20])).toBe(false);
    });
  });

  describe('buildAvailabilitySaveSuccessMessage', () => {
    it('describes rate-only save', () => {
      expect(
        buildAvailabilitySaveSuccessMessage({
          rateChanged: true,
          slotsChanged: false,
          hourlyRate: 75,
        }),
      ).toBe('Hourly rate saved ($75/hr).');
    });

    it('describes slots-only save', () => {
      expect(
        buildAvailabilitySaveSuccessMessage({
          rateChanged: false,
          slotsChanged: true,
        }),
      ).toBe(
        'Weekly availability saved. Students will see your updated time slots when booking.',
      );
    });

    it('describes both rate and slots', () => {
      expect(
        buildAvailabilitySaveSuccessMessage({
          rateChanged: true,
          slotsChanged: true,
          hourlyRate: 150,
        }),
      ).toBe(
        'Hourly rate and weekly availability saved ($150/hr). Students will see your updates when booking.',
      );
    });

    it('falls back when nothing flagged', () => {
      expect(
        buildAvailabilitySaveSuccessMessage({
          rateChanged: false,
          slotsChanged: false,
        }),
      ).toBe('Availability settings saved.');
    });
  });

  describe('buildBookingNoticeSaveSuccessMessage', () => {
    it('includes selected hours', () => {
      expect(buildBookingNoticeSaveSuccessMessage(48)).toMatch(/48 hours/);
    });
  });

  describe('mapAvailabilitySaveError', () => {
    it('maps slot errors', () => {
      expect(mapAvailabilitySaveError('Could not save time slots.')).toMatch(
        /weekly availability/i,
      );
    });

    it('maps rate errors', () => {
      expect(mapAvailabilitySaveError('Could not save rate or timezone.')).toMatch(
        /hourly rate/i,
      );
    });
  });
});
