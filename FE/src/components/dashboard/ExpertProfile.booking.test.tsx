import { describe, expect, it, vi, beforeEach } from 'vitest';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { Provider } from 'react-redux';

import { configureStore } from '@reduxjs/toolkit';

import ExpertProfile from './ExpertProfile';



vi.mock('../../api/api', () => ({
  getExpertById: vi.fn(),
  createGroupChatByUser: vi.fn(),
  profileImageFetch: vi.fn(async () => null),
}));



vi.mock('./StudentExpertBookingPicker', () => ({

  default: ({ onSlotSelected, expert }: any) => (

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

    expect(String(window.location.href)).not.toContain('customerdashboard/search');
    expect(await screen.findByTestId('student-checkout')).toBeInTheDocument();
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

});

