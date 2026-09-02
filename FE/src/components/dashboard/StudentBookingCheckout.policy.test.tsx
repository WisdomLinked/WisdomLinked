import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import StudentBookingCheckout from './StudentBookingCheckout';

vi.mock('../../api/api', () => ({
  getStripeMode: vi.fn(async () => ({ stripeMode: 'test' })),
  createStripePaymentIntent: vi.fn(),
}));

vi.mock('../../actions/appActions', () => ({
  SetLoadingStatus: vi.fn(),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({}),
  useElements: () => ({}),
}));

const pendingDetails = {
  kind: 'accept-1to1' as const,
  groupChatId: 'chat-1',
  price: 40,
  name: 'PhD Application Advice',
};

const renderCheckout = (props: any = {}) =>
  render(
    <StudentBookingCheckout
      type="1:1 session"
      price={40}
      holdsFunds
      pendingDetails={pendingDetails}
      onPaymentSuccess={vi.fn()}
      {...props}
    />,
  );

describe('StudentBookingCheckout cancellation notice', () => {
  it('blocks payment until the student acknowledges the notice', async () => {
    renderCheckout({
      policyNotice: {
        message: 'Paying confirms this session immediately. It cannot be cancelled and the payment is not refundable.',
        acknowledgeLabel: 'I understand this payment is non-refundable.',
      },
    });

    const payButton = await screen.findByRole('button', { name: /pay \$40/i });
    expect(screen.getByText(/cannot be cancelled/i)).toBeTruthy();
    expect(payButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(payButton).not.toBeDisabled());
  });

  it('leaves payment open when no notice is configured', async () => {
    renderCheckout();

    const payButton = await screen.findByRole('button', { name: /pay \$40/i });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(payButton).not.toBeDisabled();
  });
});
