import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import StudentBookingCheckout from './StudentBookingCheckout';

const createStripePaymentIntent = vi.fn();

vi.mock('../../api/api', () => ({
  getStripeMode: vi.fn(async () => ({ stripeMode: 'test' })),
  createStripePaymentIntent: (...args: any[]) => createStripePaymentIntent(...args),
}));

vi.mock('../../actions/appActions', () => ({
  SetLoadingStatus: vi.fn(),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

const confirmPayment = vi.fn(async () => ({
  paymentIntent: { id: 'pi_wallet_1', status: 'succeeded' },
}));

// Stands in for Stripe's Payment Element: the buttons let a test pick a wallet the way
// a student would, which is what drives the pay button's wording.
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div>{children}</div>,
  PaymentElement: ({ onChange }: any) => (
    <div data-testid="payment-element">
      <button type="button" onClick={() => onChange?.({ value: { type: 'wechat_pay' } })}>
        select wechat
      </button>
      <button type="button" onClick={() => onChange?.({ value: { type: 'alipay' } })}>
        select alipay
      </button>
    </div>
  ),
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({ submit: vi.fn(async () => ({})) }),
}));

const seminarDetails = { groupChatId: 'seminar-1', price: 25, name: 'Research Methods' };

const renderCheckout = (props: any = {}) =>
  render(
    <StudentBookingCheckout
      type="Seminar"
      price={25}
      holdsFunds
      pendingDetails={seminarDetails}
      onPaymentSuccess={vi.fn()}
      {...props}
    />,
  );

describe('StudentBookingCheckout payment method tabs', () => {
  beforeEach(() => {
    createStripePaymentIntent.mockReset();
    createStripePaymentIntent.mockResolvedValue({ client_secret: 'cs_test_1' });
    confirmPayment.mockClear();
    window.localStorage.clear();
  });

  it('shows no tabs when no wallet route is offered', async () => {
    renderCheckout();
    await screen.findByTestId('payment-element');
    expect(screen.queryByRole('tab', { name: /pay with wallet/i })).toBeNull();
  });

  it('hides the tabs for a free booking, where a wallet has nothing to charge', async () => {
    renderCheckout({ price: 0, walletOption: { kind: 'charge' } });
    await screen.findByTestId('payment-element');
    expect(screen.queryByRole('tab', { name: /pay with wallet/i })).toBeNull();
  });

  it('offers card and wallet tabs, with card selected first', async () => {
    renderCheckout({ walletOption: { kind: 'charge' } });

    const cardTab = await screen.findByRole('tab', { name: /pay with card/i });
    const walletTab = screen.getByRole('tab', { name: /pay with wallet/i });
    expect(cardTab.getAttribute('aria-selected')).toBe('true');
    expect(walletTab.getAttribute('aria-selected')).toBe('false');
  });

  it('charges the wallet directly when a seat is free to take', async () => {
    renderCheckout({ walletOption: { kind: 'charge' } });

    fireEvent.click(await screen.findByRole('tab', { name: /pay with wallet/i }));

    const payButton = await screen.findByRole('button', {
      name: /^pay \$25$/i,
    });
    fireEvent.click(payButton);

    await waitFor(() => expect(createStripePaymentIntent).toHaveBeenCalled());
    expect(createStripePaymentIntent.mock.calls[0][0]).toMatchObject({
      paymentMethod: 'wallet',
      groupChatId: 'seminar-1',
    });
  });

  it('sends a request instead of charging when the wallet must wait for approval', async () => {
    const onSubmit = vi.fn();
    renderCheckout({ isSeatRequest: true, walletOption: { kind: 'request', onSubmit } });

    fireEvent.click(await screen.findByRole('tab', { name: /pay with wallet/i }));

    // No card fields on this panel — there is nothing to pay for yet.
    expect(screen.queryByTestId('payment-element')).toBeNull();
    expect(screen.getByText(/charge you nothing now/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(createStripePaymentIntent).not.toHaveBeenCalled();
  });

  it('keeps the card tab on the authorize-and-hold wording for a full seminar', async () => {
    const onSubmit = vi.fn();
    renderCheckout({ isSeatRequest: true, walletOption: { kind: 'request', onSubmit } });

    expect(await screen.findByText(/your card is authorized but not charged/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /pay with wallet/i }));
    // The hold explanation is card-only; a wallet never holds.
    expect(screen.queryByText(/your card is authorized but not charged/i)).toBeNull();
  });

  it('offers no card tab when the booking is pinned to the wallet', async () => {
    // Settling a wallet-requested booking by card would be an opt-out of the hold the
    // card path requires up front, so the choice is not offered at all.
    renderCheckout({ walletOption: { kind: 'charge', only: true } });

    await screen.findByTestId('payment-element');
    expect(screen.queryByRole('tab', { name: /pay with card/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /pay with wallet/i })).toBeNull();
    expect(screen.getByText(/paid the same way/i)).toBeTruthy();
  });

  it('charges as a wallet when pinned, without the student choosing', async () => {
    renderCheckout({ walletOption: { kind: 'charge', only: true } });

    fireEvent.click(
      await screen.findByRole('button', { name: /^pay \$25$/i }),
    );

    await waitFor(() => expect(createStripePaymentIntent).toHaveBeenCalled());
    expect(createStripePaymentIntent.mock.calls[0][0].paymentMethod).toBe('wallet');
  });

  it('records the chosen mode for recovery after a wallet redirect', async () => {
    renderCheckout({ walletOption: { kind: 'charge' } });

    fireEvent.click(await screen.findByRole('tab', { name: /pay with wallet/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /^pay \$25$/i }),
    );

    await waitFor(() => expect(confirmPayment).toHaveBeenCalled());
    const stored = JSON.parse(window.localStorage.getItem('pendingDetails') || '{}');
    expect(stored.paymentMode).toBe('wallet');
  });
});

describe('pay button wording', () => {
  beforeEach(() => {
    createStripePaymentIntent.mockReset();
    createStripePaymentIntent.mockResolvedValue({ client_secret: 'cs_test_1' });
    window.localStorage.clear();
  });

  it('names the wallet the student picked, not every wallet on offer', async () => {
    // Listing both after a choice has been made reads as though it did not register.
    renderCheckout({ walletOption: { kind: 'charge', only: true } });
    await screen.findByTestId('payment-element');

    fireEvent.click(screen.getByRole('button', { name: /select wechat/i }));
    expect(screen.getByRole('button', { name: /^pay \$25 with wechat pay$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^pay \$25 with alipay$/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /select alipay/i }));
    expect(screen.getByRole('button', { name: /^pay \$25 with alipay$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^pay \$25 with wechat pay$/i })).toBeNull();
  });

  it('stays neutral until a wallet is chosen', async () => {
    renderCheckout({ walletOption: { kind: 'charge', only: true } });
    await screen.findByTestId('payment-element');
    expect(screen.getByRole('button', { name: /^pay \$25$/i })).toBeTruthy();
  });

  it('never names a wallet on the card tab', async () => {
    renderCheckout({ walletOption: { kind: 'charge' } });
    await screen.findByTestId('payment-element');

    fireEvent.click(screen.getByRole('button', { name: /select wechat/i }));
    expect(screen.getByRole('button', { name: /^pay \$25$/i })).toBeTruthy();
  });
});
