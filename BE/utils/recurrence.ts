// A recurring seminar is materialized: every occurrence is a real GroupChat doc
// linked by seriesId. The expert chooses how often it repeats (every N days,
// weeks or months — optionally on named weekdays) and how long the series runs
// (a number of sessions, an end date, or neither — which falls back to a year).
// This module owns the rule: how it is read off a doc, how it is validated, and
// how it expands to dates.

export type RecurrenceUnit = 'day' | 'week' | 'month';

export interface RecurrenceRule {
    unit: RecurrenceUnit;
    interval: number;
    /**
     * Weekly rules only: the days each active week runs on, 0 = Sunday. A seminar
     * on Mondays and Fridays is { unit: 'week', interval: 1, weekdays: [1, 5] }.
     * Null (or a single day) means "the same weekday as the first session".
     */
    weekdays?: number[] | null;
    count?: number | null;
    until?: Date | null;
}

/** Sunday-first, matching Date#getDay. */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Weekday sets are only meaningful on a weekly rule, and a set of one is just the
 * plain weekly rule the start date already implies. Anything else is normalized to
 * a sorted, deduped, in-range list.
 */
export const normalizeWeekdays = (unit: RecurrenceUnit, raw: unknown): number[] | null => {
    if (unit !== 'week' || !Array.isArray(raw)) return null;
    const days = Array.from(
        new Set(
            raw
                .map((d: any) => Number(d))
                .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6),
        ),
    ).sort((a, b) => a - b);
    return days.length > 1 ? days : null;
};

export const RECURRENCE_UNITS: RecurrenceUnit[] = ['day', 'week', 'month'];

/** Legacy enum values, kept so older docs and clients keep working. */
export const RECURRENCE_FREQUENCIES = ['weekly', 'biweekly', 'monthly'];

/**
 * How long a series runs when the expert sets neither a session count nor an end
 * date. Matches the horizon recurring seminars have always used.
 */
export const DEFAULT_RECURRENCE_HORIZON_YEARS = 1;

/**
 * Runaway guard, not a policy: the expert decides how long a series runs, but a
 * mistyped session count must not spawn an unbounded write. Anything legitimate
 * (daily for a year is 366) fits well under this.
 */
export const MAX_RECURRENCE_OCCURRENCES = 500;

export const MAX_RECURRENCE_INTERVAL = 30;

const LEGACY_RULES: Record<string, { unit: RecurrenceUnit; interval: number }> = {
    weekly: { unit: 'week', interval: 1 },
    biweekly: { unit: 'week', interval: 2 },
    monthly: { unit: 'month', interval: 1 },
};

/**
 * Occurrences are written up front and can already be booked, so re-spacing a
 * live series would move sessions students have paid for.
 */
export const RECURRING_RULE_LOCKED_MESSAGE =
    "This seminar's repeat schedule can't be changed once the series exists. Cancel it and create a new series to use a different schedule.";

export const TOO_MANY_OCCURRENCES_MESSAGE =
    `That schedule creates more than ${MAX_RECURRENCE_OCCURRENCES} sessions. Shorten the series or space the sessions further apart.`;

const isPositiveInt = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v > 0;

/**
 * The rule a doc is running under. New docs carry unit/interval; docs written
 * before flexible recurrence carry only the legacy frequency enum, so they are
 * mapped on read and never need a migration.
 */
export const normalizeRecurrence = (doc: any): RecurrenceRule | null => {
    if (!doc) return null;
    const interval = Number(doc.recurrenceInterval);
    if (RECURRENCE_UNITS.includes(doc.recurrenceUnit) && isPositiveInt(interval)) {
        return {
            unit: doc.recurrenceUnit,
            interval,
            weekdays: normalizeWeekdays(doc.recurrenceUnit, doc.recurrenceWeekdays),
            count: isPositiveInt(doc.recurrenceCount) ? doc.recurrenceCount : null,
            until: doc.recurrenceUntil ? new Date(doc.recurrenceUntil) : null,
        };
    }
    const legacy = LEGACY_RULES[doc.recurrenceFrequency];
    return legacy ? { ...legacy, weekdays: null, count: null, until: null } : null;
};

/**
 * The legacy enum value for a rule, or undefined when the rule has no legacy
 * equivalent (every 3 days, say). Written alongside the new fields so surfaces
 * that still read recurrenceFrequency keep rendering familiar schedules.
 */
export const legacyFrequencyFor = (rule: RecurrenceRule | null): string | undefined => {
    // A weekday set has no legacy equivalent — "Mon & Fri" is not "weekly".
    if (!rule || (rule.weekdays && rule.weekdays.length > 1)) return undefined;
    for (const [frequency, legacy] of Object.entries(LEGACY_RULES)) {
        if (legacy.unit === rule.unit && legacy.interval === rule.interval) return frequency;
    }
    return undefined;
};

/** True when two rules would produce different dates — used to refuse a live re-schedule. */
export const recurrenceRuleChanged = (
    current: RecurrenceRule | null,
    next: RecurrenceRule | null,
): boolean => {
    if (!current || !next) return false;
    return (
        current.unit !== next.unit ||
        current.interval !== next.interval ||
        (current.weekdays ?? []).join(',') !== (next.weekdays ?? []).join(',')
    );
};

interface LocalParts {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
    second: number;
    ms: number;
}

const daysInMonth = (year: number, month: number): number =>
    new Date(Date.UTC(year, month, 0)).getUTCDate();

const partsFormatter = (timeZone: string) =>
    new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

/** Offset of a zone from UTC at a given instant, in ms. */
const zoneOffsetMs = (date: Date, timeZone: string): number => {
    const parts = partsFormatter(timeZone).formatToParts(date);
    const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    let hour = read('hour');
    if (hour === 24) hour = 0;
    const asUTC = Date.UTC(read('year'), read('month') - 1, read('day'), hour, read('minute'), read('second'));
    return asUTC - Math.floor(date.getTime() / 1000) * 1000;
};

const toLocalParts = (date: Date, timeZone: string | null): LocalParts => {
    if (!timeZone) {
        return {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
            hour: date.getUTCHours(),
            minute: date.getUTCMinutes(),
            second: date.getUTCSeconds(),
            ms: date.getUTCMilliseconds(),
        };
    }
    const parts = partsFormatter(timeZone).formatToParts(date);
    const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const hour = read('hour');
    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: hour === 24 ? 0 : hour,
        minute: read('minute'),
        second: read('second'),
        ms: date.getUTCMilliseconds(),
    };
};

/**
 * The instant at which the given wall-clock time occurs in a zone. Two passes:
 * the first guess uses the offset at the UTC-equivalent instant, the second
 * corrects it when that guess landed on the other side of a DST transition.
 */
const fromLocalParts = (parts: LocalParts, timeZone: string | null): Date => {
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.ms);
    if (!timeZone) return new Date(wall);
    let ts = wall - zoneOffsetMs(new Date(wall), timeZone);
    ts = wall - zoneOffsetMs(new Date(ts), timeZone);
    return new Date(ts);
};

/**
 * Advance a wall-clock date by n units. Days and weeks step the calendar, so the
 * local start time survives a DST change instead of drifting an hour. Months keep
 * the base day-of-month and clamp to the end of short months (Jan 31 -> Feb 28,
 * then back to Mar 31) rather than spilling into the next month.
 */
const addUnits = (base: LocalParts, unit: RecurrenceUnit, n: number): LocalParts => {
    if (unit === 'month') {
        const shifted = base.month - 1 + n;
        const year = base.year + Math.floor(shifted / 12);
        const month = ((shifted % 12) + 12) % 12 + 1;
        return { ...base, year, month, day: Math.min(base.day, daysInMonth(year, month)) };
    }
    const days = unit === 'week' ? n * 7 : n;
    const stepped = new Date(Date.UTC(base.year, base.month - 1, base.day + days));
    return {
        ...base,
        year: stepped.getUTCFullYear(),
        month: stepped.getUTCMonth() + 1,
        day: stepped.getUTCDate(),
    };
};

/**
 * Every start date in the series, first session included. `timezone` is the
 * seminar's own zone — occurrences hold their local start time in it.
 */
export const buildRecurrenceStartDates = (
    start: Date | string | number,
    rule: RecurrenceRule | null,
    timezone?: string | null,
    maxOccurrences: number = MAX_RECURRENCE_OCCURRENCES,
): Date[] => {
    const base = new Date(start as any);
    if (!rule || Number.isNaN(base.getTime())) return [];

    const zone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : null;
    const baseParts = toLocalParts(base, zone);
    const baseWeekday = new Date(Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day)).getUTCDay();

    const horizon = new Date(base);
    horizon.setUTCFullYear(horizon.getUTCFullYear() + DEFAULT_RECURRENCE_HORIZON_YEARS);

    const untilMs = rule.until && !Number.isNaN(new Date(rule.until).getTime())
        ? new Date(rule.until).getTime()
        : null;
    // A session count is what the expert typed, so it wins over the fallback
    // horizon: "60 daily sessions" must produce 60, not stop at a year.
    const limit = isPositiveInt(rule.count)
        ? Math.min(rule.count, maxOccurrences)
        : maxOccurrences;

    const weekdays = normalizeWeekdays(rule.unit, rule.weekdays);

    // Weekly-on-named-days walks whole weeks and emits each selected day inside
    // them; every other rule is a straight step from the start date.
    const candidateAt = (n: number): Date | null => {
        if (!weekdays) return fromLocalParts(addUnits(baseParts, rule.unit, n * rule.interval), zone);
        const block = Math.floor(n / weekdays.length);
        const dayOfWeek = weekdays[n % weekdays.length];
        // Sunday of the start's own week, then forward whole intervals of weeks.
        const weekAnchor = addUnits(baseParts, 'day', -baseWeekday + block * rule.interval * 7);
        const occurrence = fromLocalParts(addUnits(weekAnchor, 'day', dayOfWeek), zone);
        // Days earlier in the first week than the start date aren't sessions.
        return occurrence.getTime() < base.getTime() ? null : occurrence;
    };

    const out: Date[] = [];
    // The seminar's own start is always its first session, even when the expert
    // picked weekdays that don't include the day they started on.
    if (weekdays && !weekdays.includes(baseWeekday)) out.push(base);

    for (let n = 0; out.length < limit; n += 1) {
        // A weekday set can leave gaps at the start of the first week; keep
        // walking rather than stopping at the first one that doesn't qualify.
        const occurrence = candidateAt(n);
        if (!occurrence) continue;
        if (untilMs !== null) {
            if (occurrence.getTime() > untilMs) break;
        } else if (!isPositiveInt(rule.count) && occurrence >= horizon) {
            break;
        }
        out.push(occurrence);
    }
    return out.slice(0, limit);
};

export interface RecurrenceValidation {
    rule: RecurrenceRule | null;
    error?: string;
}

/**
 * Reads a recurrence rule off a request body. Returns `{ rule: null }` when the
 * seminar does not repeat, and `{ error }` with copy the expert can act on when
 * the rule is unusable. Clients that still send only recurrenceFrequency keep
 * working.
 */
export const validateRecurrence = (body: any, start?: Date | string | number): RecurrenceValidation => {
    if (body?.isRecurring !== true) return { rule: null };

    const hasUnit = body.recurrenceUnit !== undefined || body.recurrenceInterval !== undefined;
    if (!hasUnit) {
        const legacy = LEGACY_RULES[body.recurrenceFrequency];
        if (!legacy) return { rule: null, error: 'Choose how often this seminar repeats.' };
        return { rule: { ...legacy, weekdays: null, count: null, until: null } };
    }

    if (!RECURRENCE_UNITS.includes(body.recurrenceUnit)) {
        return { rule: null, error: 'Choose how often this seminar repeats.' };
    }
    const interval = Number(body.recurrenceInterval);
    if (!Number.isInteger(interval) || interval < 1 || interval > MAX_RECURRENCE_INTERVAL) {
        return {
            rule: null,
            error: `Repeat every 1 to ${MAX_RECURRENCE_INTERVAL} ${body.recurrenceUnit}s.`,
        };
    }

    // A weekday set is only meaningful week-by-week; sent with any other unit it
    // is a contradiction the expert should see rather than have silently dropped.
    const rawWeekdays = body.recurrenceWeekdays;
    if (Array.isArray(rawWeekdays) && rawWeekdays.length > 1 && body.recurrenceUnit !== 'week') {
        return { rule: null, error: 'Pick specific weekdays only for a weekly schedule.' };
    }
    if (
        Array.isArray(rawWeekdays) &&
        rawWeekdays.some((d: any) => !Number.isInteger(Number(d)) || Number(d) < 0 || Number(d) > 6)
    ) {
        return { rule: null, error: 'Choose which days of the week this seminar runs on.' };
    }
    const weekdays = normalizeWeekdays(body.recurrenceUnit, rawWeekdays);

    let count: number | null = null;
    if (body.recurrenceCount !== undefined && body.recurrenceCount !== null && body.recurrenceCount !== '') {
        const parsed = Number(body.recurrenceCount);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return { rule: null, error: 'Number of sessions must be a whole number of 1 or more.' };
        }
        if (parsed > MAX_RECURRENCE_OCCURRENCES) return { rule: null, error: TOO_MANY_OCCURRENCES_MESSAGE };
        count = parsed;
    }

    let until: Date | null = null;
    // A session count and an end date both bound the series; the count is the
    // more explicit of the two, so it wins and the date is ignored.
    if (count === null && body.recurrenceUntil) {
        const parsed = new Date(body.recurrenceUntil);
        if (Number.isNaN(parsed.getTime())) {
            return { rule: null, error: 'The recurrence end date is not a valid date.' };
        }
        const startMs = start === undefined ? NaN : new Date(start as any).getTime();
        if (Number.isFinite(startMs) && parsed.getTime() < startMs) {
            return { rule: null, error: 'The recurrence end date must be on or after the first session.' };
        }
        until = parsed;
    }

    const rule: RecurrenceRule = { unit: body.recurrenceUnit, interval, weekdays, count, until };

    if (start !== undefined) {
        // Probe one past the guard so an end date that runs long is reported as
        // too many sessions instead of being silently truncated.
        const projected = buildRecurrenceStartDates(start, rule, body.timezone, MAX_RECURRENCE_OCCURRENCES + 1);
        if (projected.length > MAX_RECURRENCE_OCCURRENCES) {
            return { rule: null, error: TOO_MANY_OCCURRENCES_MESSAGE };
        }
        if (projected.length === 0) {
            return { rule: null, error: 'That schedule produces no sessions. Check the start date and end date.' };
        }
    }

    return { rule };
};

/** The fields a doc stores for a rule, ready to spread into a create or update. */
export const recurrenceFields = (rule: RecurrenceRule | null) => {
    if (!rule) {
        return {
            isRecurring: false,
            recurrenceUnit: undefined,
            recurrenceInterval: undefined,
            recurrenceWeekdays: undefined,
            recurrenceCount: undefined,
            recurrenceUntil: undefined,
            recurrenceFrequency: undefined,
        };
    }
    // null, not undefined: switching a rule from "10 sessions" to an end date has
    // to clear the count, and Mongoose drops undefined values from an update.
    return {
        isRecurring: true,
        recurrenceUnit: rule.unit,
        recurrenceInterval: rule.interval,
        recurrenceWeekdays: normalizeWeekdays(rule.unit, rule.weekdays) ?? [],
        recurrenceCount: rule.count ?? null,
        recurrenceUntil: rule.until ?? null,
        recurrenceFrequency: legacyFrequencyFor(rule),
    };
};
