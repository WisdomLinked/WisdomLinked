import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSeminars from './StudentSeminars';

const { doFilterSeminars, quoteBookingCharge, registerForSeminar } = vi.hoisted(() => ({
  doFilterSeminars: vi.fn(),
  quoteBookingCharge: vi.fn(),
  registerForSeminar: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  doFilterSeminars: (...args: unknown[]) => doFilterSeminars(...args),
  doGetKeywordsAndServices: vi.fn(async () => ({ keywords: [], services: [] })),
  getExpertById: vi.fn(async () => ({ result: { groupChats: [] } })),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  profileImageFetch: vi.fn(async () => null),
  registerForSeminar: (...args: unknown[]) => registerForSeminar(...args),
  requestSeminarSeat: vi.fn(),
  paySeminarSeatRequest: vi.fn(),
  quoteBookingCharge: (...args: unknown[]) => quoteBookingCharge(...args),
}));

vi.mock('./StudentBookingCheckout', () => ({
  default: () => <div data-testid="student-checkout" />,
  quoteRequestBody: (details: { groupChatId?: string }, priceDollars = 0) => ({
    groupChatId: details.groupChatId,
    advertisedCents: Math.max(0, Math.round(Number(priceDollars) * 100)),
  }),
}));

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

    expect(await screen.findByText('$1.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByTestId('student-checkout')).toBeTruthy();
    expect(registerForSeminar).not.toHaveBeenCalled();
    expect(quoteBookingCharge).toHaveBeenCalled();
  });
});
