import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickLiveOrNextOccurrence, seriesKey } from './seminarSeriesOccurrence';

describe('seriesKey', () => {
  it('prefers seriesId over _id', () => {
    expect(seriesKey({ seriesId: 'series-1', _id: 'occ-a' })).toBe('series-1');
  });

  it('falls back to _id when seriesId is missing', () => {
    expect(seriesKey({ _id: 'occ-a' })).toBe('occ-a');
  });
});

describe('pickLiveOrNextOccurrence', () => {
  const pastA = {
    _id: 'occ-a',
    seriesId: 'series-1',
    start: '2026-09-07T14:30:00.000Z',
    end: '2026-09-07T15:30:00.000Z',
  };
  const liveB = {
    _id: 'occ-b',
    seriesId: 'series-1',
    start: '2026-09-10T14:30:00.000Z',
    end: '2026-09-10T15:30:00.000Z',
  };
  const futureC = {
    _id: 'occ-c',
    seriesId: 'series-1',
    start: '2026-09-13T14:30:00.000Z',
    end: '2026-09-13T15:30:00.000Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('past A + live B → picks B', () => {
    vi.setSystemTime(new Date('2026-09-10T14:45:00.000Z'));
    const picked = pickLiveOrNextOccurrence([pastA, liveB, futureC], 'series-1');
    expect(picked?._id).toBe('occ-b');
  });

  it('past A + future B → picks B', () => {
    vi.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
    const picked = pickLiveOrNextOccurrence(
      [pastA, { ...liveB, start: '2026-09-10T14:30:00.000Z', end: '2026-09-10T15:30:00.000Z' }],
      pastA,
      new Date('2026-09-09T12:00:00.000Z'),
    );
    expect(picked?._id).toBe('occ-b');
  });

  it('only past → picks past', () => {
    vi.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));
    const picked = pickLiveOrNextOccurrence([pastA], pastA, new Date('2026-09-20T12:00:00.000Z'));
    expect(picked?._id).toBe('occ-a');
  });

  it('accepts a seriesId string or a group chat doc', () => {
    vi.setSystemTime(new Date('2026-09-10T14:45:00.000Z'));
    expect(pickLiveOrNextOccurrence([pastA, liveB], liveB)?._id).toBe('occ-b');
    expect(pickLiveOrNextOccurrence([pastA, liveB], 'series-1')?._id).toBe('occ-b');
  });
});
