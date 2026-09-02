import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_RECURRENCE_OCCURRENCES,
    normalizeWeekdays,
    TOO_MANY_OCCURRENCES_MESSAGE,
    buildRecurrenceStartDates,
    legacyFrequencyFor,
    normalizeRecurrence,
    recurrenceFields,
    recurrenceRuleChanged,
    validateRecurrence,
} from '../utils/recurrence';

const iso = (d: Date) => d.toISOString();

test('legacy frequencies keep working without a migration', () => {
    assert.deepEqual(normalizeRecurrence({ recurrenceFrequency: 'weekly' }), {
        unit: 'week', interval: 1, weekdays: null, count: null, until: null,
    });
    assert.deepEqual(normalizeRecurrence({ recurrenceFrequency: 'biweekly' }), {
        unit: 'week', interval: 2, weekdays: null, count: null, until: null,
    });
    assert.deepEqual(normalizeRecurrence({ recurrenceFrequency: 'monthly' }), {
        unit: 'month', interval: 1, weekdays: null, count: null, until: null,
    });
    assert.equal(normalizeRecurrence({ recurrenceFrequency: 'yearly' }), null);
    assert.equal(normalizeRecurrence(null), null);
});

test('the new fields win over a stale legacy frequency', () => {
    const rule = normalizeRecurrence({
        recurrenceFrequency: 'weekly',
        recurrenceUnit: 'day',
        recurrenceInterval: 3,
        recurrenceCount: 10,
    });
    assert.deepEqual(rule, { unit: 'day', interval: 3, weekdays: null, count: 10, until: null });
});

test('a rule that matches a legacy pattern still stores its enum value', () => {
    assert.equal(legacyFrequencyFor({ unit: 'week', interval: 1 }), 'weekly');
    assert.equal(legacyFrequencyFor({ unit: 'week', interval: 2 }), 'biweekly');
    assert.equal(legacyFrequencyFor({ unit: 'month', interval: 1 }), 'monthly');
    assert.equal(legacyFrequencyFor({ unit: 'day', interval: 3 }), undefined);
    assert.equal(legacyFrequencyFor(null), undefined);
});

test('every N days steps the calendar and includes the first session', () => {
    const dates = buildRecurrenceStartDates(
        '2026-09-01T14:00:00Z',
        { unit: 'day', interval: 3, count: 4 },
        'UTC',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-09-01T14:00:00.000Z',
        '2026-09-04T14:00:00.000Z',
        '2026-09-07T14:00:00.000Z',
        '2026-09-10T14:00:00.000Z',
    ]);
});

test('daily for a year is allowed and bounded by the horizon', () => {
    const dates = buildRecurrenceStartDates('2026-09-01T14:00:00Z', { unit: 'day', interval: 1 }, 'UTC');
    assert.equal(dates.length, 365);
    assert.equal(iso(dates[dates.length - 1]), '2027-08-31T14:00:00.000Z');
});

test('a session count beats the one-year fallback horizon', () => {
    const dates = buildRecurrenceStartDates(
        '2026-09-01T14:00:00Z',
        { unit: 'week', interval: 1, count: 80 },
        'UTC',
    );
    assert.equal(dates.length, 80);
});

test('an end date bounds the series inclusively', () => {
    const dates = buildRecurrenceStartDates(
        '2026-09-01T14:00:00Z',
        { unit: 'day', interval: 2, until: new Date('2026-09-07T23:59:00Z') },
        'UTC',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-09-01T14:00:00.000Z',
        '2026-09-03T14:00:00.000Z',
        '2026-09-05T14:00:00.000Z',
        '2026-09-07T14:00:00.000Z',
    ]);
});

test('monthly clamps short months instead of spilling over', () => {
    const dates = buildRecurrenceStartDates(
        '2026-01-31T15:00:00Z',
        { unit: 'month', interval: 1, count: 4 },
        'UTC',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-01-31T15:00:00.000Z',
        '2026-02-28T15:00:00.000Z',
        '2026-03-31T15:00:00.000Z',
        '2026-04-30T15:00:00.000Z',
    ]);
});

test('the local start time survives a DST transition', () => {
    // 09:00 New York on Mar 4 is 14:00Z (EST); after Mar 8 it is 13:00Z (EDT).
    const dates = buildRecurrenceStartDates(
        '2026-03-04T14:00:00Z',
        { unit: 'week', interval: 1, count: 3 },
        'America/New_York',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-03-04T14:00:00.000Z',
        '2026-03-11T13:00:00.000Z',
        '2026-03-18T13:00:00.000Z',
    ]);
    const local = dates.map((d) =>
        d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false }),
    );
    assert.deepEqual(local, ['09:00:00', '09:00:00', '09:00:00']);
});

test('daily stepping holds the local hour across a DST transition', () => {
    const dates = buildRecurrenceStartDates(
        '2026-03-06T14:00:00Z',
        { unit: 'day', interval: 1, count: 5 },
        'America/New_York',
    );
    const local = dates.map((d) =>
        d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false }),
    );
    assert.deepEqual(local, ['09:00:00', '09:00:00', '09:00:00', '09:00:00', '09:00:00']);
});

test('an invalid start or missing rule produces no dates', () => {
    assert.deepEqual(buildRecurrenceStartDates('not-a-date', { unit: 'day', interval: 1 }, 'UTC'), []);
    assert.deepEqual(buildRecurrenceStartDates('2026-09-01T14:00:00Z', null, 'UTC'), []);
});

test('a non-recurring body yields no rule', () => {
    assert.deepEqual(validateRecurrence({ isRecurring: false }), { rule: null });
});

test('a legacy-only client still gets a rule', () => {
    assert.deepEqual(
        validateRecurrence({ isRecurring: true, recurrenceFrequency: 'biweekly' }),
        { rule: { unit: 'week', interval: 2, weekdays: null, count: null, until: null } },
    );
});

test('an unusable rule is rejected with copy the expert can act on', () => {
    const start = '2026-09-01T14:00:00Z';
    assert.match(
        validateRecurrence({ isRecurring: true, recurrenceUnit: 'fortnight', recurrenceInterval: 1 }, start).error!,
        /how often/i,
    );
    assert.match(
        validateRecurrence({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 0 }, start).error!,
        /Repeat every 1 to 30/,
    );
    assert.match(
        validateRecurrence({ isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1.5 }, start).error!,
        /Repeat every 1 to 30/,
    );
    assert.match(
        validateRecurrence(
            { isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceCount: 0 },
            start,
        ).error!,
        /whole number of 1 or more/,
    );
    assert.match(
        validateRecurrence(
            { isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceUntil: '2026-08-01T00:00:00Z' },
            start,
        ).error!,
        /on or after the first session/,
    );
});

test('the runaway guard rejects rather than silently truncating', () => {
    const start = '2026-09-01T14:00:00Z';
    assert.equal(
        validateRecurrence(
            { isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceCount: 9999 },
            start,
        ).error,
        TOO_MANY_OCCURRENCES_MESSAGE,
    );
    assert.equal(
        validateRecurrence(
            {
                isRecurring: true,
                recurrenceUnit: 'day',
                recurrenceInterval: 1,
                recurrenceUntil: '2030-09-01T14:00:00Z',
                timezone: 'UTC',
            },
            start,
        ).error,
        TOO_MANY_OCCURRENCES_MESSAGE,
    );
    const ok = validateRecurrence(
        { isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceCount: MAX_RECURRENCE_OCCURRENCES },
        start,
    );
    assert.equal(ok.error, undefined);
    assert.equal(ok.rule!.count, MAX_RECURRENCE_OCCURRENCES);
});

test('a session count wins when an end date is also sent', () => {
    const { rule } = validateRecurrence(
        {
            isRecurring: true,
            recurrenceUnit: 'week',
            recurrenceInterval: 1,
            recurrenceCount: 5,
            recurrenceUntil: '2030-01-01T00:00:00Z',
        },
        '2026-09-01T14:00:00Z',
    );
    assert.equal(rule!.count, 5);
    assert.equal(rule!.until, null);
});

test('stored fields carry the legacy enum only when the rule has one', () => {
    assert.equal(recurrenceFields({ unit: 'week', interval: 2 }).recurrenceFrequency, 'biweekly');
    assert.equal(recurrenceFields({ unit: 'day', interval: 3 }).recurrenceFrequency, undefined);
    assert.equal(recurrenceFields(null).isRecurring, false);
});

test('only the spacing of a series counts as a rule change', () => {
    const weekly = { unit: 'week' as const, interval: 1, count: 10, until: null };
    assert.equal(recurrenceRuleChanged(weekly, { unit: 'week', interval: 1, count: 20, until: null }), false);
    assert.equal(recurrenceRuleChanged(weekly, { unit: 'day', interval: 1, count: 10, until: null }), true);
    assert.equal(recurrenceRuleChanged(weekly, { unit: 'week', interval: 2, count: 10, until: null }), true);
    assert.equal(recurrenceRuleChanged(null, weekly), false);
});

// 2026-09-01 is a Tuesday.
const TUE = '2026-09-01T14:00:00Z';
const dayNames = (dates: Date[]) =>
    dates.map((d) => d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }));

test('a weekly rule can run on several named weekdays', () => {
    // Mon (1) and Fri (5), starting on a Tuesday.
    const dates = buildRecurrenceStartDates(
        TUE,
        { unit: 'week', interval: 1, weekdays: [1, 5], count: 5 },
        'UTC',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-09-01T14:00:00.000Z', // the start itself
        '2026-09-04T14:00:00.000Z', // Fri
        '2026-09-07T14:00:00.000Z', // Mon
        '2026-09-11T14:00:00.000Z', // Fri
        '2026-09-14T14:00:00.000Z', // Mon
    ]);
    assert.deepEqual(dayNames(dates), ['Tue', 'Fri', 'Mon', 'Fri', 'Mon']);
});

test('days earlier in the first week than the start are not sessions', () => {
    // Start Tuesday, run Mondays and Wednesdays: the Monday before is skipped.
    const dates = buildRecurrenceStartDates(
        TUE,
        { unit: 'week', interval: 1, weekdays: [1, 3], count: 4 },
        'UTC',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-09-01T14:00:00.000Z', // Tue, the start
        '2026-09-02T14:00:00.000Z', // Wed
        '2026-09-07T14:00:00.000Z', // Mon
        '2026-09-09T14:00:00.000Z', // Wed
    ]);
});

test('a weekday set starting on one of its own days adds nothing extra', () => {
    // Start Tuesday, run Tuesdays and Thursdays.
    const dates = buildRecurrenceStartDates(
        TUE,
        { unit: 'week', interval: 1, weekdays: [2, 4], count: 4 },
        'UTC',
    );
    assert.deepEqual(dayNames(dates), ['Tue', 'Thu', 'Tue', 'Thu']);
    assert.equal(iso(dates[0]), '2026-09-01T14:00:00.000Z');
});

test('named weekdays honour the week interval', () => {
    const dates = buildRecurrenceStartDates(
        TUE,
        { unit: 'week', interval: 2, weekdays: [2, 4], count: 4 },
        'UTC',
    );
    assert.deepEqual(dates.map(iso), [
        '2026-09-01T14:00:00.000Z', // Tue
        '2026-09-03T14:00:00.000Z', // Thu
        '2026-09-15T14:00:00.000Z', // Tue, two weeks on
        '2026-09-17T14:00:00.000Z', // Thu
    ]);
});

test('named weekdays hold the local time across a DST transition', () => {
    const dates = buildRecurrenceStartDates(
        '2026-03-02T14:00:00Z', // Mon 09:00 New York
        { unit: 'week', interval: 1, weekdays: [1, 5], count: 4 },
        'America/New_York',
    );
    const local = dates.map((d) =>
        d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', hour12: false }),
    );
    assert.deepEqual(local, ['Mon, 09', 'Fri, 09', 'Mon, 09', 'Fri, 09']);
});

test('named weekdays run to an end date and to the fallback horizon', () => {
    const bounded = buildRecurrenceStartDates(
        TUE,
        { unit: 'week', interval: 1, weekdays: [1, 5], until: new Date('2026-09-12T23:59:00Z') },
        'UTC',
    );
    assert.deepEqual(dayNames(bounded), ['Tue', 'Fri', 'Mon', 'Fri']);

    // Two days a week for a year, plus the start date itself.
    const yearLong = buildRecurrenceStartDates(TUE, { unit: 'week', interval: 1, weekdays: [1, 5] }, 'UTC');
    assert.equal(yearLong.length, 105);
});

test('a weekday set is only meaningful on a weekly rule', () => {
    assert.deepEqual(normalizeWeekdays('week', [5, 1, 1]), [1, 5]);
    assert.equal(normalizeWeekdays('day', [1, 5]), null);
    assert.equal(normalizeWeekdays('month', [1, 5]), null);
    // A single day is just the plain weekly rule the start date already implies.
    assert.equal(normalizeWeekdays('week', [3]), null);
    assert.equal(normalizeWeekdays('week', []), null);
    assert.deepEqual(normalizeWeekdays('week', [9, 2, -1, 4]), [2, 4]);
});

test('a weekday set has no legacy frequency to fall back on', () => {
    assert.equal(legacyFrequencyFor({ unit: 'week', interval: 1, weekdays: [1, 5] }), undefined);
    assert.equal(legacyFrequencyFor({ unit: 'week', interval: 1, weekdays: null }), 'weekly');
});

test('changing which weekdays a series runs on is a rule change', () => {
    const monFri = { unit: 'week' as const, interval: 1, weekdays: [1, 5], count: null, until: null };
    assert.equal(recurrenceRuleChanged(monFri, { ...monFri, weekdays: [1, 3] }), true);
    assert.equal(recurrenceRuleChanged(monFri, { ...monFri, weekdays: [1, 5] }), false);
    assert.equal(recurrenceRuleChanged(monFri, { ...monFri, count: 20 }), false);
});

test('weekdays sent with a daily or monthly rule are refused, not dropped', () => {
    assert.match(
        validateRecurrence(
            { isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceWeekdays: [1, 5] },
            TUE,
        ).error!,
        /only for a weekly schedule/i,
    );
    assert.match(
        validateRecurrence(
            { isRecurring: true, recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceWeekdays: [1, 9] },
            TUE,
        ).error!,
        /which days of the week/i,
    );
});

test('a validated weekday rule stores its days', () => {
    const { rule, error } = validateRecurrence(
        {
            isRecurring: true,
            recurrenceUnit: 'week',
            recurrenceInterval: 1,
            recurrenceWeekdays: [5, 1],
            recurrenceCount: 10,
            timezone: 'UTC',
        },
        TUE,
    );
    assert.equal(error, undefined);
    assert.deepEqual(rule!.weekdays, [1, 5]);
    assert.deepEqual(recurrenceFields(rule).recurrenceWeekdays, [1, 5]);
    assert.deepEqual(recurrenceFields({ unit: 'week', interval: 1 }).recurrenceWeekdays, []);
});

test('a doc storing weekdays reads back as a weekday rule', () => {
    assert.deepEqual(
        normalizeRecurrence({ recurrenceUnit: 'week', recurrenceInterval: 1, recurrenceWeekdays: [5, 1] }),
        { unit: 'week', interval: 1, weekdays: [1, 5], count: null, until: null },
    );
});
