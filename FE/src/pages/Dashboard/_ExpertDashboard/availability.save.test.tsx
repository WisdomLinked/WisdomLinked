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

import { doUpdateTimeSlots, doUpdateProfile, doSetExpertBookingNoticeHours } from '../../../api/api';

const store = configureStore({
  reducer: {
    auth: () => ({
      userDetails: {
        timeSlots: [18, 19, 20, 21],
        price: 50,
        bookingNoticeHours: 24,
        timeZone: 'UTC',
        appointmentDurations: [30, 60, 90],
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

  it('saves hourly rate above $100', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /Select Business Hours/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(doUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ price: 150, timeZone: expect.any(String) }),
      );
    });
    expect(screen.queryByText(/at least \$5/i)).not.toBeInTheDocument();
  });

  it('blocks save when hourly rate is below minimum', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Select Business Hours/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Please set an hourly rate of at least \$5/i),
      ).toBeInTheDocument();
    });
    expect(doUpdateTimeSlots).not.toHaveBeenCalled();
    expect(doUpdateProfile).not.toHaveBeenCalled();
  });

  it('shows rate-only success message when only hourly rate changes', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('0')).toHaveValue(50);
    });

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Hourly rate saved \(\$75\/hr\)/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Weekly availability saved/i)).not.toBeInTheDocument();
  });

  it('shows slots-only success message when only availability changes', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('0')).toHaveValue(50);
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear All/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Business Hours/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Weekly availability saved/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Hourly rate saved/i)).not.toBeInTheDocument();
  });

  it('shows booking notice message with selected hours', async () => {
    vi.mocked(doSetExpertBookingNoticeHours).mockResolvedValue({ result: {} });

    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '48 hours' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Minimum booking notice set to 48 hours/i),
      ).toBeInTheDocument();
    });
  });

  it('saves appointment durations when toggled off', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('0')).toHaveValue(50);
    });

    fireEvent.click(screen.getByRole('button', { name: '30 minutes, selected' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(doUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentDurations: [60, 90] }),
      );
    });
    expect(doUpdateTimeSlots).not.toHaveBeenCalled();
  });

  it('shows white unselected and blue selected appointment duration pills', async () => {
    render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '30 minutes, selected' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '30 minutes, selected' }));

    expect(screen.getByRole('button', { name: '30 minutes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: '60 minutes, selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('AvailabilityPage save button state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = async () => {
    const view = render(
      <Provider store={store}>
        <AvailabilityPage />
      </Provider>,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('0')).toHaveValue(50);
    });
    return view;
  };

  const saveButton = () => screen.getByRole('button', { name: /Save Changes/i });

  it('is disabled while the form matches what is saved', async () => {
    await renderPage();
    expect(saveButton()).toBeDisabled();
  });

  it('enables once the hourly rate changes', async () => {
    await renderPage();
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '75' } });
    expect(saveButton()).toBeEnabled();
  });

  it('enables once an appointment duration is toggled', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: '30 minutes, selected' }));
    expect(saveButton()).toBeEnabled();
  });

  it('enables once time slots change', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Clear All/i }));
    expect(saveButton()).toBeEnabled();
  });

  it('goes back to disabled when an edit is undone', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: '30 minutes, selected' }));
    expect(saveButton()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '30 minutes' }));
    expect(saveButton()).toBeDisabled();
  });

  it('ignores buffer time, which is never saved', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: '30 min' }));
    expect(saveButton()).toBeDisabled();
  });

  it('ignores minimum booking notice, which saves on its own', async () => {
    vi.mocked(doSetExpertBookingNoticeHours).mockResolvedValue({ result: {} });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: '48 hours' }));
    await waitFor(() => {
      expect(screen.getByText(/Minimum booking notice set to 48 hours/i)).toBeInTheDocument();
    });
    expect(saveButton()).toBeDisabled();
  });

  it('does not submit when clicked while disabled', async () => {
    await renderPage();
    fireEvent.click(saveButton());
    expect(doUpdateTimeSlots).not.toHaveBeenCalled();
    expect(doUpdateProfile).not.toHaveBeenCalled();
  });

  it('keeps the hint bar, without the button inside it', async () => {
    await renderPage();
    const hint = screen.getByText(/Save your hourly rate and weekly time slots/i);
    expect(hint).toBeInTheDocument();
    expect(hint.className).not.toMatch(/\bhidden\b/);
    expect(hint.parentElement?.contains(saveButton())).toBe(false);
  });
});
