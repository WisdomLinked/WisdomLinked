import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import StudentBookingCheckout from './StudentBookingCheckout';
import { ACCOUNT_BLOCKED_MESSAGE, ACCOUNT_UNDER_REVIEW_MESSAGE } from '../../utils/accountStatus';

const storeState = { auth: { userDetails: { email: 's@test.com', status: 'active' } } };
vi.mock('../../store', () => ({ store: { getState: () => storeState, dispatch: vi.fn() } }));

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

const setStatus = (status: string) => {
  storeState.auth.userDetails.status = status;
};

const renderWalletRequest = async (onSubmit: () => Promise<void>) => {
  render(
    <StudentBookingCheckout
      type="1:1 session"
      price={40}
      holdsFunds
      pendingDetails={{
        name: 'Mock interview',
        start: '2026-11-02T15:00:00.000Z',
        end: '2026-11-02T16:00:00.000Z',
        duration: 60,
        price: 40,
        expert: 'e1',
      }}
      walletOption={{ kind: 'request', onSubmit }}
      onPaymentSuccess={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('tab', { name: /wechat pay \/ alipay/i }));
  return screen.getByRole('button', { name: /Send request/ });
};

describe('StudentBookingCheckout wallet request for a restricted account', () => {
  beforeEach(() => {
    setStatus('active');
  });

  it('shows the under-review text below Send request and sends nothing', async () => {
    setStatus('review');
    const onSubmit = vi.fn(async () => {});
    const send = await renderWalletRequest(onSubmit);
    fireEvent.click(send);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(ACCOUNT_UNDER_REVIEW_MESSAGE);
    expect(alert.className).toContain('text-rose-600');
    expect(alert.className).not.toMatch(/text-red-\d/);
    expect(send.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the blocked text below Send request and sends nothing', async () => {
    setStatus('blocked');
    const onSubmit = vi.fn(async () => {});
    fireEvent.click(await renderWalletRequest(onSubmit));

    expect(await screen.findByRole('alert')).toHaveTextContent(ACCOUNT_BLOCKED_MESSAGE);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the request for an active account with no restriction text', async () => {
    const onSubmit = vi.fn(async () => {});
    fireEvent.click(await renderWalletRequest(onSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(ACCOUNT_UNDER_REVIEW_MESSAGE)).toBeNull();
    expect(screen.queryByText(ACCOUNT_BLOCKED_MESSAGE)).toBeNull();
  });

  it('explains the refusal when the account is put under review while the checkout is open', async () => {
    const onSubmit = vi.fn(async () => {
      setStatus('review');
    });
    fireEvent.click(await renderWalletRequest(onSubmit));

    expect(await screen.findByRole('alert')).toHaveTextContent(ACCOUNT_UNDER_REVIEW_MESSAGE);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
