import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import { Provider } from 'react-redux';

import { configureStore } from '@reduxjs/toolkit';

import ExpertProfile from './ExpertProfile';



vi.mock('../../api/api', () => ({
  getExpertById: vi.fn(),
  createGroupChatByUser: vi.fn(),
  profileImageFetch: vi.fn(async () => null),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  registerForSeminar: vi.fn(),
}));



vi.mock('./StudentExpertBookingPicker', () => ({

  default: ({ onSlotSelected, onFilterSlotConfirmed, onViewerTimeZoneChange, expert }: any) => {

    React.useEffect(() => {
      onViewerTimeZoneChange?.('UTC');
    }, [onViewerTimeZoneChange]);

    return (
    <div data-testid="slot-picker">

      slots:{expert?.timeSlots?.length ?? 0}

      <button

        type="button"

        data-testid="pick-slot"

        onClick={() =>

          onSlotSelected(

            new Date('2026-06-15T14:00:00.000Z'),

            new Date('2026-06-15T15:00:00.000Z'),

            60,

          )

        }

      >

        Pick slot

      </button>

      <button

        type="button"

        data-testid="pick-slot-filter"

        onClick={() => {

          onSlotSelected(

            new Date('2026-06-15T09:00:00.000Z'),

            new Date('2026-06-15T10:00:00.000Z'),

            60,

          );

          onFilterSlotConfirmed?.();

        }}

      >

        Pick slot with filter

      </button>

    </div>
    );
  },

}));



vi.mock('./StudentBookingCheckout', () => ({

  default: ({ onPaymentSuccess, onCancel, cancelLabel = 'Cancel pay' }: any) => (

    <div data-testid="student-checkout">

      <button type="button" onClick={() => onPaymentSuccess('pi_test')}>

        Pay mock

      </button>

      <button type="button" onClick={onCancel}>

        {cancelLabel}

      </button>

    </div>

  ),

  completeStudentBookingFromStorage: vi.fn(),

}));



import { getExpertById, createGroupChatByUser } from '../../api/api';



const mentor = {

  id: 'expert-1',

  name: 'Dr. Smith',

  title: 'Professor',

  institution: 'University',

  field: 'CS',

  experience: '10',

  services: ['1-on-1'],

  image: null,

  isNew: false,

};



const store = configureStore({

  reducer: {

    auth: () => ({

      userDetails: { _id: 'student-1', username: 'student', timeZone: 'UTC' },

    }),

  },

});



const fillBookingTitle = () => {
  fireEvent.change(screen.getByPlaceholderText(/PhD Application Advice/i), {
    target: { value: 'PhD application advice session' },
  });
};

describe('ExpertProfile booking', () => {

  beforeEach(() => {

    vi.clearAllMocks();

    vi.mocked(getExpertById).mockResolvedValue({

      result: {

        _id: 'expert-1',

        timeSlots: [18, 19, 20],

        price: 60,

        timeZone: 'UTC',

        events: [],

        groupChats: [],

        pendingGroupChats: [],

      },

    });

    vi.mocked(createGroupChatByUser).mockResolvedValue({
      result: { _id: 'student-1', groupChats: [] },
    });
  });



  it('loads expert and renders slot picker with API slots', async () => {

    render(

      <Provider store={store}>

        <ExpertProfile mentor={mentor} onBack={vi.fn()} />

      </Provider>,

    );



    await waitFor(() => {

      expect(getExpertById).toHaveBeenCalledWith('expert-1');

    });



    expect(await screen.findByTestId('slot-picker')).toHaveTextContent('slots:3');

  });



  it('shows message when expert has no slots', async () => {

    vi.mocked(getExpertById).mockResolvedValue({

      result: { _id: 'expert-1', timeSlots: [], price: 60 },

    });



    render(

      <Provider store={store}>

        <ExpertProfile mentor={mentor} onBack={vi.fn()} />

      </Provider>,

    );



    expect(

      await screen.findByText(/has not published availability/i),

    ).toBeInTheDocument();

  });



  it('does not redirect to legacy customer dashboard', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));

    // Review step first, with Change time, before continuing to payment.
    expect(await screen.findByText('Review your booking')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change time/i })).toBeInTheDocument();
    fillBookingTitle();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByTestId('student-checkout')).toBeInTheDocument();

    expect(String(window.location.href)).not.toContain('customerdashboard/search');
  });



  it('opens checkout directly without the old confirmation modal', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));
    await screen.findByText('Review your booking');
    fillBookingTitle();
    fireEvent.click(await screen.findByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByTestId('student-checkout')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-confirmation-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /proceed to payment/i })).not.toBeInTheDocument();
  });



  it('advances to success after checkout without leaving student flow', async () => {

    render(

      <Provider store={store}>

        <ExpertProfile mentor={mentor} onBack={vi.fn()} />

      </Provider>,

    );



    await screen.findByTestId('slot-picker');

    fireEvent.click(screen.getByTestId('pick-slot'));

    await screen.findByText('Review your booking');

    fillBookingTitle();

    fireEvent.click(await screen.findByRole('button', { name: /continue to payment/i }));

    fireEvent.click(await screen.findByRole('button', { name: /pay mock/i }));



    await waitFor(() => {

      expect(createGroupChatByUser).toHaveBeenCalled();

    });



    expect(await screen.findByText(/request sent/i)).toBeInTheDocument();

  });



  it('shows success when paymentReturnSuccess is set', async () => {

    render(

      <Provider store={store}>

        <ExpertProfile mentor={mentor} onBack={vi.fn()} paymentReturnSuccess />

      </Provider>,

    );



    expect(await screen.findByText(/request sent/i)).toBeInTheDocument();

  });



  it('shows a single Rates section with API price and no duplicate Rate card', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await waitFor(() => {
      expect(getExpertById).toHaveBeenCalledWith('expert-1');
    });

    expect(screen.getByRole('heading', { name: 'Rates' })).toBeInTheDocument();
    expect(screen.queryByText(/^Rate$/)).not.toBeInTheDocument();
    expect(await screen.findByText('$60.00')).toBeInTheDocument();
  });



  it('shows picked-slot sub-line in Rates after selecting a 1:1 slot', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));

    const ratesSection = () =>
      screen.getByRole('heading', { name: 'Rates' }).closest('section') as HTMLElement;

    expect(await within(ratesSection()).findByText(/60 min · \$60\.00 ·/i)).toBeInTheDocument();
    expect(within(ratesSection()).getByText(/2:00 PM.*3:00 PM.*\(UTC\)/i)).toBeInTheDocument();
  });



  it('shows booking summary When in viewer timezone not browser local', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));

    const summarySection = (await screen.findByText('Review your booking')).closest('div') as HTMLElement;
    expect(within(summarySection).getByText(/2:00 PM.*3:00 PM.*\(UTC\)/i)).toBeInTheDocument();
  });



  it('refetches expert price when Change time is clicked', async () => {
    vi.mocked(getExpertById)
      .mockResolvedValueOnce({
        result: {
          _id: 'expert-1',
          timeSlots: [18, 19, 20],
          price: 60,
          timeZone: 'UTC',
          events: [],
          groupChats: [],
          pendingGroupChats: [],
        },
      })
      .mockResolvedValue({
        result: {
          _id: 'expert-1',
          timeSlots: [18, 19, 20],
          price: 75,
          timeZone: 'UTC',
          events: [],
          groupChats: [],
          pendingGroupChats: [],
        },
      });

    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));
    await screen.findByText('Review your booking');

    const ratesSection = () =>
      screen.getByRole('heading', { name: 'Rates' }).closest('section') as HTMLElement;

    expect(within(ratesSection()).getByText('$60.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /change time/i }));

    await waitFor(() => {
      expect(getExpertById).toHaveBeenCalledTimes(2);
    });

    expect(await within(ratesSection()).findByText('$75.00')).toBeInTheDocument();
  });



  it('locks appointment duration after a time slot is selected', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));

    const summarySection = () =>
      screen.getByText('Review your booking').closest('div') as HTMLElement;

    await screen.findByText('Review your booking');
    expect(within(summarySection()).getByText('60 min')).toBeInTheDocument();
    expect(within(summarySection()).getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByText(/fixed for this booking/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '90 min' })).not.toBeInTheDocument();
  });

  it('unlocks appointment duration after Change time', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));
    await screen.findByText('Review your booking');
    fireEvent.click(screen.getByRole('button', { name: /change time/i }));

    const btn90 = screen.getByRole('button', { name: '90 min' });
    expect(btn90).not.toBeDisabled();
    fireEvent.click(btn90);
    expect(btn90).toHaveClass('bg-[#1A3A4A]');
  });

  it('only shows appointment durations the expert offers', async () => {
    vi.mocked(getExpertById).mockResolvedValue({
      result: {
        _id: 'expert-1',
        timeSlots: [18, 19, 20],
        price: 60,
        timeZone: 'UTC',
        appointmentDurations: [60, 90],
        events: [],
        groupChats: [],
        pendingGroupChats: [],
      },
    });

    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await waitFor(() => {
      expect(getExpertById).toHaveBeenCalledWith('expert-1');
    });

    expect(await screen.findByRole('button', { name: '60 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 min' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '30 min' })).not.toBeInTheDocument();
  });



  it('auto-advances to review when filter-by-time slot is confirmed', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot-filter'));

    expect(await screen.findByText('Review your booking')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review booking/i })).not.toBeInTheDocument();
  });

});
