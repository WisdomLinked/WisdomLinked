import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AvailabilityPage from './availability';

vi.mock('../../../api/api', () => ({
  doUpdateTimeSlots: vi.fn(async () => ({ newUser: {} })),
  doSetExpertBookingNoticeHours: vi.fn(async () => ({ bookingNoticeHours: 24 })),
  doUpdateProfile: vi.fn(async () => true),
}));

vi.mock('../../../actions/authActions', () => ({
  updateMe: () => async () => ({ type: 'noop' }),
}));

vi.mock('./ExpertAvailabilitySchedule', () => ({
  default: () => <div data-testid="schedule" />,
}));

import { doUpdateProfile, doSetExpertBookingNoticeHours } from '../../../api/api';

const NEW_EXPERT = {
  timeSlots: null,
  price: [10],
  bookingNoticeHours: 24,
  timeZone: 'UTC',
  appointmentDurations: [30, 60, 90],
  pendingSetupSteps: ['rate', 'durations', 'notice'],
};

const EXISTING_EXPERT = {
  timeSlots: [18, 19],
  price: [50],
  bookingNoticeHours: 48,
  timeZone: 'UTC',
  appointmentDurations: [30, 60, 90],
};

const renderPage = (userDetails: Record<string, unknown>) =>
  render(
    <Provider store={configureStore({ reducer: { auth: () => ({ userDetails }) } })}>
      <AvailabilityPage />
    </Provider>,
  );

const durationPill = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^${label.replace(' min', ' minutes')}`) });
const noticePill = (label: string) => screen.getByRole('button', { name: label });
const isActiveNotice = (el: HTMLElement) => el.className.includes('text-white');

describe('AvailabilityPage for a new expert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows nothing pre-selected: no rate, no session lengths, no booking notice', () => {
    renderPage(NEW_EXPERT);
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('');
    for (const d of ['30 min', '60 min', '90 min']) {
      expect(durationPill(d)).toHaveAttribute('aria-pressed', 'false');
    }
    for (const h of ['24 hours', '48 hours', '72 hours']) {
      expect(isActiveNotice(noticePill(h))).toBe(false);
    }
    expect(screen.getByText(/Pick your session lengths above/)).toBeInTheDocument();
  });

  it('saves the notice when the expert picks 24 hours, even though 24 is the stored default', async () => {
    renderPage(NEW_EXPERT);
    fireEvent.click(noticePill('24 hours'));
    await waitFor(() => expect(doSetExpertBookingNoticeHours).toHaveBeenCalledWith(24));
  });

  it('saves the chosen session lengths along with the rate', async () => {
    renderPage(NEW_EXPERT);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '25' } });
    fireEvent.click(durationPill('30 min'));
    fireEvent.click(durationPill('60 min'));
    fireEvent.click(durationPill('90 min'));
    fireEvent.click(screen.getByRole('button', { name: /Select Business Hours/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() =>
      expect(doUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ price: 25, appointmentDurations: [30, 60, 90] }),
      ),
    );
  });

  it('does not save session lengths the expert never picked', async () => {
    renderPage(NEW_EXPERT);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Select Business Hours/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => expect(doUpdateProfile).toHaveBeenCalled());
    expect(vi.mocked(doUpdateProfile).mock.calls[0][0]).not.toHaveProperty('appointmentDurations');
  });
});

describe('AvailabilityPage for an existing expert', () => {
  it('still shows their saved rate, session lengths and booking notice', () => {
    renderPage(EXISTING_EXPERT);
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('50');
    for (const d of ['30 min', '60 min', '90 min']) {
      expect(durationPill(d)).toHaveAttribute('aria-pressed', 'true');
    }
    expect(isActiveNotice(noticePill('48 hours'))).toBe(true);
    expect(isActiveNotice(noticePill('24 hours'))).toBe(false);
  });
});
