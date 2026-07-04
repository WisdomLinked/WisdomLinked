import React, { useEffect, useState, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { createStripePaymentIntent, getStripeMode } from '../../api/api';
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

export type StudentBookingPendingDetails =
  | StudentOneToOnePendingDetails
  | StudentSeminarPendingDetails
  | StudentAcceptOneToOnePendingDetails;

type CheckoutFormProps = {
  pendingDetails: StudentBookingPendingDetails;
  stripeMode: string;
  price: number;
  returnUrl: string;
  isSeatRequest?: boolean;
  onPaymentSuccess: (paymentIntentId: string, opts?: { requiresApproval?: boolean }) => void;
};

const CheckoutForm = ({
  pendingDetails,
  stripeMode,
  price,
  returnUrl,
  isSeatRequest = false,
  onPaymentSuccess,
}: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState('');
  // Animated progress shown under the Pay button while the charge is processing,
  // so the student sees that the payment is working through to completion.
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
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

    try {
      if (price === 0) {
        // A free but full seminar still routes through host approval (no funds to hold).
        window.localStorage.setItem('pendingDetails', JSON.stringify({ ...pendingDetails, requiresApproval: isSeatRequest }));
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
        ...(details.groupChatId
          ? { groupChatId: details.groupChatId }
          : { expertId: String(details.expert), duration: details.duration }),
      });
      const clientSecret = response && response.client_secret;
      if (!clientSecret) {
        setErrorMessage('Could not start payment. Please try again in a moment.');
        SetLoadingStatus(false);
        endProgress(false);
        return;
      }

      // Full seminar → funds are authorized (held), not captured, pending host approval.
      const requiresApproval = isSeatRequest || Boolean(response?.requiresApproval);

      window.localStorage.setItem('pendingDetails', JSON.stringify({ ...pendingDetails, requiresApproval }));

      const { paymentIntent, error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      SetLoadingStatus(false);

      // A held payment resolves to 'requires_capture' rather than 'succeeded'.
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        endProgress(true);
        window.localStorage.removeItem('pendingDetails');
        onPaymentSuccess(paymentIntent.id, { requiresApproval });
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
        <PaymentElement />
        <FormAlert variant="error" message={errorMessage} onDismiss={() => setErrorMessage('')} />
      </div>
      <div className="shrink-0 pt-3">
        <button
          type="submit"
          disabled={!stripe || !elements || processing}
          className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635] disabled:opacity-60"
        >
          {processing
            ? (isSeatRequest ? 'Submitting request…' : 'Processing payment…')
            : isSeatRequest
              ? (price > 0 ? `Authorize $${price} & request seat` : 'Request seat')
              : price > 0 ? `Pay $${price}` : 'Confirm booking'}
        </button>
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
  onPaymentSuccess: (paymentIntentId: string, opts?: { requiresApproval?: boolean }) => void;
  onCancel?: () => void;
  cancelLabel?: string;
};

export default function StudentBookingCheckout({
  type = 'Session',
  price,
  pendingDetails,
  returnUrl,
  isSeatRequest = false,
  onPaymentSuccess,
  onCancel,
  cancelLabel = 'Back',
}: Props) {
  const stripeReturnBase =
    returnUrl ?? `${window.location.pathname}${window.location.search}`;

  const options = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: price > 0 ? Math.round(price * 100) : 1,
      currency: 'usd',
      // A full-seminar seat request authorizes (holds) the funds — the deferred
      // Element must declare the same manual capture or confirmPayment throws a
      // capture_method mismatch and the submit silently fails.
      ...(isSeatRequest && price > 0 ? { captureMethod: 'manual' as const } : {}),
      appearance: {
        theme: 'stripe' as const,
        variables: {
          colorPrimary: '#1A3A4A',
          colorBackground: '#ffffff',
          colorText: '#1A3A4A',
          colorDanger: '#dc2626',
          borderRadius: '8px',
          fontFamily: 'inherit',
        },
      },
    }),
    [price, isSeatRequest],
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
          {isSeatRequest ? `Request a seat — ${type}` : `Pay for your ${type}`}
        </p>
        <p className="mt-1 text-[12px] text-[#7A7A72]">
          Total: <span className="font-semibold text-[#1A3A4A]">${price}</span>
          {stripeMode === 'test' ? ' · test mode' : ''}
        </p>
        {isSeatRequest ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            This seminar is full. {price > 0
              ? 'Your card will be authorized but not charged — you\'re only charged if the host approves your seat. Otherwise the hold is released.'
              : 'Your request goes to the host for approval; you\'ll join only if they approve.'}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            pendingDetails={pendingDetails}
            stripeMode={stripeMode}
            price={price}
            returnUrl={stripeReturnBase}
            isSeatRequest={isSeatRequest}
            onPaymentSuccess={onPaymentSuccess}
          />
        </Elements>
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
  | { ok: false; error: string }
> {
  const raw = window.localStorage.getItem('pendingDetails');
  if (!raw) {
    return { ok: false, error: 'No pending booking found.' };
  }
  try {
    const details = JSON.parse(raw);
    window.localStorage.removeItem('pendingDetails');

    // Paying to confirm an expert-proposed 1:1 — flips the session to active, no re-approval.
    if (details.kind === 'accept-1to1') {
      const { acceptIndividualAppointment } = await import('../../api/api');
      const response = await acceptIndividualAppointment({
        groupChatId: details.groupChatId,
        payment_intent: paymentIntent,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        return { ok: false, error: response?.error || 'Could not confirm the session after payment.' };
      }
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
          return { ok: false, error: response?.error || 'Could not submit your seat request after payment.' };
        }
        return { ok: true, kind: 'seminar-request' };
      }

      const { registerForSeminar } = await import('../../api/api');
      const response = await registerForSeminar({
        groupChatId: details.groupChatId,
        payment_intent: paymentIntent,
      });
      if (response === false || response?.status === 'FAIL' || response?.error) {
        return { ok: false, error: response?.error || 'Seminar registration failed after payment.' };
      }
      return { ok: true, kind: 'seminar', userDetails: response?.result ?? response };
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
      return { ok: false, error: response?.error || 'Payment succeeded, but the session could not be created.' };
    }

    return { ok: true, kind: '1:1', expertId, userDetails: response.result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Booking failed after payment.';
    return { ok: false, error: message };
  }
}
