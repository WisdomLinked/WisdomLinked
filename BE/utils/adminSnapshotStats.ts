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
    monthsInRange,
    MONTH_GROUP_CREATED,
    MONTH_GROUP_START,
    netAmountsByCurrency,
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

function paymentModeExtra(requestedMode?: unknown): Record<string, unknown> {
    return stripeModeMatch(requestedMode);
}

function netMonthlyPayments(
    chargeRows: any[],
    refundRows: any[],
): ReturnType<typeof monthlyFromAgg> {
    const charges = monthlyFromAgg(chargeRows, true);
    const refunds = monthlyFromAgg(refundRows, true);
    const refundByMonth = new Map(refunds.map((p) => [p.month, p]));
    return charges.map((point) => {
        const refund = refundByMonth.get(point.month);
        if (!refund?.amountsByCurrency) return point;
        return {
            ...point,
            amountsByCurrency: netAmountsByCurrency(
                point.amountsByCurrency || {},
                refund.amountsByCurrency,
            ),
        };
    });
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
        models.PaymentHistory.aggregate(currencyAmountPipeline(charges)),
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

    const gross = amountByCurrencyFromAgg(paymentAmounts);
    const refunded = amountByCurrencyFromAgg(refundAmounts);

    return {
        expertsJoined,
        customersJoined,
        sessionsHeld: legacySessionsHeld + groupSessionsHeld,
        seminarsHeld,
        paymentsCount,
        refundsCount,
        paymentsAmountByCurrency: netAmountsByCurrency(gross, refunded),
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
    const keys = from && to ? monthsInRange(from, to) : null;
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
            models.PaymentHistory.aggregate(monthPaymentPipeline(charges)),
            models.PaymentHistory.aggregate(monthPaymentPipeline(refunds)),
        ]);

    const mapCounts = (rows: any[], withAmounts: boolean): SnapshotMonthly["experts"] => {
        const points = monthlyFromAgg(rows, withAmounts);
        return keys ? fillMonthlySeries(keys, points) : points;
    };

    const paymentPoints = netMonthlyPayments(paymentRows, refundRows);

    return {
        experts: mapCounts(experts, false),
        customers: mapCounts(customers, false),
        sessions: mapCounts(sumMonthCountRows(legacySessions, groupSessions), false),
        seminars: mapCounts(seminars, false),
        payments: keys ? fillMonthlySeries(keys, paymentPoints) : paymentPoints,
        refunds: mapCounts(refundRows, true),
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
