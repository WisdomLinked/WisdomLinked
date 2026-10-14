const PaymentHistory = require('../models/PaymentHistory');

const sweepExpiredRetryPaymentLinks = async (now: number = Date.now()): Promise<number> => {
    try {
        const result = await PaymentHistory.updateMany(
            { paymentType: 'retry', status: 'pending', linkExpiresAt: { $lte: new Date(now) } },
            { $set: { status: 'failed' } },
        );
        return result?.modifiedCount ?? 0;
    } catch (err: any) {
        console.warn('[sweepExpiredRetryPaymentLinks]', err?.message || err);
        return 0;
    }
};

export { sweepExpiredRetryPaymentLinks };
