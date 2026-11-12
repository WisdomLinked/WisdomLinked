import { describe, expect, it } from 'vitest';
import type { AdminDemographicsData } from '../../../api/api';
import {
  filterLocations,
  safePct,
  studentsWithServices,
  withLocationTotals,
} from './demographicsMath';

const sample: AdminDemographicsData = {
  totals: { experts: 3, students: 4 },
  locations: [
    { country: 'United States', experts: 1, students: 1 },
    { country: 'Canada', experts: 1, students: 0 },
    { country: 'India', experts: 0, students: 1 },
  ],
  locationMissing: { experts: 1, students: 2 },
  services: [
    { key: 'study_abroad', label: 'Study Abroad', students: 2 },
    { key: 'work_abroad', label: 'Work Abroad', students: 1 },
    { key: 'research_guidance', label: 'Research Guidance', students: 0 },
  ],
  servicesMissing: 1,
};

describe('demographicsMath', () => {
  it('avoids divide-by-zero', () => {
    expect(safePct(1, 0)).toBe(0);
    expect(safePct(0, 0)).toBe(0);
  });

  it('filters locations by audience', () => {
    // Tied student counts sort alphabetically (India before United States).
    expect(filterLocations(sample.locations, 'students').map(r => r.country)).toEqual([
      'India',
      'United States',
    ]);
    expect(filterLocations(sample.locations, 'experts').map(r => r.country)).toEqual([
      'Canada',
      'United States',
    ]);
  });

  it('computes outside-US and fill rates from users with a location', () => {
    const all = withLocationTotals(sample, 'all');
    expect(all.known).toBe(4);
    expect(all.countries).toBe(3);
    expect(all.outsideUs).toBe(2);
    expect(all.outsideUsPct).toBe(50);
    expect(all.top?.country).toBe('United States');
    expect(studentsWithServices(sample)).toBe(3);
  });
});
