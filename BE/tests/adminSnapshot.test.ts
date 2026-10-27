import test from "node:test";
import assert from "node:assert/strict";
import {
    MIN_VALID_DATE,
    SYSTEM_CHAT_NAMES,
    amountByCurrencyFromAgg,
    cancelledSessionFilter,
    changePct,
    changePctByCurrency,
    createdAtFilter,
    fillMonthlySeries,
    heldSessionFilter,
    heldStartFilter,
    isValidRecordDate,
    monthKeyUTC,
    monthlyFromAgg,
    monthsInRange,
    oneToOneGroupFilter,
    parseDateParam,
    periodChange,
    resolveSnapshotRange,
    seminarBaseFilter,
    startInRangeFilter,
    statusListFilter,
    sumMonthCountRows,
    upcomingSessionFilter,
    upcomingStartFilter,
    clampPage,
    clampPageSize,
} from "../utils/adminSnapshot";
import {
    computeMonthlyBreakdown,
    computePeriodSnapshot,
    computeSnapshotExtras,
} from "../utils/adminSnapshotStats";

test("parseDateParam rejects empty and invalid values", () => {
    assert.equal(parseDateParam(null), null);
    assert.equal(parseDateParam(""), null);
    assert.equal(parseDateParam("not-a-date"), null);
    assert.ok(parseDateParam("2026-04-01T00:00:00.000Z") instanceof Date);
});

test("epoch and missing dates are not valid record dates", () => {
    assert.equal(isValidRecordDate(null), false);
    assert.equal(isValidRecordDate("1970-01-01T00:00:00.000Z"), false);
    assert.equal(isValidRecordDate(0), false);
    assert.equal(isValidRecordDate("2026-01-15T12:00:00.000Z"), true);
    assert.ok(MIN_VALID_DATE.getUTCFullYear() === 1971);
});

test("resolveSnapshotRange with no bounds is all-time and has no previous window", () => {
    const r = resolveSnapshotRange(undefined, undefined, new Date("2026-10-21T00:00:00.000Z"));
    assert.equal(r.isAllTime, true);
    assert.equal(r.from, null);
    assert.equal(r.previousFrom, null);
});

test("resolveSnapshotRange previous window is the same length immediately before from", () => {
    const from = "2026-04-21T00:00:00.000Z";
    const to = "2026-10-21T00:00:00.000Z";
    const r = resolveSnapshotRange(from, to);
    assert.equal(r.isAllTime, false);
    assert.equal(r.from?.toISOString(), from);
    assert.equal(r.to?.toISOString(), to);
    assert.equal(r.previousTo?.toISOString(), from);
    const ms = Date.parse(to) - Date.parse(from);
    assert.equal(r.previousFrom?.getTime(), Date.parse(from) - ms);
});

test("createdAtFilter always excludes epoch dates", () => {
    const all = createdAtFilter(null, null);
    assert.equal(all.createdAt.$gte.toISOString(), MIN_VALID_DATE.toISOString());
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-10-01T00:00:00.000Z");
    const ranged = createdAtFilter(from, to);
    assert.equal(ranged.createdAt.$gte.toISOString(), from.toISOString());
    assert.equal(ranged.createdAt.$lt.toISOString(), to.toISOString());
});

test("heldStartFilter requires valid start before now and inside the range", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const from = new Date("2026-04-21T00:00:00.000Z");
    const to = new Date("2026-10-21T00:00:00.000Z");
    const f = heldStartFilter(from, to, now) as { start: { $gte: Date; $lt: Date } };
    assert.equal(f.start.$gte.toISOString(), from.toISOString());
    assert.equal(f.start.$lt.toISOString(), now.toISOString());
});

test("heldStartFilter caps the end bound at now so future range ends do not count as held", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-12-01T00:00:00.000Z");
    const f = heldStartFilter(from, to, now) as { start: { $gte: Date; $lt: Date } };
    assert.equal(f.start.$lt.toISOString(), now.toISOString());
});

test("startInRangeFilter does not cap at now", () => {
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-12-01T00:00:00.000Z");
    const f = startInRangeFilter(from, to);
    assert.equal(f.start.$gte.toISOString(), from.toISOString());
    assert.equal(f.start.$lt.toISOString(), to.toISOString());
});

test("upcomingStartFilter uses start >= now and excludes epoch", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const f = upcomingStartFilter(now) as { start: { $gte: Date } };
    assert.equal(f.start.$gte.toISOString(), now.toISOString());
});

test("seminar lists and counts exclude Global Chat and Admin", () => {
    const f = seminarBaseFilter() as { type: string; name: { $nin: string[] } };
    assert.equal(f.type, "seminar");
    assert.deepEqual(f.name.$nin, ["Global Chat", "Admin"]);
    assert.deepEqual([...SYSTEM_CHAT_NAMES], ["Global Chat", "Admin"]);
});

test("cancelled sessions use declined/cancelled inside the held window", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const f = cancelledSessionFilter(null, null, now) as { status: { $in: string[] } };
    assert.ok(f.status.$in.includes("cancelled"));
    assert.ok(f.status.$in.includes("declined"));
});

test("held 1:1 sessions are inside the held window and not cancelled or declined", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const from = new Date("2026-07-21T00:00:00.000Z");
    const f = heldSessionFilter(from, now, now) as { start: unknown; status: { $nin: string[] } };
    assert.deepEqual(f.start, heldStartFilter(from, now, now).start);
    assert.deepEqual(f.status.$nin, ["cancelled", "canceled", "declined"]);
});

test("upcoming 1:1 sessions start from now and are not cancelled or declined", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const f = upcomingSessionFilter(now) as { start: { $gte: Date }; status: { $nin: string[] } };
    assert.equal(f.start.$gte.toISOString(), now.toISOString());
    assert.deepEqual(f.status.$nin, ["cancelled", "canceled", "declined"]);
});

test("statusListFilter takes one status or a comma-separated list", () => {
    assert.equal(statusListFilter(undefined), null);
    assert.equal(statusListFilter(""), null);
    assert.equal(statusListFilter(" , "), null);
    assert.deepEqual(statusListFilter("pending"), { status: "pending" });
    assert.deepEqual(statusListFilter("accepted,active"), { status: { $in: ["accepted", "active"] } });
    assert.deepEqual(statusListFilter("cancelled, declined,"), { status: { $in: ["cancelled", "declined"] } });
});

test("today's 1:1s are individual group chats", () => {
    assert.deepEqual(oneToOneGroupFilter(), { type: "individual" });
});

test("sumMonthCountRows adds months across collections and sorts them", () => {
    assert.deepEqual(
        sumMonthCountRows(
            [{ _id: "2026-05", count: 1 }, { _id: "2026-07", count: 2 }],
            [{ _id: "2026-05", count: 3 }, { _id: "2026-06", count: 1 }],
            [],
        ),
        [
            { _id: "2026-05", count: 4 },
            { _id: "2026-06", count: 1 },
            { _id: "2026-07", count: 2 },
        ],
    );
    assert.deepEqual(sumMonthCountRows([{ _id: null as unknown as string, count: 5 }]), []);
});

test("monthsInRange lists inclusive UTC month keys", () => {
    assert.deepEqual(
        monthsInRange(new Date("2026-04-21T00:00:00.000Z"), new Date("2026-07-01T00:00:00.000Z")),
        ["2026-04", "2026-05", "2026-06", "2026-07"],
    );
    assert.equal(monthKeyUTC(new Date("2026-01-31T23:00:00.000Z")), "2026-01");
});

test("fillMonthlySeries inserts zero months", () => {
    const filled = fillMonthlySeries(["2026-01", "2026-02", "2026-03"], [
        { month: "2026-02", count: 4 },
    ]);
    assert.deepEqual(filled.map((p) => p.count), [0, 4, 0]);
});

test("changePct treats a zero previous as 100 when current is positive", () => {
    assert.equal(changePct(10, 5), 100);
    assert.equal(changePct(0, 0), 0);
    assert.equal(changePct(8, 0), 100);
    assert.equal(changePct(5, 10), -50);
});

test("amounts are never summed across currencies", () => {
    const amounts = amountByCurrencyFromAgg([
        { _id: "usd", amount: 5000 },
        { _id: "CAD", amount: 2000 },
        { _id: "usd", amount: 1500 },
    ]);
    assert.equal(amounts.usd, 6500);
    assert.equal(amounts.cad, 2000);
    const pct = changePctByCurrency({ usd: 200, cad: 50 }, { usd: 100, cad: 100 });
    assert.equal(pct.usd, 100);
    assert.equal(pct.cad, -50);
});

test("monthlyFromAgg keeps payment amounts per currency per month", () => {
    const points = monthlyFromAgg(
        [
            { _id: { month: "2026-04", currency: "usd" }, count: 2, amount: 4000 },
            { _id: { month: "2026-04", currency: "eur" }, count: 1, amount: 1000 },
        ],
        true,
    );
    assert.equal(points.length, 1);
    assert.equal(points[0].count, 3);
    assert.deepEqual(points[0].amountsByCurrency, { usd: 4000, eur: 1000 });
});

test("periodChange uses the same formula for each metric", () => {
    const change = periodChange(
        {
            expertsJoined: 12,
            customersJoined: 0,
            sessionsHeld: 4,
            seminarsHeld: 1,
            paymentsCount: 3,
            refundsCount: 1,
            paymentsAmountByCurrency: { usd: 3000 },
            refundsAmountByCurrency: {},
            sessionsCancelled: 0,
            seminarsAttendees: 0,
            refundsUnlinked: 0,
        },
        {
            expertsJoined: 8,
            customersJoined: 0,
            sessionsHeld: 8,
            seminarsHeld: 0,
            paymentsCount: 3,
            refundsCount: 2,
            paymentsAmountByCurrency: { usd: 1000 },
            refundsAmountByCurrency: {},
            sessionsCancelled: 0,
            seminarsAttendees: 0,
            refundsUnlinked: 0,
        },
    );
    assert.equal(change.expertsJoined, 50);
    assert.equal(change.customersJoined, 0);
    assert.equal(change.sessionsHeld, -50);
    assert.equal(change.seminarsHeld, 100);
    assert.equal(change.refundsCount, -50);
    assert.deepEqual(change.paymentsAmountByCurrency, { usd: 200 });
});

test("clampPage and clampPageSize reject NaN and cap the page size", () => {
    assert.equal(clampPage(undefined), 0);
    assert.equal(clampPage(-2), 0);
    assert.equal(clampPage("3"), 3);
    assert.equal(clampPageSize(undefined), 50);
    assert.equal(clampPageSize(1000), 100);
    assert.equal(clampPageSize(25), 25);
});

function stubModels(opts: {
    counts?: Record<string, number>;
    aggregates?: Record<string, any[]>;
}) {
    const counts = opts.counts || {};
    const aggregates = opts.aggregates || {};
    const keyOf = (filter: any) => JSON.stringify(filter);
    const countDocuments = async (filter: any) => counts[keyOf(filter)] ?? counts["*"] ?? 0;
    const aggregate = async (pipeline: any[]) => {
        const match = pipeline?.[0]?.$match;
        return aggregates[keyOf(match)] || aggregates["*"] || [];
    };
    const model = { countDocuments, aggregate };
    return { User: model, Event: model, GroupChat: model, PaymentHistory: model };
}

test("computePeriodSnapshot maps counts and per-currency amounts", async () => {
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-10-01T00:00:00.000Z");
    const now = new Date("2026-10-01T00:00:00.000Z");
    const createdAt = createdAtFilter(from, to);
    const held = heldStartFilter(from, to, now);
    const sessionHeld = heldSessionFilter(from, to, now);
    const cancelled = cancelledSessionFilter(from, to, now);
    const models = stubModels({
        counts: {
            [JSON.stringify({ role: "expert", ...createdAt })]: 4,
            [JSON.stringify({ role: "customer", ...createdAt })]: 9,
            [JSON.stringify(sessionHeld)]: 3,
            [JSON.stringify({ ...oneToOneGroupFilter(), ...sessionHeld })]: 2,
            [JSON.stringify({ ...seminarBaseFilter(), ...held })]: 2,
            [JSON.stringify({ paymentType: { $ne: "refund" }, ...createdAt })]: 7,
            [JSON.stringify({ paymentType: "refund", ...createdAt })]: 1,
            [JSON.stringify(cancelled)]: 1,
            [JSON.stringify({ ...oneToOneGroupFilter(), ...cancelled })]: 2,
            [JSON.stringify({
                paymentType: "refund",
                ...createdAt,
                $and: [
                    { $or: [{ customer: { $exists: false } }, { customer: null }] },
                    { $or: [{ expert: { $exists: false } }, { expert: null }] },
                ],
            })]: 1,
        },
        aggregates: {
            [JSON.stringify({ paymentType: { $ne: "refund" }, status: "completed", ...createdAt })]: [
                { _id: "usd", amount: 12000 },
                { _id: "eur", amount: 4000 },
            ],
            [JSON.stringify({ paymentType: "refund", ...createdAt })]: [{ _id: "usd", amount: 2000 }],
            [JSON.stringify({ ...seminarBaseFilter(), ...held })]: [{ _id: null, attendees: 11 }],
        },
    });
    const period = await computePeriodSnapshot(models, from, to, now);
    assert.equal(period.expertsJoined, 4);
    assert.equal(period.customersJoined, 9);
    assert.equal(period.sessionsHeld, 5);
    assert.equal(period.seminarsHeld, 2);
    assert.equal(period.paymentsCount, 7);
    assert.equal(period.refundsCount, 1);
    assert.deepEqual(period.paymentsAmountByCurrency, { usd: 12000, eur: 4000 });
    assert.deepEqual(period.refundsAmountByCurrency, { usd: 2000 });
    assert.equal(period.sessionsCancelled, 3);
    assert.equal(period.seminarsAttendees, 11);
    assert.equal(period.refundsUnlinked, 1);
});

test("computeMonthlyBreakdown fills every month in the range", async () => {
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-06-01T00:00:00.000Z");
    const now = to;
    const models = {
        User: {
            countDocuments: async () => 0,
            aggregate: async () => [{ _id: "2026-05", count: 3 }],
        },
        Event: { countDocuments: async () => 0, aggregate: async () => [] },
        GroupChat: { countDocuments: async () => 0, aggregate: async () => [] },
        PaymentHistory: {
            countDocuments: async () => 0,
            aggregate: async () => [
                { _id: { month: "2026-04", currency: "usd" }, count: 1, amount: 500 },
            ],
        },
    };
    const monthly = await computeMonthlyBreakdown(models, from, to, now);
    assert.deepEqual(monthly.experts.map((p) => p.month), ["2026-04", "2026-05", "2026-06"]);
    assert.deepEqual(monthly.experts.map((p) => p.count), [0, 3, 0]);
    assert.equal(monthly.payments[0].amountsByCurrency?.usd, 500);
});

test("computeMonthlyBreakdown counts older and today's 1:1s together, not seminars", async () => {
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-06-01T00:00:00.000Z");
    const none = { countDocuments: async () => 0, aggregate: async () => [] };
    const models = {
        User: none,
        PaymentHistory: none,
        Event: { countDocuments: async () => 0, aggregate: async () => [{ _id: "2026-04", count: 1 }] },
        GroupChat: {
            countDocuments: async () => 0,
            aggregate: async (pipeline: any[]) => pipeline[0].$match.type === "individual"
                ? [{ _id: "2026-04", count: 2 }, { _id: "2026-05", count: 1 }]
                : [{ _id: "2026-06", count: 9 }],
        },
    };
    const monthly = await computeMonthlyBreakdown(models, from, to, to);
    assert.deepEqual(monthly.sessions.map((p) => p.count), [3, 1, 0]);
    assert.deepEqual(monthly.seminars.map((p) => p.count), [0, 0, 9]);
});

test("computeSnapshotExtras counts review, blocked, and upcoming (both kinds of 1:1) from start >= now", async () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const upcoming = upcomingStartFilter(now);
    const sessionUpcoming = upcomingSessionFilter(now);
    const models = stubModels({
        counts: {
            [JSON.stringify({ role: "expert", status: "review" })]: 2,
            [JSON.stringify({ role: "customer", status: "blocked" })]: 3,
            [JSON.stringify(sessionUpcoming)]: 4,
            [JSON.stringify({ ...oneToOneGroupFilter(), ...sessionUpcoming })]: 2,
            [JSON.stringify({ ...seminarBaseFilter(), ...upcoming })]: 1,
        },
    });
    const extras = await computeSnapshotExtras(models, now);
    assert.equal(extras.expertReviewCount, 2);
    assert.equal(extras.customerBlockedCount, 3);
    assert.equal(extras.upcomingSessions, 6);
    assert.equal(extras.upcomingSeminars, 1);
});
