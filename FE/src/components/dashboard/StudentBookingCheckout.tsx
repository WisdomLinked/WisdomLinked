import React, { useEffect, useState, useMemo } from 'react';
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

export type StudentBookingPendingDetails = {
  name: string;
  start: string | Date;
  end: string | Date;
  duration: number;
  price: number;
  expert: string;
};

type CheckoutFormProps = {
  pendingDetails: StudentBookingPendingDetails;
  stripeMode: string;
  price: number;
  returnUrl: string;
  onPaymentSuccess: (paymentIntentId: string) => void;
};

const CheckoutForm = ({
  pendingDetails,
  stripeMode,
  price,
  returnUrl,
  onPaymentSuccess,
}: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    try {
      if (price === 0) {
        window.localStorage.setItem('pendingDetails', JSON.stringify(pendingDetails));
        onPaymentSuccess('0');
        return;
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message ?? 'Validation failed');
        SetLoadingStatus(false);
        return;
      }

      SetLoadingStatus(true);

      const response = await createStripePaymentIntent({
        stripeMode,
        amount: price,
      });
      const { client_secret: clientSecret } = response;

      window.localStorage.setItem('pendingDetails', JSON.stringify(pendingDetails));

      const { paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      SetLoadingStatus(false);

      if (paymentIntent?.status === 'succeeded') {
        window.localStorage.removeItem('pendingDetails');
        onPaymentSuccess(paymentIntent.id);
      } else if (paymentIntent) {
        window.localStorage.removeItem('pendingDetails');
        setErrorMessage('Payment failed, try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error while processing payment.';
      setErrorMessage(message);
      SetLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <FormAlert variant="error" message={errorMessage} onDismiss={() => setErrorMessage('')} />
      <button
        type="submit"
        disabled={!stripe || !elements}
        className="inline-flex w-full items-center justify-center rounded-[4px] bg-[#1A3A4A] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#122635] disabled:opacity-50"
      >
        {price > 0 ? `Pay $${price}` : 'Confirm booking'}
      </button>
    </form>
  );
};

type Props = {
  type?: string;
  price: number;
  pendingDetails: StudentBookingPendingDetails;
  returnUrl?: string;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onCancel?: () => void;
};

export default function StudentBookingCheckout({
  type = 'Session',
  price,
  pendingDetails,
  returnUrl,
  onPaymentSuccess,
  onCancel,
}: Props) {
  const stripeReturnBase =
    returnUrl ?? `${window.location.pathname}${window.location.search}`;

  const options = useMemo(
    () => ({
      mode: 'payment' as const,
      amount: price > 0 ? price * 100 : 1,
      currency: 'usd',
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
    [price],
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
    <div className="rounded-2xl border border-[#E5E2DB] bg-white p-6">
      <p className="font-serif text-lg font-medium text-[#1A3A4A]">
        Pay for your {type}
      </p>
      <p className="mt-1 text-[12px] text-[#7A7A72]">
        Total: <span className="font-semibold text-[#1A3A4A]">${price}</span>
        {stripeMode === 'test' ? ' · test mode' : ''}
      </p>
      <Elements stripe={stripePromise} options={options}>
        <CheckoutForm
          pendingDetails={pendingDetails}
          stripeMode={stripeMode}
          price={price}
          returnUrl={stripeReturnBase}
          onPaymentSuccess={onPaymentSuccess}
        />
      </Elements>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-[4px] border border-[#E5E2DB] py-2.5 text-[13px] font-semibold text-[#1A3A4A] hover:bg-[#F5F3EF]"
        >
          Back
        </button>
      ) : null}
    </div>
  );
}

/** Complete booking after Stripe redirect (3DS) lands on student dashboard. */
export async function completeStudentBookingFromStorage(
  paymentIntent: string,
): Promise<
  | { ok: true; expertId: string; userDetails: unknown }
  | { ok: false; error: string }
> {
  const raw = window.localStorage.getItem('pendingDetails');
  if (!raw) {
    return { ok: false, error: 'No pending booking found.' };
  }
  try {
    const details = JSON.parse(raw);
    window.localStorage.removeItem('pendingDetails');
    const { createGroupChatByUser, getExpertById } = await import('../../api/api');
    const expertId = String(details.expert);
    const expertRes = await getExpertById(expertId);
    const expertMongoId = expertRes?.result?._id ?? expertId;

    const response = await createGroupChatByUser({
      name: details.name,
      start: details.start,
      end: details.end,
      duration: details.duration,
      price: details.price,
      expert: expertMongoId,
      payment_intent: paymentIntent,
    });

    return { ok: true, expertId, userDetails: response?.result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Booking failed after payment.';
    return { ok: false, error: message };
  }
}
