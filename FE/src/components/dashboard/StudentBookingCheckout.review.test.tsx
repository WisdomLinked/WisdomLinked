import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import StudentBookingCheckout from './StudentBookingCheckout';
import { ACCOUNT_BLOCKED_MESSAGE, ACCOUNT_UNDER_REVIEW_MESSAGE } from '../../utils/accountStatus';
import { createStripePaymentIntent } from '../../api/api';

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
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({ submit: vi.fn(async () => ({})) }),
}));

const pendingDetails = {
  name: 'Career chat',
  start: '2026-10-20T15:00:00.000Z',
  end: '2026-10-20T15:30:00.000Z',
  duration: 30,
  price: 10,
  expert: 'expert-1',
};

const submitPayment = async () => {
  render(
    <StudentBookingCheckout
      type="1:1 session"
      price={10}
      holdsFunds
      pendingDetails={pendingDetails}
      onPaymentSuccess={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /pay \$10/i }));
};

describe('StudentBookingCheckout — account under review', () => {
  beforeEach(() => {
    vi.mocked(createStripePaymentIntent).mockReset();
  });

  it('explains the review block in red instead of the generic failure', async () => {
    vi.mocked(createStripePaymentIntent).mockResolvedValue({
      status: 'FAIL',
      error: 'Something went wrong. Please try again.',
      code: 'UNDER_REVIEW',
    });

    await submitPayment();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(ACCOUNT_UNDER_REVIEW_MESSAGE);
    expect(alert.className).toMatch(/(^|\s)text-red(\s|$)/);
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    expect(screen.queryByText(/you have not been charged/i)).toBeNull();
  });

  it('explains a blocked account in red', async () => {
    vi.mocked(createStripePaymentIntent).mockResolvedValue({
      status: 'FAIL',
      error: ACCOUNT_BLOCKED_MESSAGE,
      code: 'USER_BLOCKED',
    });

    await submitPayment();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(ACCOUNT_BLOCKED_MESSAGE);
    expect(alert.className).toMatch(/(^|\s)text-red(\s|$)/);
  });

  it('keeps the existing message for other payment failures', async () => {
    vi.mocked(createStripePaymentIntent).mockResolvedValue({
      status: 'FAIL',
      error: 'Something went wrong. Please try again.',
    });

    await submitPayment();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Something went wrong. Please try again. You have not been charged.');
    expect(alert.className).not.toMatch(/(^|\s)text-red(\s|$)/);
  });
});
