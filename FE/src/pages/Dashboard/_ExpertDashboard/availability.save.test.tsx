import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AvailabilityPage from './availability';

vi.mock('../../../api/api', () => ({
  doUpdateTimeSlots: vi.fn(async () => ({ newUser: {} })),
  doSetExpertBookingNoticeHours: vi.fn(),
  doUpdateProfile: vi.fn(async () => true),
}));

vi.mock('../../../actions/authActions', () => ({
  updateMe: () => async () => ({ type: 'noop' }),
}));

vi.mock('./ExpertAvailabilitySchedule', () => ({
  default: () => <div data-testid="schedule" />,
}));

import { doUpdateTimeSlots, doUpdateProfile } from '../../../api/api';

const store = configureStore({
  reducer: {
    auth: () => ({
      userDetails: {
        timeSlots: [18, 19, 20, 21],
        price: 50,
        bookingNoticeHours: 24,
        timeZone: 'UTC',
      },
    }),
  },
});

describe('AvailabilityPage save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls doUpdateTimeSlots and doUpdateProfile on save', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: /Select Business Hours/i }));

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(doUpdateTimeSlots).toHaveBeenCalled();
      expect(doUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ price: 55, timeZone: expect.any(String) }),
      );
    });
  });

  it('does not show required timezone select', () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );
    expect(screen.queryByText('Select a timezone…')).toBeNull();
    expect(screen.getByText(/detected from your device/i)).toBeInTheDocument();
  });
});
