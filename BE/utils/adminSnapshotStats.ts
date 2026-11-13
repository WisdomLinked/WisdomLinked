import {
    AmountByCurrency,
    SnapshotMonthly,
    SnapshotPeriodCounts,
    amountByCurrencyFromAgg,
    cancelledSessionFilter,
    createdAtFilter,
    fillMonthlySeries,
    heldSessionFilter,
    heldStartFilter,
    monthlyFromAgg,
    allTimeMonthKeys,
    monthsInHalfOpenRange,
    monthGroup,
    monthKeyInZone,
    monthKeysBetween,
    keptChargesPipeline,
    paymentCompletedMatch,
    refundMatch,
    oneToOneGroupFilter,
    seminarBaseFilter,
    sumMonthCountRows,
    upcomingSessionFilter,
    upcomingStartFilter,
    currencyGroupId,
} from "./adminSnapshot";
import { stripeModeMatch } from "./paymentsVisibleMode";

type CountModel = {
    countDocuments: (filter: unknown) => Promise<number>;
    aggregate: (pipeline: unknown[]) => Promise<any[]>;
};

type SnapshotModels = {
    User: CountModel;
    Event: CountModel;
    GroupChat: CountModel;
    PaymentHistory: CountModel;
};

function currencyAmountPipeline(match: Record<string, unknown>) {
    return [
        { $match: match },
        {
            $group: {
                _id: currencyGroupId,
                amount: { $sum: { $ifNull: ["$amount", 0] } },
            },
        },
    ];
}

function monthCountPipeline(match: Record<string, unknown>, dateGroup: unknown) {
    return [
        { $match: match },
        { $group: { _id: dateGroup, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ];
}

function monthPaymentPipeline(match: Record<string, unknown>, tz: string = "UTC") {
    return [
        { $match: match },
        {
            $group: {
                _id: { month: monthGroup("createdAt", tz), currency: currencyGroupId },
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ["$amount", 0] } },
            },
        },
    ];
}

const monthAndCurrency = (tz: string) => ({ month: monthGroup("createdAt", tz), currency: currencyGroupId });

function paymentModeExtra(requestedMode?: unknown): Record<string, unknown> {
    return stripeModeMatch(requestedMode);
}

export async function computePeriodSnapshot(
    models: SnapshotModels,
    from: Date | null,
    to: Date | null,
    now: Date,
    requestedStripeMode?: unknown,
): Promise<SnapshotPeriodCounts> {
    const createdAt = createdAtFilter(from, to);
    const mode = paymentModeExtra(requestedStripeMode);
    const held = heldStartFilter(from, to, now);
    const seminarHeld = { ...seminarBaseFilter(), ...held };
    const sessionHeld = heldSessionFilter(from, to, now);
    const cancelled = cancelledSessionFilter(from, to, now);
    const charges = paymentCompletedMatch(createdAt, mode);
    const refunds = refundMatch(createdAt, mode);

    const [
        expertsJoined,
        customersJoined,
        legacySessionsHeld,
        groupSessionsHeld,
        seminarsHeld,
        paymentsCount,
        refundsCount,
        paymentAmounts,
        refundAmounts,
        legacySessionsCancelled,
        groupSessionsCancelled,
        attendeeRows,
        refundsUnlinked,
    ] = await Promise.all([
        models.User.countDocuments({ role: "expert", ...createdAt }),
        models.User.countDocuments({ role: "customer", ...createdAt }),
        models.Event.countDocuments(sessionHeld),
        models.GroupChat.countDocuments({ ...oneToOneGroupFilter(), ...sessionHeld }),
        models.GroupChat.countDocuments(seminarHeld),
        models.PaymentHistory.countDocuments(charges),
        models.PaymentHistory.countDocuments(refunds),
        models.PaymentHistory.aggregate(keptChargesPipeline(charges, currencyGroupId)),
        models.PaymentHistory.aggregate(currencyAmountPipeline(refunds)),
        models.Event.countDocuments(cancelled),
        models.GroupChat.countDocuments({ ...oneToOneGroupFilter(), ...cancelled }),
        models.GroupChat.aggregate([
            { $match: seminarHeld },
            {
                $group: {
                    _id: null,
                    attendees: { $sum: { $size: { $ifNull: ["$participants", []] } } },
                },
            },
        ]),
        models.PaymentHistory.countDocuments({
            ...refunds,
            $and: [
                { $or: [{ customer: { $exists: false } }, { customer: null }] },
                { $or: [{ expert: { $exists: false } }, { expert: null }] },
            ],
        }),
    ]);

    const refunded = amountByCurrencyFromAgg(refundAmounts);

    return {
        expertsJoined,
        customersJoined,
        sessionsHeld: legacySessionsHeld + groupSessionsHeld,
        seminarsHeld,
        paymentsCount,
        refundsCount,
        paymentsAmountByCurrency: amountByCurrencyFromAgg(paymentAmounts),
        refundsAmountByCurrency: refunded,
        sessionsCancelled: legacySessionsCancelled + groupSessionsCancelled,
        seminarsAttendees: Number(attendeeRows?.[0]?.attendees) || 0,
        refundsUnlinked,
    };
}

export async function computeMonthlyBreakdown(
    models: SnapshotModels,
    from: Date | null,
    to: Date | null,
    now: Date,
    requestedStripeMode?: unknown,
    tz: string = "UTC",
): Promise<SnapshotMonthly> {
    const createdAt = createdAtFilter(from, to);
    const mode = paymentModeExtra(requestedStripeMode);
    const held = heldStartFilter(from, to, now);
    const seminarHeld = { ...seminarBaseFilter(), ...held };
    const sessionHeld = heldSessionFilter(from, to, now);
    const rangedKeys = from && to ? monthsInHalfOpenRange(from, to, tz) : null;
    const charges = paymentCompletedMatch(createdAt, mode);
    const refunds = refundMatch(createdAt, mode);

    const [experts, customers, legacySessions, groupSessions, seminars, paymentRows, refundRows] =
        await Promise.all([
            models.User.aggregate(monthCountPipeline({ role: "expert", ...createdAt }, monthGroup("createdAt", tz))),
            models.User.aggregate(monthCountPipeline({ role: "customer", ...createdAt }, monthGroup("createdAt", tz))),
            models.Event.aggregate(monthCountPipeline(sessionHeld, monthGroup("start", tz))),
            models.GroupChat.aggregate(
                monthCountPipeline({ ...oneToOneGroupFilter(), ...sessionHeld }, monthGroup("start", tz)),
            ),
            models.GroupChat.aggregate(monthCountPipeline(seminarHeld, monthGroup("start", tz))),
            models.PaymentHistory.aggregate(keptChargesPipeline(charges, monthAndCurrency(tz))),
            models.PaymentHistory.aggregate(monthPaymentPipeline(refunds, tz)),
        ]);

    const expertPoints = monthlyFromAgg(experts, false);
    const customerPoints = monthlyFromAgg(customers, false);
    const sessionPoints = monthlyFromAgg(sumMonthCountRows(legacySessions, groupSessions), false);
    const seminarPoints = monthlyFromAgg(seminars, false);
    const paymentPoints = monthlyFromAgg(paymentRows, true);
    const refundPoints = monthlyFromAgg(refundRows, true);

    // Shared month axis so every tile pads the same gaps (FE still applies 3/6/12 trailing for presets).
    const keys =
        rangedKeys ||
        allTimeMonthKeys(
            [
                ...expertPoints,
                ...customerPoints,
                ...sessionPoints,
                ...seminarPoints,
                ...paymentPoints,
                ...refundPoints,
            ],
            now,
            tz,
        );

    return {
        experts: fillMonthlySeries(keys, expertPoints),
        customers: fillMonthlySeries(keys, customerPoints),
        sessions: fillMonthlySeries(keys, sessionPoints),
        seminars: fillMonthlySeries(keys, seminarPoints),
        payments: fillMonthlySeries(keys, paymentPoints),
        refunds: fillMonthlySeries(keys, refundPoints),
    };
}

/**
 * Runs a monthly computation in the admin time zone, falling back to UTC if the database
 * rejects that zone, so an unusual zone name can only shift bars, never break the page.
 */
export async function inZoneOrUtc<T>(tz: string, run: (zone: string) => Promise<T>): Promise<T> {
    if (tz === "UTC") return run("UTC");
    try {
        return await run(tz);
    } catch (err: any) {
        console.warn("[adminSnapshot] time zone rejected, using UTC:", tz, err?.message);
        return run("UTC");
    }
}

/** Range months; with no end, from the start (or the first data month) to now or a later data month. */
function paymentMonthKeys(
    from: Date | null,
    to: Date | null,
    points: { month: string }[],
    now: Date,
    tz: string = "UTC",
): string[] {
    if (from && to) return monthsInHalfOpenRange(from, to, tz);
    if (!from) return allTimeMonthKeys(points, now, tz);
    const latest = [...allTimeMonthKeys(points, now, tz), monthKeyInZone(now, tz)].sort().pop() as string;
    return monthKeysBetween(monthKeyInZone(from, tz), latest);
}

/** COLLECTED, COUNT and the per-month COLLECTED series for payments only (the admin Payments page). */
export async function computePaymentSnapshot(
    models: Pick<SnapshotModels, "PaymentHistory">,
    from: Date | null,
    to: Date | null,
    requestedStripeMode?: unknown,
    now: Date = new Date(),
    tz: string = "UTC",
): Promise<{
    paymentsCount: number;
    paymentsAmountByCurrency: AmountByCurrency;
    monthly: SnapshotMonthly["payments"];
}> {
    const charges = paymentCompletedMatch(createdAtFilter(from, to), paymentModeExtra(requestedStripeMode));
    const [paymentsCount, amounts, monthRows] = await Promise.all([
        models.PaymentHistory.countDocuments(charges),
        models.PaymentHistory.aggregate(keptChargesPipeline(charges, currencyGroupId)),
        models.PaymentHistory.aggregate(keptChargesPipeline(charges, monthAndCurrency(tz))),
    ]);
    const points = monthlyFromAgg(monthRows, true);
    return {
        paymentsCount,
        paymentsAmountByCurrency: amountByCurrencyFromAgg(amounts),
        monthly: fillMonthlySeries(paymentMonthKeys(from, to, points, now, tz), points),
    };
}

export async function computeSnapshotExtras(
    models: SnapshotModels,
    now: Date,
): Promise<{
    expertReviewCount: number;
    customerBlockedCount: number;
    upcomingSessions: number;
    upcomingSeminars: number;
}> {
    const upcoming = upcomingStartFilter(now);
    const sessionUpcoming = upcomingSessionFilter(now);
    const [expertReviewCount, customerBlockedCount, legacyUpcoming, groupUpcoming, upcomingSeminars] =
        await Promise.all([
            models.User.countDocuments({ role: "expert", status: "review" }),
            models.User.countDocuments({ role: "customer", status: "blocked" }),
            models.Event.countDocuments(sessionUpcoming),
            models.GroupChat.countDocuments({ ...oneToOneGroupFilter(), ...sessionUpcoming }),
            models.GroupChat.countDocuments({ ...seminarBaseFilter(), ...upcoming }),
        ]);
    return {
        expertReviewCount,
        customerBlockedCount,
        upcomingSessions: legacyUpcoming + groupUpcoming,
        upcomingSeminars,
    };
}

export type { AmountByCurrency, SnapshotModels };
