import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentSeminars from './StudentSeminars';

const { doFilterSeminars, doGetKeywordsAndServices, getExpertById, checkoutProps } = vi.hoisted(() => ({
  doFilterSeminars: vi.fn(),
  doGetKeywordsAndServices: vi.fn(),
  getExpertById: vi.fn(),
  checkoutProps: { calls: [] as Array<Record<string, unknown>> },
}));

vi.mock('../../api/api', () => ({
  doFilterSeminars: (...args: unknown[]) => doFilterSeminars(...args),
  doGetKeywordsAndServices: (...args: unknown[]) => doGetKeywordsAndServices(...args),
  getExpertById: (...args: unknown[]) => getExpertById(...args),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  profileImageFetch: vi.fn(async () => null),
  registerForSeminar: vi.fn(),
  requestSeminarSeat: vi.fn(),
  paySeminarSeatRequest: vi.fn(),
  quoteBookingCharge: vi.fn(async () => null),
}));

vi.mock('../../api/chatApi', () => ({
  fetchChatUserProfile: vi.fn(async () => ({ success: false })),
}));

vi.mock('./StudentBookingCheckout', () => ({
  default: (props: Record<string, unknown>) => {
    checkoutProps.calls.push(props);
    return <div data-testid="student-checkout" />;
  },
  quoteRequestBody: (details: { groupChatId?: string }, priceDollars = 0) => ({
    groupChatId: details?.groupChatId,
    advertisedCents: Math.max(0, Math.round(Number(priceDollars) * 100)),
  }),
  ChargeLines: () => null,
}));

const seminarRow = {
  _id: 'occ-1',
  seriesId: 'series-9',
  name: 'Cell seminar',
  description: 'Cells',
  start: new Date(Date.now() + 86_400_000).toISOString(),
  image: '',
  admin: { _id: 'host-1', username: 'Host', image: '' },
  participants: ['host-1'],
  price: 10,
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
      <StudentSeminars openSeminarId="series-9" />
    </Provider>,
  );
}

describe('StudentSeminars seminar registration checkout', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    checkoutProps.calls.length = 0;
    doFilterSeminars.mockReset();
    doGetKeywordsAndServices.mockReset();
    getExpertById.mockReset();
    doFilterSeminars.mockResolvedValue({ result: [seminarRow] });
    doGetKeywordsAndServices.mockResolvedValue({ keywords: [], services: [] });
    getExpertById.mockResolvedValue({ result: { groupChats: [] } });
  });

  it('opens seminar registration checkout with a card hold', async () => {
    renderSeminars();

    fireEvent.click(await screen.findByRole('button', { name: /continue to payment/i }));
    expect(await screen.findByText(/review your booking/i)).toBeTruthy();
    const continueButtons = screen.getAllByRole('button', { name: /continue to payment/i });
    fireEvent.click(continueButtons[continueButtons.length - 1]);

    expect(await screen.findByTestId('student-checkout')).toBeTruthy();
    expect(checkoutProps.calls.at(-1)).toMatchObject({ type: 'Seminar', holdsFunds: true });
  });
});
