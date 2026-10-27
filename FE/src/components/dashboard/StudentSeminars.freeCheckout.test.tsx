import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSeminars from './StudentSeminars';

const { doFilterSeminars, quoteBookingCharge, registerForSeminar, getMySeatRequests, checkoutProps } = vi.hoisted(() => ({
  doFilterSeminars: vi.fn(),
  quoteBookingCharge: vi.fn(),
  registerForSeminar: vi.fn(),
  getMySeatRequests: vi.fn(async () => ({ result: [] as unknown[] })),
  checkoutProps: { calls: [] as Array<Record<string, unknown>> },
}));

vi.mock('../../api/api', () => ({
  doFilterSeminars: (...args: unknown[]) => doFilterSeminars(...args),
  doGetKeywordsAndServices: vi.fn(async () => ({ keywords: [], services: [] })),
  getExpertById: vi.fn(async () => ({ result: { groupChats: [] } })),
  getMySeatRequests: (...args: unknown[]) => getMySeatRequests(...args),
  profileImageFetch: vi.fn(async () => null),
  registerForSeminar: (...args: unknown[]) => registerForSeminar(...args),
  requestSeminarSeat: vi.fn(),
  paySeminarSeatRequest: vi.fn(),
  quoteBookingCharge: (...args: unknown[]) => quoteBookingCharge(...args),
}));

vi.mock('./StudentBookingCheckout', () => {
  const money = (cents: number) => `$${(Math.round(Number(cents) || 0) / 100).toFixed(2)}`;
  const ChargeLines = ({
    quote,
  }: {
    quote: { advertisedCents: number; platformFeeCents: number; taxCents: number };
  }) => (
    <dl>
      <div>
        <dt>Price</dt>
        <dd>{money(quote.advertisedCents)}</dd>
      </div>
      {quote.platformFeeCents > 0 ? (
        <div>
          <dt>Platform fee</dt>
          <dd>{money(quote.platformFeeCents)}</dd>
        </div>
      ) : null}
      {quote.taxCents > 0 ? (
        <div>
          <dt>Tax</dt>
          <dd>{money(quote.taxCents)}</dd>
        </div>
      ) : null}
    </dl>
  );
  return {
    default: (props: Record<string, unknown>) => {
      checkoutProps.calls.push(props);
      return <div data-testid="student-checkout" />;
    },
    quoteRequestBody: (details: { groupChatId?: string }, priceDollars = 0) => ({
      groupChatId: details.groupChatId,
      advertisedCents: Math.max(0, Math.round(Number(priceDollars) * 100)),
    }),
    ChargeLines,
  };
});

const freeSeminar = {
  _id: 'sem-free',
  name: 'Open office hours',
  description: 'A seminar with no advertised price',
  start: new Date(Date.now() + 86_400_000).toISOString(),
  admin: { _id: 'host-1', username: 'Host' },
  participants: ['host-1'],
  price: 0,
  keywords: [],
  services: [],
  maxAttendees: 20,
};

function renderSeminars() {
  const store = configureStore({
    reducer: {
      auth: () => ({ userDetails: { _id: 'student-1', keywords: [], groupChats: [] } }),
    },
  });
  return render(
    <Provider store={store}>
      <StudentSeminars />
    </Provider>,
  );
}

describe('StudentSeminars $0 advertised price', () => {
  beforeEach(() => {
    doFilterSeminars.mockReset();
    quoteBookingCharge.mockReset();
    registerForSeminar.mockReset();
    getMySeatRequests.mockReset();
    getMySeatRequests.mockResolvedValue({ result: [] });
    checkoutProps.calls.length = 0;
    doFilterSeminars.mockResolvedValue({ result: [freeSeminar] });
    quoteBookingCharge.mockResolvedValue({
      sessionType: 'seminar',
      advertisedCents: 0,
      platformFeeCents: 100,
      taxCents: 0,
      chargeCents: 100,
    });
  });

  it('quotes the platform fee, shows that total, and opens checkout instead of registering with payment intent 0', async () => {
    renderSeminars();

    fireEvent.click(await screen.findByRole('button', { name: /^view details$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    expect(await screen.findByText('Platform fee')).toBeTruthy();
    expect(screen.getAllByText('$1.00').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByTestId('student-checkout')).toBeTruthy();
    expect(registerForSeminar).not.toHaveBeenCalled();
    expect(quoteBookingCharge).toHaveBeenCalled();
    expect(checkoutProps.calls).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'Seminar', holdsFunds: true })]),
    );
    expect(checkoutProps.calls.some((props) => props.type === 'Seminar seat')).toBe(false);
  });

  it('opens an approved seat checkout without holdsFunds', async () => {
    getMySeatRequests.mockResolvedValue({
      result: [{
        _id: 'req-1',
        status: 'awaiting_payment',
        amount: 2500,
        paymentDeadline: new Date(Date.now() + 86_400_000).toISOString(),
        origin: 'student',
        groupChat: { _id: 'sem-free' },
      }],
    });

    renderSeminars();

    fireEvent.click(await screen.findByRole('button', { name: /^view details$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pay \$25 to confirm your seat/i }));

    expect(await screen.findByTestId('student-checkout')).toBeTruthy();
    const seat = checkoutProps.calls.find((props) => props.type === 'Seminar seat');
    expect(seat).toBeTruthy();
    expect(seat?.holdsFunds).toBeFalsy();
  });
});
