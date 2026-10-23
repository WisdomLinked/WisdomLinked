import { expertKeepCents, summarizePaymentHistory, type CommissionRates } from './paymentSummary';

/** UTC calendar month. `month` is 1–12. */
export function utcMonthRange(year: number, month: number): { start: Date; end: Date } | null {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return {
        start: new Date(Date.UTC(year, month - 1, 1)),
        end: new Date(Date.UTC(year, month, 1)),
    };
}

export function parseYearMonth(yearRaw: unknown, monthRaw: unknown): { year: number; month: number } | null {
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
    if (!utcMonthRange(year, month)) return null;
    return { year, month };
}

/** Calendar date YYYY-MM-DD, stored at UTC midnight so the day does not shift. */
export function parseChequeDate(value: unknown): Date | null {
    const text = String(value ?? '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        return null;
    }
    return date;
}

export function normalizeChequeNumber(value: unknown): string {
    return String(value ?? '').trim();
}

/** Expert net of one completed charge. A refund row is not income by itself. */
export function payrollChargeNetCents(row: any, rates?: CommissionRates): number {
    if (!row || row.paymentType === 'refund') return 0;
    if (row.status !== 'completed') return 0;
    return expertKeepCents(row, rates);
}

/**
 * A refund row from seminar leave copies the group chat id and not sessionType.
 * An unpopulated id is classified as a 1:1, so the refund would subtract in a
 * different bucket from the seminar charge. Stamp the charge's classification
 * onto the refund so the two wash in one bucket.
 */
function refundsInChargeBucket(rows: any[]): any[] {
    const chargeByIntent = new Map<string, any>();
    for (const row of rows) {
        if (row?.paymentType === 'refund' || !row?.paymentIntent) continue;
        chargeByIntent.set(String(row.paymentIntent), row);
    }
    return rows.map((row) => {
        if (row?.paymentType !== 'refund' || !row?.paymentIntent) return row;
        const charge = chargeByIntent.get(String(row.paymentIntent));
        if (!charge) return row;
        return {
            ...row,
            sessionType: charge.sessionType,
            groupChat: charge.groupChat,
            event: charge.event,
        };
    });
}

/**
 * Expert net for a set of rows in one payroll month.
 * Completed charges count. A refund row reduces that net by the expert share, once,
 * in the same bucket as its charge. A charge already marked refunded is not income,
 * and it offsets its refund row so the same money is not subtracted twice.
 */
export function payrollLiveNetCents(rows: any[], rates?: CommissionRates): number {
    const list = rows || [];
    return summarizePaymentHistory(refundsInChargeBucket(list), rates).totalReceivedCents;
}
