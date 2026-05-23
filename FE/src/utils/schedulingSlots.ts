import type { HalfHourSlotIndex } from '../types/scheduling';

/** Map UI hour pills (0–23) to backend half-hour indices (0–47). */
export function hoursToHalfHourIndices(hours: number[]): HalfHourSlotIndex[] {
  const indices = new Set<number>();
  for (const h of hours) {
    if (h < 0 || h > 23) continue;
    indices.add(h * 2);
    indices.add(h * 2 + 1);
  }
  return [...indices].sort((a, b) => a - b);
}

/** Derive selected hours from stored half-hour indices. */
export function halfHourIndicesToHours(indices: HalfHourSlotIndex[]): number[] {
  const hours = new Set<number>();
  for (const idx of indices) {
    if (idx >= 0 && idx <= 47) {
      hours.add(Math.floor(idx / 2));
    }
  }
  return [...hours].sort((a, b) => a - b);
}

/** Union hours from daily availability rows (weekly model stores one combined list). */
export function unionDailyAvailabilityHours(
  daily: Array<{ enabled: boolean; selectedSlots: number[] }>,
): number[] {
  const hours = new Set<number>();
  for (const row of daily) {
    if (!row.enabled) continue;
    row.selectedSlots.forEach((h) => hours.add(h));
  }
  return [...hours].sort((a, b) => a - b);
}

export function normalizeExpertPrice(price: unknown): number | undefined {
  if (typeof price === 'number' && !Number.isNaN(price)) return price;
  if (Array.isArray(price) && price.length > 0) {
    const n = Number(price[0]);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
