/** Stripe amounts are minor units (e.g. cents). Classify by linked group chat / event. */
export const classifyPayment = (h: any) => {
    if (h?.sessionType === "seminar" || h?.groupChat?.type === "seminar") return "seminar";
    if (h?.groupChat) return "individual";
    if (h?.event) return "individual";
    return "other";
};

export type CommissionRates = {
    seminarCommissionPercent: number;
    oneToOneCommissionPercent: number;
};

export const DEFAULT_COMMISSION_RATES: CommissionRates = {
    seminarCommissionPercent: 20,
    oneToOneCommissionPercent: 20,
};

const commissionPercentFor = (row: any, rates: CommissionRates) =>
    classifyPayment(row) === "seminar" ? rates.seminarCommissionPercent : rates.oneToOneCommissionPercent;

/**
 * What the expert keeps on one charge.
 * New rows use the stored expert net. Old rows have only `amount` (the advertised
 * price): fee and tax are 0, and the current commission for that row's type is
 * subtracted. A stored amount of 0 stays 0 — historical free payments are not
 * given a platform fee.
 */
export const expertKeepCents = (row: any, rates: CommissionRates = DEFAULT_COMMISSION_RATES) => {
    if (typeof row?.expertNetCents === "number" && Number.isFinite(row.expertNetCents)) {
        return Math.round(row.expertNetCents);
    }
    const amount = typeof row?.amount === "number" && Number.isFinite(row.amount) ? row.amount : 0;
    if (!amount) return 0;
    const commission = Math.round((amount * commissionPercentFor(row, rates)) / 100);
    return amount - commission;
};

const chargeByIntent = (histories: any[]) => {
    const map = new Map<string, any>();
    for (const row of histories || []) {
        if (row?.paymentType === "refund" || !row?.paymentIntent) continue;
        map.set(String(row.paymentIntent), row);
    }
    return map;
};

/** Expert net reversed by a refund row. Full refunds of a snapshotted charge reverse that net, not the student total. */
export const refundExpertNetCents = (
    refund: any,
    histories: any[],
    rates: CommissionRates = DEFAULT_COMMISSION_RATES,
) => {
    const paired = refund?.paymentIntent ? chargeByIntent(histories).get(String(refund.paymentIntent)) : null;
    if (paired && typeof paired.expertNetCents === "number" && Number.isFinite(paired.expertNetCents)) {
        const base = typeof paired.amount === "number" ? paired.amount : 0;
        const refunded = typeof refund?.amount === "number" ? refund.amount : 0;
        if (!(base > 0)) return 0;
        if (refunded >= base) return Math.round(paired.expertNetCents);
        return Math.round((paired.expertNetCents * refunded) / base);
    }
    return expertKeepCents(refund, rates);
};

export const expertDisplayCents = (
    row: any,
    histories: any[],
    rates: CommissionRates = DEFAULT_COMMISSION_RATES,
) => (row?.paymentType === "refund" ? refundExpertNetCents(row, histories, rates) : expertKeepCents(row, rates));

type Bucket = { completed: number; refunds: number; legacyRefunded: number };

const emptyBucket = (): Bucket => ({ completed: 0, refunds: 0, legacyRefunded: 0 });

/**
 * Net cents for one bucket.
 * - Completed non-refund rows count as positive.
 * - Refund rows (status completed or refunded) count as negative.
 * - Refunded charges are ignored as income, but still wash against refunded
 *   refund rows so the legacy both-refunded shape nets to 0.
 */
const netBucket = (b: Bucket) => b.completed - Math.max(0, b.refunds - b.legacyRefunded);

export const summarizePaymentHistory = (histories: any[], rates: CommissionRates = DEFAULT_COMMISSION_RATES) => {
    const individual = emptyBucket();
    const seminars = emptyBucket();
    const other = emptyBucket();
    const list = histories || [];

    for (const h of list) {
        const isRefund = h?.paymentType === "refund";
        const raw = isRefund ? refundExpertNetCents(h, list, rates) : expertKeepCents(h, rates);
        const cat = classifyPayment(h);
        const bucket = cat === "seminar" ? seminars : cat === "individual" ? individual : other;

        if (isRefund) {
            if (h?.status === "completed" || h?.status === "refunded") {
                bucket.refunds += raw;
            }
            continue;
        }

        if (h?.status === "completed") {
            bucket.completed += raw;
        } else if (h?.status === "refunded") {
            // Legacy flipped charges: not income, but offset matching refund rows.
            bucket.legacyRefunded += raw;
        }
    }

    const individualSessionsCents = netBucket(individual);
    const seminarsCents = netBucket(seminars);
    const otherCents = netBucket(other);

    return {
        totalReceivedCents: individualSessionsCents + seminarsCents + otherCents,
        individualSessionsCents,
        seminarsCents,
        otherCents,
    };
};
