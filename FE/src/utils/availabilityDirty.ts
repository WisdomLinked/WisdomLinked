import { normalizeExpertPrice, weeklyTimeSlotsEqual } from './schedulingSlots';
import { slotsIndicesEqual } from './availabilitySaveMessages';
import { appointmentDurationsEqual } from './appointmentDurations';

export interface AvailabilityDraft {
  hourlyRate: string;
  mode: 'common' | 'daily';
  timeSlots: number[];
  weeklyTimeSlots: Record<string, number[]>;
  appointmentDurations: number[];
}

export interface AvailabilitySavedState {
  price?: unknown;
  timeSlots?: unknown;
  weeklyTimeSlots?: Record<string, number[]> | null;
  availabilityMode?: unknown;
  appointmentDurations?: unknown;
}

export interface AvailabilityChanges {
  rateChanged: boolean;
  slotsChanged: boolean;
  modeChanged: boolean;
  weeklyChanged: boolean;
  durationsChanged: boolean;
  availabilityChanged: boolean;
  anyChanged: boolean;
}

function draftRate(hourlyRate: string): number | undefined {
  const trimmed = hourlyRate.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function computeAvailabilityChanges(
  draft: AvailabilityDraft,
  saved: AvailabilitySavedState | null | undefined,
): AvailabilityChanges {
  const savedPrice = normalizeExpertPrice(saved?.price);
  const savedSlots = Array.isArray(saved?.timeSlots) ? (saved?.timeSlots as number[]) : [];
  const savedMode = saved?.availabilityMode === 'daily' ? 'daily' : 'common';

  const rateChanged = draftRate(draft.hourlyRate) !== savedPrice;
  const slotsChanged = !slotsIndicesEqual(draft.timeSlots, savedSlots);
  const modeChanged = draft.mode !== savedMode;
  const durationsChanged = !appointmentDurationsEqual(
    draft.appointmentDurations,
    saved?.appointmentDurations,
  );
  const weeklyChanged =
    draft.mode === 'daily' &&
    !weeklyTimeSlotsEqual(draft.weeklyTimeSlots, saved?.weeklyTimeSlots);

  const availabilityChanged = slotsChanged || modeChanged || weeklyChanged;

  return {
    rateChanged,
    slotsChanged,
    modeChanged,
    weeklyChanged,
    durationsChanged,
    availabilityChanged,
    anyChanged: rateChanged || availabilityChanged || durationsChanged,
  };
}
