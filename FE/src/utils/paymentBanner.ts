export type PaymentOutcome =
  | { kind: 'paid'; forWhat?: string; transactionId?: string | null }
  | { kind: 'withheld'; amount: number; deciderName?: string }
  | { kind: 'requestSent'; deciderName?: string };

const money = (amount: number): string => `$${Number(amount || 0).toFixed(2)}`;

const named = (name: string | undefined, fallback: string): string =>
  (name || '').trim() || fallback;

/**
 * Money that has not moved must never be announced as a payment. Each outcome
 * names its own state: captured funds are a payment, an authorization is
 * withheld, and a wallet request has taken nothing at all.
 */
export const paymentBannerMessage = (outcome: PaymentOutcome): string => {
  switch (outcome.kind) {
    case 'paid': {
      const headline = outcome.forWhat
        ? `Payment successful — ${outcome.forWhat}.`
        : 'Payment successful.';
      const reference = (outcome.transactionId || '').trim();
      return reference ? `${headline} Transaction ID: ${reference}` : headline;
    }

    case 'withheld':
      return `Payment withheld — ${money(outcome.amount)} is authorized on your card, not charged. ${named(
        outcome.deciderName,
        'The expert',
      )} has to accept before you are charged.`;

    case 'requestSent':
      return `Request sent for ${named(
        outcome.deciderName,
        'the expert',
      )} to accept. Nothing has been charged yet.`;

    default:
      return 'Payment successful.';
  }
};

/**
 * A free booking settles without Stripe and calls back with '0', which is a
 * sentinel rather than a transaction anyone could look up.
 */
export const stripeTransactionId = (paymentIntentId: string | null | undefined): string => {
  const id = (paymentIntentId || '').trim();
  return id && id !== '0' ? id : '';
};
