import React, { useEffect, useState, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { createStripePaymentIntent, getStripeMode } from '../../api/api';
import { persistPendingDetails } from '../../utils/safeLocalStorage';
import FormAlert from '../FormAlert';
import { SetLoadingStatus } from '../../actions/appActions';


/** A 1:1 session booking (createGroupChatByUser path). */
export type StudentOneToOnePendingDetails = {
  name: string;
  description?: string;
  services?: string[];
  purposeOther?: string;
  start: string | Date;
  end: string | Date;

  duration: number;
  price: number;
  expert: string;
};

/** A seminar seat (registerForSeminar path), identified by groupChatId. */
export type StudentSeminarPendingDetails = {
  groupChatId: string;
  price: number;
  name?: string;
};

/** Accepting (paying for) an expert-proposed 1:1, identified by groupChatId. */
export type StudentAcceptOneToOnePendingDetails = {
  kind: 'accept-1to1';
  groupChatId: string;
  price: number;
  name?: string;
};

export type StudentSeatPaymentPendingDetails = {
  kind: 'pay-seat-request';
  requestId: string;
  groupChatId: string;
  price: number;
  name?: string;
};

export type StudentBookingPendingDetails =
  | StudentOneToOnePendingDetails
  | StudentSeminarPendingDetails
  | StudentAcceptOneToOnePendingDetails
  | StudentSeatPaymentPendingDetails;

export type PaymentMode = 'card' | 'wallet';


export type WalletOption =
  // `only` pins the checkout to the wallet: a booking requested through the wallet path
  // skipped the card hold, so the server will not let it settle by card either.
  | { kind: 'charge'; only?: boolean }
  | { kind: 'request'; onSubmit: () => void | Promise<void>; submitLabel?: string; note?: string };

type CheckoutFormProps = {
  pendingDetails: StudentBookingPendingDetails;
  stripeMode: string;
  price: number;
  returnUrl: string;
  isSeatRequest?: boolean;
  paymentMode?: PaymentMode;
  onPaymentSuccess: (paymentIntentId: string, opts?: { requiresApproval?: boolean }) => void;
  policyNotice?: BookingPolicyNotice;
};

export type BookingPolicyNotice = {
  message: string;
  acknowledgeLabel: string;
};

const WALLET_METHOD_NAMES: Record<string, string> = {
  wechat_pay: 'WeChat Pay',
  alipay: 'Alipay',
};

export const payButtonLabel = (
  price: number,
  paymentMode: PaymentMode,
  selectedMethod: string,
): string => {
  if (paymentMode !== 'wallet') return `Pay $${price}`;
  const name = WALLET_METHOD_NAMES[selectedMethod];
  return name ? `Pay $${price} with ${name}` : `Pay $${price}`;
};

const CheckoutForm = ({
  pendingDetails,
  stripeMode,
  price,
  returnUrl,
  isSeatRequest = false,
  paymentMode = 'card',
  onPaymentSuccess,
  policyNotice,
}: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [acknowledged, setAcknowledged] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  // Which wallet the student picked inside the Payment Element, so the button can name
  // the one they chose instead of listing every option.
  const [selectedMethod, setSelectedMethod] = useState('');
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const beginProgress = () => {
    setProcessing(true);
    setProgress(10);
    clearProgressTimer();
    // Ease toward ~90% while we wait on Stripe (true completion time is unknown).
    progressTimer.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.15 : p));
    }, 350);
  };

  const endProgress = (success: boolean) => {
    clearProgressTimer();
    if (success) {
      setProgress(100);
      setTimeout(() => setProcessing(false), 450);
    } else {
      setProgress(0);
      setProcessing(false);
    }
  };

  useEffect(() => clearProgressTimer, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (policyNotice && !acknowledged) return;

    try {
      if (price === 0) {
        window.localStorage.removeItem('pendingDetails');
        onPaymentSuccess('0', { requiresApproval: isSeatRequest });
        return;
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message ?? 'Validation failed');
        SetLoadingStatus(false);
        return;
      }

      SetLoadingStatus(true);
      beginProgress();

      const details = pendingDetails as any;
      const response = await createStripePaymentIntent({
        stripeMode,
        paymentMethod: paymentMode,
        ...(details.kind === 'pay-seat-request'
          ? { seatRequestId: details.requestId }
          : details.groupChatId
            ? { groupChatId: details.groupChatId }
            : { expertId: String(details.expert), duration: details.duration }),
      });
      const clientSecret = response && response.client_secret;
      if (!clientSecret) {
        const reason = (response && (response.error || response.message)) || '';
        setErrorMessage(
          reason
            ? `${reason} You have not been charged.`
            : 'Could not start payment. Please try again in a moment.',
        );
        SetLoadingStatus(false);
        endProgress(false);
        return;
      }

      const requiresApproval =
        typeof response?.requiresApproval === 'boolean'
          ? response.requiresApproval
          : isSeatRequest;

      persistPendingDetails(window.localStorage, { ...pendingDetails, requiresApproval, paymentMode });

      const { paymentIntent, error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      SetLoadingStatus(false);

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        endProgress(true);
        onPaymentSuccess(paymentIntent.id, { requiresApproval });
      } else if (paymentIntent?.status === 'processing') {
        endProgress(true);
        setErrorMessage(
          'Your payment is still being confirmed by the wallet provider. This page will finish your booking once it clears — please check back in a moment.',
        );
      } else if (confirmError) {
        // Integration/validation errors resolve (not throw) with an error object.
        endProgress(false);
        window.localStorage.removeItem('pendingDetails');
        setErrorMessage(confirmError.message ?? 'Payment could not be completed. Please try again.');
      } else if (paymentIntent) {
        endProgress(false);
        window.localStorage.removeItem('pendingDetails');
        setErrorMessage('Payment failed, try again.');
      } else {
        // Redirect-based payment is taking over; show it as complete.
        endProgress(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error while processing payment.';
      setErrorMessage(message);
      SetLoadingStatus(false);
      endProgress(false);
    }
  };

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {policyNotice ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[12px] font-medium text-amber-900">{policyNotice.message}</p>
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[12px] text-amber-900">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#1A3A4A]"
              />
              <span>{policyNotice.acknowledgeLabel}</span>
            </label>
          </div>
        ) : null}
        <PaymentElement onChange={(e: any) => setSelectedMethod(e?.value?.type ?? '')} />
        <FormAlert variant="error" message={errorMessage} onDismiss={() => setErrorMessage('')} />
      </div>
      <div className="shrink-0 pt-3">
        <button
          type="submit"
          disabled={!stripe || !elements || processing || (!!policyNotice && !acknowledged)}
          className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635] disabled:opacity-60"
        >
          {processing
            ? (isSeatRequest ? 'Joining the waiting list…' : 'Processing payment…')
            : isSeatRequest
              ? (price > 0 ? `Authorize $${price} & join waiting list` : 'Join waiting list')
              : price > 0
                ? payButtonLabel(price, paymentMode, selectedMethod)
                : 'Confirm booking'}
        </button>
        {policyNotice && !acknowledged ? (
          <p className="mt-2 text-center text-[11px] text-[#7A7A72]">
            Tick the box above to continue.
          </p>
        ) : null}
        {/* Animated progress line under the button while the charge is processing. */}
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#1A3A4A]/10 transition-opacity duration-200"
          style={{ opacity: processing ? 1 : 0 }}
          role="progressbar"
          aria-label="Payment progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[#234C6A]"
            style={{ width: `${progress}%`, transition: 'width 0.35s ease' }}
          />
        </div>
      </div>
    </form>
  );
};

type Props = {
  type?: string;
  price: number;
  pendingDetails: StudentBookingPendingDetails;
  returnUrl?: string;
  isSeatRequest?: boolean;
  holdsFunds?: boolean;
  walletOption?: WalletOption;
  onPaymentSuccess: (paymentIntentId: string, opts?: { requiresApproval?: boolean }) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  policyNotice?: BookingPolicyNotice;
};

const APPEARANCE = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#1A3A4A',
    colorBackground: '#ffffff',
    colorText: '#1A3A4A',
    colorDanger: '#dc2626',
    borderRadius: '8px',
    fontFamily: 'inherit',
  },
};

export default function StudentBookingCheckout({
  type = 'Session',
  price,
  pendingDetails,
  returnUrl,
  isSeatRequest = false,
  holdsFunds = false,
  walletOption,
  onPaymentSuccess,
  onCancel,
  cancelLabel = 'Back',
  policyNotice,
}: Props) {
  const stripeReturnBase =
    returnUrl ?? `${window.location.pathname}${window.location.search}`;

  // Free bookings never reach a wallet, so the tabs would only be noise.
  const walletAvailable = !!walletOption && price > 0;
  const walletOnly =
    walletAvailable && walletOption?.kind === 'charge' && !!walletOption.only;
  const [tab, setTab] = useState<PaymentMode>(walletOnly ? 'wallet' : 'card');
  const activeTab: PaymentMode = walletOnly ? 'wallet' : walletAvailable ? tab : 'card';
  const [walletSubmitting, setWalletSubmitting] = useState(false);

  const options = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: price > 0 ? Math.round(price * 100) : 1,
      currency: 'usd' as const,
      // Seminar bookings authorize (hold) the funds — the deferred Element must
      // declare the same manual capture or confirmPayment throws a capture_method
      // mismatch and the submit silently fails. Wallets cannot hold at all, so they
      // always settle immediately and must not declare manual capture.
      ...((isSeatRequest || holdsFunds) && price > 0 && activeTab === 'card'
        ? { captureMethod: 'manual' as const }
        : {}),
      // Each rail names its methods explicitly. Wallets are redirect/QR methods that
      // never surface on their own, and left to automatic payment methods the card
      // rail offers everything enabled in the dashboard — which both adds a method
      // picker and can disagree with the payment_method_types on the intent the
      // server creates at confirm time.
      paymentMethodTypes:
        activeTab === 'wallet' ? ['alipay', 'wechat_pay'] : ['card'],
      appearance: APPEARANCE,
    }),
    [price, isSeatRequest, holdsFunds, activeTab],
  );

  const [stripeMode, setStripeMode] = useState('');
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      const response = await getStripeMode();
      if (response) {
        const mode = response.stripeMode || 'test';
        setStripeMode(mode);
        setStripePromise(
          loadStripe(
            mode === 'test'
              ? process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST || ''
              : process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE || '',
          ),
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (stripeMode && stripePromise) {
      SetLoadingStatus(false);
    } else {
      SetLoadingStatus(true);
    }
  }, [stripeMode, stripePromise]);

  if (!stripeMode || !stripePromise) {
    return (
      <p className="text-sm text-[#7A7A72]">Loading secure checkout…</p>
    );
  }

  return (
    <div className="flex max-h-[88vh] flex-col rounded-2xl border border-[#E5E2DB] bg-white p-4 sm:p-6">
      <div className="shrink-0">
        <p className="font-serif text-lg font-medium text-[#1A3A4A]">
          {isSeatRequest ? `Join the waiting list — ${type}` : `Pay for your ${type}`}
        </p>
        <p className="mt-1 text-[12px] text-[#7A7A72]">
          Total: <span className="font-semibold text-[#1A3A4A]">${price}</span>
          {stripeMode === 'test' ? ' · test mode' : ''}
        </p>
        {isSeatRequest && activeTab === 'card' ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            This seminar is full. {price > 0
              ? 'Pay to get on the waiting list for the host to approve — your card is authorized but not charged, and you\'re only charged if the host approves. Otherwise the hold is released.'
              : 'You\'re joining the waiting list; the host approves it and you\'ll join only if they do.'}
          </p>
        ) : null}
      </div>

      {walletOnly ? (
        <p className="mt-4 shrink-0 rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2 text-[12px] text-[#7A7A72]">
          You requested this with WeChat Pay or Alipay, so it is paid the same way.
        </p>
      ) : null}

      {walletAvailable && !walletOnly ? (
        <div
          role="tablist"
          aria-label="Payment method"
          className="mt-4 grid shrink-0 grid-cols-2 gap-1 rounded-[6px] border border-[#E5E2DB] bg-[#F5F3EF] p-1"
        >
          {([
            { id: 'card' as const, label: 'Pay with card' },
            { id: 'wallet' as const, label: 'Pay with WeChat Pay / Alipay' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-[4px] px-3 py-2 text-[13px] font-semibold leading-tight transition ${
                activeTab === t.id
                  ? 'bg-white text-[#1A3A4A] shadow-sm'
                  : 'text-[#7A7A72] hover:text-[#1A3A4A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {activeTab === 'wallet' && walletOption?.kind === 'request' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="rounded-lg border border-[#E5E2DB] bg-[#F5F3EF] px-3 py-2.5">
                <p className="text-[12px] font-semibold text-[#1A3A4A]">
                  WeChat Pay and Alipay are paid in full, so we ask first
                </p>
                <p className="mt-1 text-[12px] text-[#7A7A72]">
                  These wallets can't hold funds the way a card can. We'll send this as a
                  request and <strong>charge you nothing now</strong>. If it's accepted, we'll
                  email you a link to pay ${price} — you'll have 24 hours to complete it, and
                  the booking is confirmed the moment you do.
                </p>
              </div>
              {walletOption.note ? (
                <p className="text-[12px] text-[#7A7A72]">{walletOption.note}</p>
              ) : null}
            </div>
            <div className="shrink-0 pt-3">
              <button
                type="button"
                disabled={walletSubmitting}
                onClick={async () => {
                  setWalletSubmitting(true);
                  try {
                    await walletOption.onSubmit();
                  } finally {
                    setWalletSubmitting(false);
                  }
                }}
                className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635] disabled:opacity-60"
              >
                {walletSubmitting
                  ? 'Sending request…'
                  : walletOption.submitLabel ?? 'Send request — pay after it is accepted'}
              </button>
            </div>
          </div>
        ) : (
          <Elements key={activeTab} stripe={stripePromise} options={options}>
            <CheckoutForm
              pendingDetails={pendingDetails}
              stripeMode={stripeMode}
              price={price}
              returnUrl={stripeReturnBase}
              isSeatRequest={isSeatRequest && activeTab === 'card'}
              paymentMode={activeTab}
              policyNotice={activeTab === 'card' ? policyNotice : undefined}
              onPaymentSuccess={onPaymentSuccess}
            />
          </Elements>
        )}
      </div>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full shrink-0 rounded-[4px] border border-[#E5E2DB] py-2.5 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
        >
          {cancelLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Complete booking after Stripe redirect (3DS) lands on student dashboard. */
export async function completeStudentBookingFromStorage(
  paymentIntent: string,
): Promise<
  | { ok: true; kind: '1:1'; expertId: string; userDetails: unknown }
  | { ok: true; kind: 'seminar'; userDetails: unknown }
  | { ok: true; kind: 'seminar-request' }
  | { ok: true; kind: 'accept'; userDetails: unknown }
  | { ok: false; error: string; retryable: boolean }
> {
  const raw = window.localStorage.getItem('pendingDetails');
  if (!raw) {
    // Nothing to complete or retry — the booking was already finished or never started.
    return { ok: false, error: 'No pending booking found.', retryable: false };
  }
  try {
    const details = JSON.parse(raw);
    // Only drop the recovery state once the booking API has confirmed success. Any
    // failure (transient or business) keeps pendingDetails so a refresh can retry — the
    // server guards against double-processing the same payment_intent.
    const clearPending = () => window.localStorage.removeItem('pendingDetails');

    // Settling an overflow seat the host approved — enrols on payment, no re-approval.
    if (details.kind === 'pay-seat-request') {
      const { paySeminarSeatRequest } = await import('../../api/api');
      const response = await paySeminarSeatRequest({
        requestId: details.requestId,
        payment_intent: paymentIntent,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        return { ok: false, error: response?.error || 'Could not confirm your seat after payment.', retryable: true };
      }
      clearPending();
      return { ok: true, kind: 'seminar', userDetails: response?.result ?? null };
    }

    // Paying to confirm an expert-proposed 1:1 — flips the session to active, no re-approval.
    if (details.kind === 'accept-1to1') {
      const { acceptIndividualAppointment } = await import('../../api/api');
      const response = await acceptIndividualAppointment({
        groupChatId: details.groupChatId,
        payment_intent: paymentIntent,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        return { ok: false, error: response?.error || 'Could not confirm the session after payment.', retryable: true };
      }
      clearPending();
      return { ok: true, kind: 'accept', userDetails: response?.result };
    }

    // Seminars carry a groupChatId; 1:1 sessions carry an expert + slot.
    if (details.groupChatId) {
      // Full seminar → held payment recorded as a seat request pending host approval.
      if (details.requiresApproval) {
        const { requestSeminarSeat } = await import('../../api/api');
        const response = await requestSeminarSeat({
          groupChatId: details.groupChatId,
          payment_intent: paymentIntent,
        });
        if (response === false || response?.status === 'FAIL' || response?.error) {
          return { ok: false, error: response?.error || 'Could not submit your seat request after payment.', retryable: true };
        }
        clearPending();
        return { ok: true, kind: 'seminar-request' };
      }

      const { registerForSeminar } = await import('../../api/api');
      const response = await registerForSeminar({
        groupChatId: details.groupChatId,
        payment_intent: paymentIntent,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        return { ok: false, error: response?.error || 'Seminar registration failed after payment.', retryable: true };
      }
      clearPending();
      // The seminar filled up while paying: the held fee became a seat request instead.
      if (response?.status === 'pending_approval') {
        return { ok: true, kind: 'seminar-request' };
      }
      return { ok: true, kind: 'seminar', userDetails: response?.result ?? null };
    }

    const { createGroupChatByUser, getExpertById } = await import('../../api/api');
    const expertId = String(details.expert);
    const expertRes = await getExpertById(expertId);
    const expertMongoId = expertRes?.result?._id ?? expertId;

    const response = await createGroupChatByUser({
      name: details.name,
      description: details.description ?? '',
      services: Array.isArray(details.services) ? details.services : [],
      purposeOther: details.purposeOther ?? '',
      start: details.start,
      end: details.end,
      duration: details.duration,
      price: details.price,
      expert: expertMongoId,
      payment_intent: paymentIntent,
    });

    // createGroupChatByUser resolves to false / { status:'FAIL' } on failure.
    if (response === false || response?.status === 'FAIL' || response?.error || !response?.result) {
      return { ok: false, error: response?.error || 'Payment succeeded, but the session could not be created.', retryable: true };
    }
    clearPending();

    return { ok: true, kind: '1:1', expertId, userDetails: response.result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Booking failed after payment.';
    return { ok: false, error: message, retryable: true };
  }
}
