/** Stripe amounts are minor units (e.g. cents). Classify by linked group chat / event. */
export const classifyPayment = (h: any) => {
    if (h?.groupChat?.type === "seminar") return "seminar";
    if (h?.groupChat) return "individual";
    if (h?.event) return "individual";
    return "other";
};

const signedAmount = (h: any) => {
    const raw = typeof h?.amount === "number" ? h.amount : 0;
    return h?.paymentType === "refund" ? -raw : raw;
};

export const summarizePaymentHistory = (histories: any[]) => {
    let individualSessionsCents = 0;
    let seminarsCents = 0;
    let otherCents = 0;

    for (const h of histories || []) {
        if (h?.status !== "completed") continue;
        const amt = signedAmount(h);
        const cat = classifyPayment(h);
        if (cat === "seminar") seminarsCents += amt;
        else if (cat === "individual") individualSessionsCents += amt;
        else otherCents += amt;
    }

    return {
        totalReceivedCents: individualSessionsCents + seminarsCents + otherCents,
        individualSessionsCents,
        seminarsCents,
        otherCents,
    };
};
