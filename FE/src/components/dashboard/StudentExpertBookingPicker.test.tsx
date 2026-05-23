import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentExpertBookingPicker from './StudentExpertBookingPicker';

vi.mock('react-big-calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-big-calendar')>();
  return {
    ...actual,
    Calendar: ({ components }: any) => (
      <div data-testid="mock-calendar">
        {components?.toolbar ? (
          <components.toolbar label="May 2026" onNavigate={vi.fn()} />
        ) : null}
        {components?.month?.dateHeader ? (
          <components.month.dateHeader
            label="15"
            date={new Date('2026-06-15T12:00:00.000Z')}
            drilldownView="day"
            onDrillDown={vi.fn()}
          />
        ) : null}
      </div>
    ),
  };
});

const expert = {
  _id: 'expert-1',
  timeSlots: [18, 19, 20],
  price: 60,
  timeZone: 'UTC',
  events: [],
  groupChats: [],
  pendingGroupChats: [],
};

const store = configureStore({
  reducer: {
    auth: () => ({
      userDetails: { _id: 's1', timeZone: 'UTC' },
    }),
  },
});

describe('StudentExpertBookingPicker', () => {
  it('renders custom toolbar with Back/Next and no native time-filter select', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker expert={expert} onSlotSelected={vi.fn()} />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows hover title on blocked days', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{
            ...expert,
            firstName: 'Jane',
            lastName: 'Doe',
            blockedBookingDates: ['2026-06-15'],
          }}
          onSlotSelected={vi.fn()}
        />
      </Provider>,
    );

    const dayBtn = screen.getByRole('button', { name: '15' });
    expect(dayBtn).toHaveAttribute(
      'title',
      'Jane Doe is not available on this day',
    );
  });
});
