import { describe, expect, it, vi, beforeEach } from 'vitest';

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import { Provider } from 'react-redux';

import { configureStore } from '@reduxjs/toolkit';

import ExpertProfile from './ExpertProfile';



vi.mock('../../api/api', () => ({
  getExpertById: vi.fn(),
  createGroupChatByUser: vi.fn(),
  profileImageFetch: vi.fn(async () => null),
}));



vi.mock('./StudentExpertBookingPicker', () => ({

  default: ({ onSlotSelected, onFilterSlotConfirmed, expert }: any) => (

    <div data-testid="slot-picker">

      slots:{expert?.timeSlots?.length ?? 0}

      <button

        type="button"

        data-testid="pick-slot"

        onClick={() =>

          onSlotSelected(

            new Date('2026-06-15T14:00:00'),

            new Date('2026-06-15T15:00:00'),

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

            new Date('2026-06-15T09:00:00'),

            new Date('2026-06-15T10:00:00'),

            60,

          );

          onFilterSlotConfirmed?.();

        }}

      >

        Pick slot with filter

      </button>

    </div>

  ),

}));



vi.mock('./StudentBookingCheckout', () => ({

  default: ({ onPaymentSuccess, onCancel }: any) => (

    <div data-testid="student-checkout">

      <button type="button" onClick={() => onPaymentSuccess('pi_test')}>

        Pay mock

      </button>

      <button type="button" onClick={onCancel}>

        Cancel pay

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
    fireEvent.click(screen.getByRole('button', { name: /review booking/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByTestId('booking-confirmation-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('student-checkout')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /proceed to payment/i }));

    expect(String(window.location.href)).not.toContain('customerdashboard/search');
    expect(await screen.findByTestId('student-checkout')).toBeInTheDocument();
  });



  it('shows confirmation modal with booking details before checkout', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));
    fireEvent.click(screen.getByRole('button', { name: /review booking/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    const modal = await screen.findByTestId('booking-confirmation-modal');
    expect(within(modal).getByText('Dr. Smith')).toBeInTheDocument();
    expect(within(modal).getByText('1:1 session')).toBeInTheDocument();
    expect(within(modal).getByText('60 min')).toBeInTheDocument();
    expect(within(modal).getByText('$60')).toBeInTheDocument();
    expect(within(modal).getByText('UTC')).toBeInTheDocument();
    expect(screen.queryByTestId('student-checkout')).not.toBeInTheDocument();
  });



  it('advances to success after checkout without leaving student flow', async () => {

    render(

      <Provider store={store}>

        <ExpertProfile mentor={mentor} onBack={vi.fn()} />

      </Provider>,

    );



    await screen.findByTestId('slot-picker');

    fireEvent.click(screen.getByTestId('pick-slot'));

    fireEvent.click(screen.getByRole('button', { name: /review booking/i }));

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
    fireEvent.click(screen.getByRole('button', { name: /proceed to payment/i }));

    fireEvent.click(screen.getByRole('button', { name: /pay mock/i }));



    await waitFor(() => {

      expect(createGroupChatByUser).toHaveBeenCalled();

    });



    expect(await screen.findByText(/session booked/i)).toBeInTheDocument();

  });



  it('shows success when paymentReturnSuccess is set', async () => {

    render(

      <Provider store={store}>

        <ExpertProfile mentor={mentor} onBack={vi.fn()} paymentReturnSuccess />

      </Provider>,

    );



    expect(await screen.findByText(/session booked/i)).toBeInTheDocument();

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
    expect(await screen.findByText('$60')).toBeInTheDocument();
  });



  it('shows picked-slot sub-line in Rates after selecting a 1:1 slot', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));

    expect(await screen.findByText(/60 min · \$60 ·/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /review booking/i }));

    const ratesSection = () =>
      screen.getByRole('heading', { name: 'Rates' }).closest('section') as HTMLElement;

    expect(within(ratesSection()).getByText('$60')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /change time/i }));

    await waitFor(() => {
      expect(getExpertById).toHaveBeenCalledTimes(2);
    });

    expect(await within(ratesSection()).findByText('$75')).toBeInTheDocument();
  });



  it('updates review total when session length changes', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot'));
    fireEvent.click(screen.getByRole('button', { name: /review booking/i }));

    const summarySection = () =>
      screen.getByText('Booking summary').closest('div') as HTMLElement;

    expect(within(summarySection()).getByText('60 min')).toBeInTheDocument();
    expect(within(summarySection()).getByText('$60')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '90 min' }));

    expect(within(summarySection()).getByText('90 min')).toBeInTheDocument();
    expect(within(summarySection()).getByText('$90')).toBeInTheDocument();
  });



  it('auto-advances to review when filter-by-time slot is confirmed', async () => {
    render(
      <Provider store={store}>
        <ExpertProfile mentor={mentor} onBack={vi.fn()} />
      </Provider>,
    );

    await screen.findByTestId('slot-picker');
    fireEvent.click(screen.getByTestId('pick-slot-filter'));

    expect(await screen.findByText('Booking summary')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review booking/i })).not.toBeInTheDocument();
  });

});

