import { describe, expect, it } from 'vitest';
import {
  collapseSeminarSeries,
  formatSeriesRange,
  seminarSeriesIndex,
  sessionCountLabel,
} from './seminarSeries';
import { seriesKey } from './seminarSeriesOccurrence';

const NOW = new Date('2026-10-05T12:00:00.000Z');

const occ = (over: Record<string, any> = {}) => ({
  _id: 'occ',
  seriesId: 'series-1',
  start: '2026-10-08T18:00:00.000Z',
  end: '2026-10-08T19:00:00.000Z',
  isRecurring: true,
  recurrenceUnit: 'week',
  recurrenceInterval: 1,
  ...over,
});

describe('collapseSeminarSeries', () => {
  it('returns nothing for an empty or missing list', () => {
    expect(collapseSeminarSeries([], NOW)).toEqual([]);
    expect(collapseSeminarSeries(null, NOW)).toEqual([]);
    expect(collapseSeminarSeries(undefined, NOW)).toEqual([]);
  });

  it('collapses every occurrence of one series into a single row', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'a', start: '2026-10-01T18:00:00.000Z', end: '2026-10-01T19:00:00.000Z' }),
        occ({ _id: 'b', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
        occ({ _id: 'c', start: '2026-10-15T18:00:00.000Z', end: '2026-10-15T19:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].series?.occurrenceCount).toBe(3);
  });

  it('represents the series with the next upcoming occurrence, not the first', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'past', start: '2026-10-01T18:00:00.000Z', end: '2026-10-01T19:00:00.000Z' }),
        occ({ _id: 'next', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rows[0].doc._id).toBe('next');
  });

  it('prefers a live occurrence over the next one', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'next', start: '2026-10-12T18:00:00.000Z', end: '2026-10-12T19:00:00.000Z' }),
        // Straddles NOW.
        occ({
          _id: 'live',
          start: new Date(Date.now() - 60_000).toISOString(),
          end: new Date(Date.now() + 60_000).toISOString(),
        }),
      ],
      NOW,
    );
    expect(rows[0].doc._id).toBe('live');
  });

  it('keeps separate series as separate rows, in first-seen order', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'b1', seriesId: 'series-b' }),
        occ({ _id: 'a1', seriesId: 'series-a' }),
        occ({ _id: 'b2', seriesId: 'series-b', start: '2026-10-15T18:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].series?.occurrenceCount).toBe(2);
    expect(rows[1].doc._id).toBe('a1');
  });

  it('passes a non-recurring seminar through with no series info', () => {
    const rows = collapseSeminarSeries(
      [{ _id: 'solo', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].doc._id).toBe('solo');
    expect(rows[0].series).toBeUndefined();
  });

  it('leaves two unrelated non-series seminars as two rows', () => {
    const rows = collapseSeminarSeries(
      [
        { _id: 'one', start: '2026-10-08T18:00:00.000Z' },
        { _id: 'two', start: '2026-10-09T18:00:00.000Z' },
      ],
      NOW,
    );
    expect(rows).toHaveLength(2);
  });

  it('does not collapse documents that have no id at all', () => {
    const rows = collapseSeminarSeries(
      [
        { start: '2026-10-08T18:00:00.000Z' },
        { start: '2026-10-09T18:00:00.000Z' },
      ],
      NOW,
    );
    expect(rows).toHaveLength(2);
  });

  it('treats a series the viewer holds only one occurrence of as a plain row', () => {
    const rows = collapseSeminarSeries([occ({ _id: 'only' })], NOW);
    expect(rows[0].series).toBeUndefined();
  });

  it('spans the series from its earliest start to its latest end', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'mid', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
        occ({ _id: 'last', start: '2026-10-15T18:00:00.000Z', end: '2026-10-15T19:30:00.000Z' }),
        occ({ _id: 'first', start: '2026-10-01T18:00:00.000Z', end: '2026-10-01T19:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rows[0].series?.firstStartMs).toBe(Date.parse('2026-10-01T18:00:00.000Z'));
    expect(rows[0].series?.lastEndMs).toBe(Date.parse('2026-10-15T19:30:00.000Z'));
  });

  it('falls back to an occurrence start when it carries no end', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'a', start: '2026-10-01T18:00:00.000Z', end: undefined }),
        occ({ _id: 'b', start: '2026-10-20T18:00:00.000Z', end: undefined }),
      ],
      NOW,
    );
    expect(rows[0].series?.lastEndMs).toBe(Date.parse('2026-10-20T18:00:00.000Z'));
  });

  it('survives unusable dates rather than reporting NaN', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'a', start: 'not-a-date', end: 'nope' }),
        occ({ _id: 'b', start: '', end: null }),
      ],
      NOW,
    );
    expect(rows[0].series?.firstStartMs).toBeNull();
    expect(rows[0].series?.lastEndMs).toBeNull();
  });

  it('describes the cadence using the shared recurrence vocabulary', () => {
    const weekly = collapseSeminarSeries([occ({ _id: 'a' }), occ({ _id: 'b', start: '2026-10-15T18:00:00.000Z' })], NOW);
    expect(weekly[0].series?.cadence).toBe('Repeats weekly');

    const daily = collapseSeminarSeries(
      [
        occ({ _id: 'a', recurrenceUnit: 'day', recurrenceInterval: 3 }),
        occ({ _id: 'b', recurrenceUnit: 'day', recurrenceInterval: 3, start: '2026-10-11T18:00:00.000Z' }),
      ],
      NOW,
    );
    expect(daily[0].series?.cadence).toBe('Repeats every 3 days');
  });

  it('reads a legacy seminar that carries only recurrenceFrequency', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'a', recurrenceUnit: undefined, recurrenceInterval: undefined, recurrenceFrequency: 'biweekly' }),
        occ({ _id: 'b', recurrenceUnit: undefined, recurrenceInterval: undefined, recurrenceFrequency: 'biweekly', start: '2026-10-22T18:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rows[0].series?.cadence).toBe('Repeats biweekly');
  });

  it('omits the cadence when the stored rule is unreadable', () => {
    const rows = collapseSeminarSeries(
      [
        occ({ _id: 'a', isRecurring: false, recurrenceUnit: undefined, recurrenceInterval: undefined }),
        occ({ _id: 'b', isRecurring: false, recurrenceUnit: undefined, recurrenceInterval: undefined, start: '2026-10-15T18:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rows[0].series?.occurrenceCount).toBe(2);
    expect(rows[0].series?.cadence).toBeUndefined();
  });
});

describe('formatSeriesRange', () => {
  it('joins the two ends of the span', () => {
    const text = formatSeriesRange(
      Date.parse('2026-10-01T18:00:00.000Z'),
      Date.parse('2026-12-26T19:00:00.000Z'),
      NOW,
    );
    expect(text).toMatch(/Oct 1/);
    expect(text).toMatch(/Dec 26/);
    expect(text).toContain('–');
  });

  it('shows years once the span leaves the current one', () => {
    expect(
      formatSeriesRange(
        Date.parse('2026-12-20T18:00:00.000Z'),
        Date.parse('2027-02-10T19:00:00.000Z'),
        NOW,
      ),
    ).toMatch(/2027/);
  });

  it('omits the year while the span stays inside it', () => {
    expect(
      formatSeriesRange(
        Date.parse('2026-10-01T18:00:00.000Z'),
        Date.parse('2026-12-26T19:00:00.000Z'),
        NOW,
      ),
    ).not.toMatch(/2026/);
  });

  it('reads a single-day span as that day, not a range to itself', () => {
    const sameDay = Date.parse('2026-10-08T18:00:00.000Z');
    expect(formatSeriesRange(sameDay, sameDay, NOW)).not.toContain('–');
  });

  it('works from whichever end is known', () => {
    const only = Date.parse('2026-10-08T18:00:00.000Z');
    expect(formatSeriesRange(only, null, NOW)).toBeTruthy();
    expect(formatSeriesRange(null, only, NOW)).toBeTruthy();
  });

  it('gives nothing when neither end is known', () => {
    expect(formatSeriesRange(null, null, NOW)).toBeUndefined();
  });
});

describe('sessionCountLabel', () => {
  it('pluralises', () => {
    expect(sessionCountLabel(1)).toBe('1 session');
    expect(sessionCountLabel(12)).toBe('12 sessions');
  });
});

describe('seminarSeriesIndex', () => {
  it('returns nothing for an empty or missing list', () => {
    expect(seminarSeriesIndex([], NOW).size).toBe(0);
    expect(seminarSeriesIndex(null, NOW).size).toBe(0);
    expect(seminarSeriesIndex(undefined, NOW).size).toBe(0);
  });

  it('keys a multi-occurrence series by its seriesId', () => {
    const index = seminarSeriesIndex(
      [
        occ({ _id: 'a', start: '2026-10-01T18:00:00.000Z', end: '2026-10-01T19:00:00.000Z' }),
        occ({ _id: 'b', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
        occ({ _id: 'c', start: '2026-10-15T18:00:00.000Z', end: '2026-10-15T19:00:00.000Z' }),
      ],
      NOW,
    );
    expect(index.size).toBe(1);
    expect(index.get('series-1')?.occurrenceCount).toBe(3);
  });

  it('is reachable from any occurrence of the series, not only the representative one', () => {
    const occurrences = [
      occ({ _id: 'a', start: '2026-10-01T18:00:00.000Z', end: '2026-10-01T19:00:00.000Z' }),
      occ({ _id: 'b', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
    ];
    const index = seminarSeriesIndex(occurrences, NOW);
    for (const o of occurrences) {
      expect(index.get(seriesKey(o))?.occurrenceCount).toBe(2);
    }
  });

  it('counts every occurrence, including ones a caller has filtered out of its own list', () => {
    const all = [
      occ({ _id: 'past', start: '2026-09-24T18:00:00.000Z', end: '2026-09-24T19:00:00.000Z' }),
      occ({ _id: 'next', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
      occ({ _id: 'later', start: '2026-10-15T18:00:00.000Z', end: '2026-10-15T19:00:00.000Z' }),
    ];
    // The expert dashboard lists only upcoming occurrences, but the summary must
    // still describe the whole series.
    const upcomingOnly = all.filter(o => new Date(o.end).getTime() >= NOW.getTime());
    expect(upcomingOnly).toHaveLength(2);
    expect(seminarSeriesIndex(all, NOW).get('series-1')?.occurrenceCount).toBe(3);
  });

  it('gives a stand-alone seminar no entry, so it shows no series summary', () => {
    const index = seminarSeriesIndex(
      [occ({ _id: 'solo', seriesId: null })],
      NOW,
    );
    expect(index.size).toBe(0);
  });

  it('keeps two different series apart', () => {
    const index = seminarSeriesIndex(
      [
        occ({ _id: 'a1', seriesId: 's1', start: '2026-10-08T18:00:00.000Z', end: '2026-10-08T19:00:00.000Z' }),
        occ({ _id: 'a2', seriesId: 's1', start: '2026-10-15T18:00:00.000Z', end: '2026-10-15T19:00:00.000Z' }),
        occ({ _id: 'b1', seriesId: 's2', start: '2026-10-09T18:00:00.000Z', end: '2026-10-09T19:00:00.000Z' }),
        occ({ _id: 'b2', seriesId: 's2', start: '2026-10-16T18:00:00.000Z', end: '2026-10-16T19:00:00.000Z' }),
        occ({ _id: 'b3', seriesId: 's2', start: '2026-10-23T18:00:00.000Z', end: '2026-10-23T19:00:00.000Z' }),
      ],
      NOW,
    );
    expect(index.get('s1')?.occurrenceCount).toBe(2);
    expect(index.get('s2')?.occurrenceCount).toBe(3);
  });
});
