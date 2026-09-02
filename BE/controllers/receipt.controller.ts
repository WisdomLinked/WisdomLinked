import { Response } from 'express';
import { safeErrorMessage } from '../utils/httpUserFacingCopy';

const PaymentHistory = require("../models/PaymentHistory");
const { checkPaymentIntentSucceeded } = require("./stripe.controller");

const SESSION_TYPE_LABEL: Record<string, string> = {
    seminar: 'Seminar',
    individual: '1:1 Session',
    community: 'Community session',
};

const paymentMethodLabel = (intent: any): string => {
    const types: string[] = Array.isArray(intent?.payment_method_types) ? intent.payment_method_types : [];
    if (types.includes('wechat_pay')) return 'WeChat Pay';
    if (types.includes('alipay')) return 'Alipay';
    if (types.includes('card')) return 'Credit card';
    return '';
};

const cardFromIntent = (intent: any): { brand: string; last4: string } | null => {
    const charge = intent?.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    const card = charge?.payment_method_details?.card;
    if (!card?.brand || !card?.last4) return null;
    return { brand: String(card.brand), last4: String(card.last4) };
};

const viewerMaySee = (row: any, userId: string, role: string): boolean => {
    const me = String(userId || '');
    if (!me) return false;
    if (String(role || '').toLowerCase() === 'admin') return true;
    return String(row?.customer?._id ?? row?.customer ?? '') === me
        || String(row?.expert?._id ?? row?.expert ?? '') === me;
};

/**
 * GET /api/receipt/:paymentId
 *
 * The WisdomLinked receipt for one payment, shaped for the receipt page. Everything
 * but the card brand comes from our own records; the brand and last four live only on
 * the Stripe charge, so they are fetched on first view and cached onto the row.
 */
export const getReceipt = async (req: any, res: Response) => {
    try {
        const { userId, role } = req.user;
        const paymentId = String(req.params?.paymentId ?? '');
        if (paymentId.length !== 24) {
            return res.status(400).send("Sorry, that is not a valid receipt reference.");
        }

        const row = await PaymentHistory.findById(paymentId)
            .populate("customer", "username email")
            .populate("expert", "username email title")
            .populate("groupChat", "name type start duration timezone")
            .populate("event", "title start duration");

        if (!row) {
            return res.status(404).send("We could not find that receipt.");
        }
        if (!viewerMaySee(row, userId, role)) {
            return res.status(403).send("This receipt belongs to someone else.");
        }

        let card = row.cardBrand && row.cardLast4
            ? { brand: row.cardBrand, last4: row.cardLast4 }
            : null;
        let method = '';

        // A refunded or still-pending row is just as real a receipt; the live lookup is
        // only ever for presentation, so a failure here must not fail the page.
        if (row.paymentIntent) {
            const intent = await checkPaymentIntentSucceeded(row.paymentIntent, row.stripeMode);
            if (intent) {
                method = paymentMethodLabel(intent);
                const live = cardFromIntent(intent);
                if (live && !card) {
                    card = live;
                    PaymentHistory.updateOne(
                        { _id: row._id },
                        { $set: { cardBrand: live.brand, cardLast4: live.last4 } },
                    ).catch(() => null);
                }
            }
        }
        if (!method) method = card ? 'Credit card' : '';

        const session = row.groupChat || null;
        const event = row.event || null;

        return res.status(200).json({
            success: true,
            receipt: {
                id: String(row._id),
                receiptNumber: row.receiptNumber || null,
                status: row.status || 'completed',
                paymentType: row.paymentType || 'charge',
                amount: row.amount ?? 0,
                currency: row.currency || 'usd',
                paidAt: row.createdAt,
                description: row.description || '',
                paymentMethod: method,
                card,
                transactionId: row.paymentIntent || null,
                balanceTransaction: row.balanceTransaction || null,
                stripeReceiptUrl: row.receiptUrl || null,
                session: {
                    name: session?.name || event?.title || row.description || 'Session',
                    typeLabel: SESSION_TYPE_LABEL[String(session?.type || '')] || (event ? '1:1 Session' : ''),
                    durationMinutes: session?.duration ?? event?.duration ?? null,
                    start: session?.start ?? event?.start ?? null,
                    timezone: session?.timezone || null,
                },
                expert: row.expert
                    ? { name: row.expert.username || '', title: row.expert.title || '' }
                    : null,
                student: row.customer
                    ? { name: row.customer.username || '', email: row.customer.email || '' }
                    : null,
            },
        });
    } catch (err: any) {
        console.log('[getReceipt]', err?.message);
        return res.status(500).send(safeErrorMessage(err));
    }
};

module.exports = { getReceipt };
