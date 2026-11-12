import type { AdminDemographicsData, AdminDemographicsLocation } from '../../../api/api';

export type AudienceFilter = 'all' | 'experts' | 'students';

export function safePct(part: number, whole: number): number {
  if (!whole || whole <= 0 || !Number.isFinite(part)) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function locationCount(row: AdminDemographicsLocation, audience: AudienceFilter): number {
  if (audience === 'experts') return row.experts;
  if (audience === 'students') return row.students;
  return row.experts + row.students;
}

export function filterLocations(
  locations: AdminDemographicsLocation[],
  audience: AudienceFilter,
): AdminDemographicsLocation[] {
  return locations
    .filter(row => locationCount(row, audience) > 0)
    .sort((a, b) => locationCount(b, audience) - locationCount(a, audience) || a.country.localeCompare(b.country));
}

export function withLocationTotals(data: AdminDemographicsData, audience: AudienceFilter) {
  const rows = filterLocations(data.locations, audience);
  const known = rows.reduce((sum, row) => sum + locationCount(row, audience), 0);
  const missing =
    audience === 'experts'
      ? data.locationMissing.experts
      : audience === 'students'
        ? data.locationMissing.students
        : data.locationMissing.experts + data.locationMissing.students;
  const total =
    audience === 'experts'
      ? data.totals.experts
      : audience === 'students'
        ? data.totals.students
        : data.totals.experts + data.totals.students;
  const outsideUs = rows
    .filter(row => row.country !== 'United States')
    .reduce((sum, row) => sum + locationCount(row, audience), 0);
  const top = rows[0] || null;
  return {
    rows,
    known,
    missing,
    total,
    countries: rows.length,
    outsideUs,
    outsideUsPct: safePct(outsideUs, known),
    top,
    filledPct: safePct(known, total),
  };
}

export function studentsWithServices(data: AdminDemographicsData): number {
  return Math.max(0, data.totals.students - data.servicesMissing);
}
