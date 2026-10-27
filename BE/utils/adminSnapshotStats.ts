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
    paymentCompletedMatch,
    paymentCountMatch,
    refundMatch,
    oneToOneGroupFilter,
    seminarBaseFilter,
    sumMonthCountRows,
    upcomingSessionFilter,
    upcomingStartFilter,
    currencyGroupId,
} from "./adminSnapshot";

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

const COMPLETED_AMOUNT = {
    $sum: {
        $cond: [
            { $eq: ["$status", "completed"] },
            { $ifNull: ["$amount", 0] },
            0,
        ],
    },
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

function monthPaymentPipeline(match: Record<string, unknown>, completedOnlyAmount: boolean) {
    return [
        { $match: match },
        {
            $group: {
                _id: { month: MONTH_GROUP_CREATED, currency: currencyGroupId },
                count: { $sum: 1 },
                amount: completedOnlyAmount
                    ? COMPLETED_AMOUNT
                    : { $sum: { $ifNull: ["$amount", 0] } },
            },
        },
    ];
}

export async function computePeriodSnapshot(
    models: SnapshotModels,
    from: Date | null,
    to: Date | null,
    now: Date,
): Promise<SnapshotPeriodCounts> {
    const createdAt = createdAtFilter(from, to);
    const held = heldStartFilter(from, to, now);
    const seminarHeld = { ...seminarBaseFilter(), ...held };
    const sessionHeld = heldSessionFilter(from, to, now);
    const cancelled = cancelledSessionFilter(from, to, now);
    const refunds = refundMatch(createdAt);

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
        models.PaymentHistory.countDocuments(paymentCountMatch(createdAt)),
        models.PaymentHistory.countDocuments(refunds),
        models.PaymentHistory.aggregate(currencyAmountPipeline(paymentCompletedMatch(createdAt))),
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

    return {
        expertsJoined,
        customersJoined,
        sessionsHeld: legacySessionsHeld + groupSessionsHeld,
        seminarsHeld,
        paymentsCount,
        refundsCount,
        paymentsAmountByCurrency: amountByCurrencyFromAgg(paymentAmounts),
        refundsAmountByCurrency: amountByCurrencyFromAgg(refundAmounts),
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
): Promise<SnapshotMonthly> {
    const createdAt = createdAtFilter(from, to);
    const held = heldStartFilter(from, to, now);
    const seminarHeld = { ...seminarBaseFilter(), ...held };
    const sessionHeld = heldSessionFilter(from, to, now);
    const keys = from && to ? monthsInRange(from, to) : null;

    const [experts, customers, legacySessions, groupSessions, seminars, payments, refunds] = await Promise.all([
        models.User.aggregate(monthCountPipeline({ role: "expert", ...createdAt }, MONTH_GROUP_CREATED)),
        models.User.aggregate(monthCountPipeline({ role: "customer", ...createdAt }, MONTH_GROUP_CREATED)),
        models.Event.aggregate(monthCountPipeline(sessionHeld, MONTH_GROUP_START)),
        models.GroupChat.aggregate(monthCountPipeline({ ...oneToOneGroupFilter(), ...sessionHeld }, MONTH_GROUP_START)),
        models.GroupChat.aggregate(monthCountPipeline(seminarHeld, MONTH_GROUP_START)),
        models.PaymentHistory.aggregate(monthPaymentPipeline(paymentCountMatch(createdAt), true)),
        models.PaymentHistory.aggregate(monthPaymentPipeline(refundMatch(createdAt), false)),
    ]);

    const mapCounts = (rows: any[], withAmounts: boolean): SnapshotMonthly["experts"] => {
        const points = monthlyFromAgg(rows, withAmounts);
        return keys ? fillMonthlySeries(keys, points) : points;
    };

    return {
        experts: mapCounts(experts, false),
        customers: mapCounts(customers, false),
        sessions: mapCounts(sumMonthCountRows(legacySessions, groupSessions), false),
        seminars: mapCounts(seminars, false),
        payments: mapCounts(payments, true),
        refunds: mapCounts(refunds, true),
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
