import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import Payment from './payment';

vi.mock('../../../api/api', () => ({
  getStripeMode: vi.fn(async () => ({ stripeMode: 'test' })),
  createStripePaymentIntent: vi.fn(),
}));

vi.mock('../../../actions/appActions', () => ({
  SetLoadingStatus: vi.fn(),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({}),
  useElements: () => ({
    submit: async () => ({ error: { message: 'Your card was declined.' } }),
  }),
}));

describe('customer payment checkout errors', () => {
  it('keeps a payment error on screen after 4 seconds', async () => {
    render(
      <Payment
        type="Seminar"
        price={40}
        pendingDetails={{ groupChatId: 'sem-1', price: 40, name: 'Research Methods' }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /^pay$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your card was declined.');

    await new Promise((resolve) => setTimeout(resolve, 4100));

    expect(screen.getByRole('alert')).toHaveTextContent('Your card was declined.');
  }, 10000);
});
