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
    monthKeyUTC,
    monthsInRange,
    monthsInHalfOpenRange,
    MONTH_GROUP_CREATED,
    MONTH_GROUP_START,
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

function monthPaymentPipeline(match: Record<string, unknown>) {
    return [
        { $match: match },
        {
            $group: {
                _id: { month: MONTH_GROUP_CREATED, currency: currencyGroupId },
                count: { $sum: 1 },
                amount: { $sum: { $ifNull: ["$amount", 0] } },
            },
        },
    ];
}

const MONTH_AND_CURRENCY = { month: MONTH_GROUP_CREATED, currency: currencyGroupId };

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
): Promise<SnapshotMonthly> {
    const createdAt = createdAtFilter(from, to);
    const mode = paymentModeExtra(requestedStripeMode);
    const held = heldStartFilter(from, to, now);
    const seminarHeld = { ...seminarBaseFilter(), ...held };
    const sessionHeld = heldSessionFilter(from, to, now);
    const keys = from && to ? monthsInHalfOpenRange(from, to) : null;
    const charges = paymentCompletedMatch(createdAt, mode);
    const refunds = refundMatch(createdAt, mode);

    const [experts, customers, legacySessions, groupSessions, seminars, paymentRows, refundRows] =
        await Promise.all([
            models.User.aggregate(monthCountPipeline({ role: "expert", ...createdAt }, MONTH_GROUP_CREATED)),
            models.User.aggregate(monthCountPipeline({ role: "customer", ...createdAt }, MONTH_GROUP_CREATED)),
            models.Event.aggregate(monthCountPipeline(sessionHeld, MONTH_GROUP_START)),
            models.GroupChat.aggregate(
                monthCountPipeline({ ...oneToOneGroupFilter(), ...sessionHeld }, MONTH_GROUP_START),
            ),
            models.GroupChat.aggregate(monthCountPipeline(seminarHeld, MONTH_GROUP_START)),
            models.PaymentHistory.aggregate(keptChargesPipeline(charges, MONTH_AND_CURRENCY)),
            models.PaymentHistory.aggregate(monthPaymentPipeline(refunds)),
        ]);

    const mapCounts = (rows: any[], withAmounts: boolean): SnapshotMonthly["experts"] => {
        const points = monthlyFromAgg(rows, withAmounts);
        return fillMonthlySeries(keys || allTimeMonthKeys(points, now), points);
    };

    const paymentPoints = monthlyFromAgg(paymentRows, true);

    return {
        experts: mapCounts(experts, false),
        customers: mapCounts(customers, false),
        sessions: mapCounts(sumMonthCountRows(legacySessions, groupSessions), false),
        seminars: mapCounts(seminars, false),
        payments: fillMonthlySeries(keys || allTimeMonthKeys(paymentPoints, now), paymentPoints),
        refunds: mapCounts(refundRows, true),
    };
}

/** Range months; with no end, from the start (or the first data month) to now or a later data month. */
function paymentMonthKeys(from: Date | null, to: Date | null, points: { month: string }[], now: Date): string[] {
    if (from && to) return monthsInHalfOpenRange(from, to);
    if (!from) return allTimeMonthKeys(points, now);
    const latest = [...allTimeMonthKeys(points, now), monthKeyUTC(now)].sort().pop() as string;
    const [y, m] = latest.split("-").map(Number);
    return monthsInRange(from, new Date(Date.UTC(y, m - 1, 1)));
}

/** COLLECTED, COUNT and the per-month COLLECTED series for payments only (the admin Payments page). */
export async function computePaymentSnapshot(
    models: Pick<SnapshotModels, "PaymentHistory">,
    from: Date | null,
    to: Date | null,
    requestedStripeMode?: unknown,
    now: Date = new Date(),
): Promise<{
    paymentsCount: number;
    paymentsAmountByCurrency: AmountByCurrency;
    monthly: SnapshotMonthly["payments"];
}> {
    const charges = paymentCompletedMatch(createdAtFilter(from, to), paymentModeExtra(requestedStripeMode));
    const [paymentsCount, amounts, monthRows] = await Promise.all([
        models.PaymentHistory.countDocuments(charges),
        models.PaymentHistory.aggregate(keptChargesPipeline(charges, currencyGroupId)),
        models.PaymentHistory.aggregate(keptChargesPipeline(charges, MONTH_AND_CURRENCY)),
    ]);
    const points = monthlyFromAgg(monthRows, true);
    return {
        paymentsCount,
        paymentsAmountByCurrency: amountByCurrencyFromAgg(amounts),
        monthly: fillMonthlySeries(paymentMonthKeys(from, to, points, now), points),
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
