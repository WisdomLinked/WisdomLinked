/**
 * Admin Platform snapshot: date-range filters, previous-period windows,
 * and monthly buckets. Uses existing fields only — no schema changes.
 *
 * Invalid / epoch dates (before 1971) are excluded from range and past counts.
 */

export const SYSTEM_CHAT_NAMES = ["Global Chat", "Admin"] as const;

/** Dates at or before Unix epoch / 1970 are treated as "no date set". */
export const MIN_VALID_DATE = new Date("1971-01-01T00:00:00.000Z");

export type SnapshotRange = {
    from: Date | null;
    to: Date | null;
    previousFrom: Date | null;
    previousTo: Date | null;
    isAllTime: boolean;
};

export type AmountByCurrency = Record<string, number>;

export type SnapshotPeriodCounts = {
    expertsJoined: number;
    customersJoined: number;
    sessionsHeld: number;
    seminarsHeld: number;
    paymentsCount: number;
    refundsCount: number;
    paymentsAmountByCurrency: AmountByCurrency;
    refundsAmountByCurrency: AmountByCurrency;
    sessionsCancelled: number;
    seminarsAttendees: number;
    refundsUnlinked: number;
};

export type MonthlyPoint = {
    month: string;
    count: number;
    amountsByCurrency?: AmountByCurrency;
};

export type SnapshotMonthly = {
    experts: MonthlyPoint[];
    customers: MonthlyPoint[];
    sessions: MonthlyPoint[];
    seminars: MonthlyPoint[];
    payments: MonthlyPoint[];
    refunds: MonthlyPoint[];
};

export function parseDateParam(value: unknown): Date | null {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

export function isValidRecordDate(value: unknown): boolean {
    const d = parseDateParam(value);
    return Boolean(d && d.getTime() >= MIN_VALID_DATE.getTime());
}

/**
 * Inclusive start, exclusive end. When both bounds exist, previous is the
 * window of the same length immediately before `from`.
 */
export function resolveSnapshotRange(
    dateFrom: unknown,
    dateTo: unknown,
    now: Date = new Date(),
): SnapshotRange {
    const from = parseDateParam(dateFrom);
    const to = parseDateParam(dateTo) || (from ? now : null);
    if (!from && !to) {
        return {
            from: null,
            to: null,
            previousFrom: null,
            previousTo: null,
            isAllTime: true,
        };
    }
    const start = from;
    const end = to || now;
    if (!start) {
        return {
            from: null,
            to: end,
            previousFrom: null,
            previousTo: null,
            isAllTime: false,
        };
    }
    const ms = Math.max(0, end.getTime() - start.getTime());
    return {
        from: start,
        to: end,
        previousFrom: new Date(start.getTime() - ms),
        previousTo: start,
        isAllTime: false,
    };
}

/** createdAt in [from, to). Always excludes epoch dates. */
export function createdAtFilter(from: Date | null, to: Date | null): { createdAt: Record<string, Date> } {
    const createdAt: Record<string, Date> = { $gte: MIN_VALID_DATE };
    if (from && from.getTime() > MIN_VALID_DATE.getTime()) createdAt.$gte = from;
    if (to) createdAt.$lt = to;
    return { createdAt };
}

/** Valid start in [from, to). Does not cap at now — used for list date-range filters. */
export function startInRangeFilter(from: Date | null, to: Date | null): { start: Record<string, Date> } {
    const start: Record<string, Date> = { $gte: MIN_VALID_DATE };
    if (from && from.getTime() > MIN_VALID_DATE.getTime()) start.$gte = from;
    if (to) start.$lt = to;
    return { start };
}

/**
 * Held in range: valid start, start in [from, to), and start < now.
 * Used for 1:1 Event bookings and seminar GroupChats.
 */
export function heldStartFilter(from: Date | null, to: Date | null, now: Date): Record<string, unknown> {
    const endBound = to && to.getTime() < now.getTime() ? to : now;
    const startBound =
        from && from.getTime() > MIN_VALID_DATE.getTime() ? from : MIN_VALID_DATE;
    return { start: { $gte: startBound, $lt: endBound } };
}

export function upcomingStartFilter(now: Date): Record<string, unknown> {
    const bound = now.getTime() > MIN_VALID_DATE.getTime() ? now : MIN_VALID_DATE;
    return { start: { $gte: bound } };
}

export function seminarBaseFilter(): Record<string, unknown> {
    return {
        type: "seminar",
        name: { $nin: [...SYSTEM_CHAT_NAMES] },
    };
}

export function oneToOneGroupFilter(): Record<string, unknown> {
    return { type: "individual" };
}

export const CANCELLED_SESSION_STATUSES = ["cancelled", "canceled", "declined"] as const;

export function cancelledSessionFilter(from: Date | null, to: Date | null, now: Date): Record<string, unknown> {
    return {
        ...heldStartFilter(from, to, now),
        status: { $in: [...CANCELLED_SESSION_STATUSES] },
    };
}

export function heldSessionFilter(from: Date | null, to: Date | null, now: Date): Record<string, unknown> {
    return {
        ...heldStartFilter(from, to, now),
        status: { $nin: [...CANCELLED_SESSION_STATUSES] },
    };
}

export function upcomingSessionFilter(now: Date): Record<string, unknown> {
    return {
        ...upcomingStartFilter(now),
        status: { $nin: [...CANCELLED_SESSION_STATUSES] },
    };
}

export function sumMonthCountRows(...lists: { _id?: unknown; count?: number }[][]): { _id: string; count: number }[] {
    const byMonth = new Map<string, number>();
    for (const rows of lists) {
        for (const row of rows || []) {
            const month = typeof row._id === "string" ? row._id : "";
            if (!month) continue;
            byMonth.set(month, (byMonth.get(month) || 0) + (Number(row.count) || 0));
        }
    }
    return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ _id: month, count }));
}

export function statusListFilter(raw: unknown): { status: string | { $in: string[] } } | null {
    const statuses = String(raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (!statuses.length) return null;
    return { status: statuses.length === 1 ? statuses[0] : { $in: statuses } };
}

export function monthKeyUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/** First-of-month UTC keys covering [from, to). */
export function monthsInRange(from: Date, to: Date): string[] {
    const keys: string[] = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    while (cursor.getTime() <= end.getTime()) {
        keys.push(monthKeyUTC(cursor));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
}

/** Month keys for a range whose end is exclusive: a range ending at 00:00 on Aug 1 does not include August. */
export function monthsInHalfOpenRange(from: Date, toExclusive: Date): string[] {
    return monthsInRange(from, new Date(Math.max(from.getTime(), toExclusive.getTime() - 1)));
}

/**
 * Month keys for an all-time chart: every month from the first month with data to the
 * current month (or a later data month), so empty months show as gaps instead of being skipped.
 */
export function allTimeMonthKeys(points: { month: string }[], now: Date): string[] {
    const months = points.map((p) => p.month).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
    if (!months.length) return [];
    const first = months[0];
    const last = [months[months.length - 1], monthKeyUTC(now)].sort()[1];
    const [fy, fm] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    return monthsInRange(new Date(Date.UTC(fy, fm - 1, 1)), new Date(Date.UTC(ly, lm - 1, 1)));
}

export function fillMonthlySeries(
    keys: string[],
    rows: { month: string; count: number; amountsByCurrency?: AmountByCurrency }[],
): MonthlyPoint[] {
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    return keys.map((month) => {
        const hit = byMonth.get(month);
        return {
            month,
            count: hit?.count || 0,
            ...(hit?.amountsByCurrency ? { amountsByCurrency: hit.amountsByCurrency } : {}),
        };
    });
}

/** ((current - previous) / previous) * 100. previous=0 → 100 if current>0 else 0. */
export function changePct(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function changePctByCurrency(
    current: AmountByCurrency,
    previous: AmountByCurrency,
): AmountByCurrency {
    const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
    const out: AmountByCurrency = {};
    for (const k of keys) {
        out[k] = changePct(current[k] || 0, previous[k] || 0);
    }
    return out;
}

export function emptyPeriodCounts(): SnapshotPeriodCounts {
    return {
        expertsJoined: 0,
        customersJoined: 0,
        sessionsHeld: 0,
        seminarsHeld: 0,
        paymentsCount: 0,
        refundsCount: 0,
        paymentsAmountByCurrency: {},
        refundsAmountByCurrency: {},
        sessionsCancelled: 0,
        seminarsAttendees: 0,
        refundsUnlinked: 0,
    };
}

export function periodChange(
    current: SnapshotPeriodCounts,
    previous: SnapshotPeriodCounts,
): Record<string, number | AmountByCurrency> {
    return {
        expertsJoined: changePct(current.expertsJoined, previous.expertsJoined),
        customersJoined: changePct(current.customersJoined, previous.customersJoined),
        sessionsHeld: changePct(current.sessionsHeld, previous.sessionsHeld),
        seminarsHeld: changePct(current.seminarsHeld, previous.seminarsHeld),
        paymentsCount: changePct(current.paymentsCount, previous.paymentsCount),
        refundsCount: changePct(current.refundsCount, previous.refundsCount),
        paymentsAmountByCurrency: changePctByCurrency(
            current.paymentsAmountByCurrency,
            previous.paymentsAmountByCurrency,
        ),
        refundsAmountByCurrency: changePctByCurrency(
            current.refundsAmountByCurrency,
            previous.refundsAmountByCurrency,
        ),
    };
}

const CURRENCY_EXPR = { $toLower: { $ifNull: ["$currency", "usd"] } };

export function amountByCurrencyFromAgg(
    rows: { _id?: string; amount?: number }[],
): AmountByCurrency {
    const out: AmountByCurrency = {};
    for (const row of rows) {
        const key = String(row._id || "usd").toLowerCase();
        const n = Number(row.amount);
        if (!Number.isFinite(n) || n === 0) continue;
        out[key] = (out[key] || 0) + n;
    }
    return out;
}

export const PAYMENT_HISTORY_COLLECTION = "paymenthistories";

/**
 * COLLECTED for charges matching `match`: each charge's amount minus the refunds
 * recorded against that same charge (same payment intent), whenever they happened,
 * never below 0 per charge. A refund with no charge in the result is not subtracted,
 * so a refund for an older or unknown charge cannot pull the total negative.
 * Groups by `groupId` with `count` (charges) and `amount` (kept cents).
 */
export function keptChargesPipeline(match: Record<string, unknown>, groupId: unknown) {
    return [
        { $match: match },
        {
            $lookup: {
                from: PAYMENT_HISTORY_COLLECTION,
                let: { pi: "$paymentIntent" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$paymentType", "refund"] },
                                    { $eq: [{ $type: "$$pi" }, "string"] },
                                    { $eq: ["$paymentIntent", "$$pi"] },
                                ],
                            },
                        },
                    },
                    { $group: { _id: null, refunded: { $sum: { $ifNull: ["$amount", 0] } } } },
                ],
                as: "refundTotals",
            },
        },
        {
            $addFields: {
                keptCents: {
                    $max: [
                        0,
                        {
                            $subtract: [
                                { $ifNull: ["$amount", 0] },
                                { $ifNull: [{ $arrayElemAt: ["$refundTotals.refunded", 0] }, 0] },
                            ],
                        },
                    ],
                },
            },
        },
        { $group: { _id: groupId, count: { $sum: 1 }, amount: { $sum: "$keptCents" } } },
    ];
}

export function monthlyFromAgg(
    rows: { _id?: string | { month?: string; currency?: string }; count?: number; amount?: number }[],
    withAmounts: boolean,
): MonthlyPoint[] {
    if (!withAmounts) {
        return rows.map((row) => ({
            month: String(typeof row._id === "string" ? row._id : row._id?.month || ""),
            count: Number(row.count) || 0,
        })).filter((r) => r.month);
    }
    const byMonth = new Map<string, MonthlyPoint>();
    for (const row of rows) {
        const month =
            typeof row._id === "string" ? row._id : String(row._id?.month || "");
        if (!month) continue;
        const cur = typeof row._id === "object" ? String(row._id?.currency || "usd").toLowerCase() : "usd";
        const existing = byMonth.get(month) || { month, count: 0, amountsByCurrency: {} };
        existing.count += Number(row.count) || 0;
        const amt = Number(row.amount);
        if (Number.isFinite(amt) && amt !== 0) {
            existing.amountsByCurrency = existing.amountsByCurrency || {};
            existing.amountsByCurrency[cur] = (existing.amountsByCurrency[cur] || 0) + amt;
        }
        byMonth.set(month, existing);
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export const MONTH_GROUP_CREATED = {
    $dateToString: { format: "%Y-%m", date: "$createdAt" },
};

export const MONTH_GROUP_START = {
    $dateToString: { format: "%Y-%m", date: "$start" },
};

/** Successful charge rows that still count toward COLLECTED / COUNT (excludes refund ledger rows). */
export const SUCCESSFUL_CHARGE_STATUSES = ["completed", "partially_refunded"] as const;

export function paymentCompletedMatch(
    createdAt: { createdAt?: Record<string, Date> } = {},
    extra: Record<string, unknown> = {},
) {
    return {
        paymentType: { $ne: "refund" },
        status: { $in: [...SUCCESSFUL_CHARGE_STATUSES] },
        ...extra,
        ...createdAt,
    };
}

/** @deprecated Prefer paymentCompletedMatch — COUNT must match successful charges only. */
export function paymentCountMatch(
    createdAt: { createdAt?: Record<string, Date> } = {},
    extra: Record<string, unknown> = {},
) {
    return paymentCompletedMatch(createdAt, extra);
}

export function refundMatch(
    createdAt: { createdAt?: Record<string, Date> } = {},
    extra: Record<string, unknown> = {},
) {
    return {
        paymentType: "refund",
        ...extra,
        ...createdAt,
    };
}

export const currencyGroupId = CURRENCY_EXPR;

export function clampPage(currentPage: unknown): number {
    const n = Number(currentPage);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

export function clampPageSize(numPerPage: unknown, fallback = 50, max = 100): number {
    const n = Number(numPerPage);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(max, Math.floor(n));
}
