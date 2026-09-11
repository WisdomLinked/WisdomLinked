/** Stripe amounts are minor units (e.g. cents). Classify by linked group chat / event. */
export const classifyPayment = (h: any) => {
    if (h?.groupChat?.type === "seminar") return "seminar";
    if (h?.groupChat) return "individual";
    if (h?.event) return "individual";
    return "other";
};

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

export const summarizePaymentHistory = (histories: any[]) => {
    const individual = emptyBucket();
    const seminars = emptyBucket();
    const other = emptyBucket();

    for (const h of histories || []) {
        const raw = typeof h?.amount === "number" ? h.amount : 0;
        const isRefund = h?.paymentType === "refund";
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
