import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StudentExpertBookingPicker from './StudentExpertBookingPicker';

const blockedDate = new Date(2026, 5, 15, 12, 0, 0, 0);
const selectableDayStart = new Date(2026, 5, 15, 0, 0, 0, 0);
const selectableDayEnd = new Date(2026, 5, 16, 0, 0, 0, 0);

vi.mock('react-big-calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-big-calendar')>();
  return {
    ...actual,
    Calendar: ({ components, onSelectSlot }: any) => (
      <div data-testid="mock-calendar">
        {components?.toolbar ? (
          <components.toolbar label="May 2026" onNavigate={vi.fn()} />
        ) : null}
        {components?.month?.dateHeader ? (
          components.month.dateHeader({
            label: '15',
            date: blockedDate,
            drilldownView: 'day',
            onDrillDown: vi.fn(),
          })
        ) : null}
        {components?.dateCellWrapper ? (
          components.dateCellWrapper({
            value: blockedDate,
            children: <div className="rbc-day-bg" data-testid="day-bg" />,
          })
        ) : null}
        <button
          type="button"
          data-testid="mock-select-day"
          onClick={() =>
            onSelectSlot?.({ start: selectableDayStart, end: selectableDayEnd })
          }
        >
          Select day
        </button>
      </div>
    ),
  };
});

const expert = {
  _id: 'expert-1',
  timeSlots: [18, 19, 20],
  price: 60,
  timeZone: 'UTC',
  bookingNoticeHours: 24,
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

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('StudentExpertBookingPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(screen.getByRole('button', { name: '15' })).toHaveClass('cursor-pointer');
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
      'Jane Doe is not available on this date',
    );
    expect(dayBtn).toHaveClass('cursor-not-allowed');
  });

  it('shows hover title on blocked days even without recurring slots', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{
            ...expert,
            timeSlots: [],
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
      'Jane Doe is not available on this date',
    );
    expect(dayBtn).toHaveClass('cursor-not-allowed');
  });

  it('wraps blocked day background with full-cell hover title', () => {
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

    const wrapper = screen.getByTestId('day-bg').parentElement;
    expect(wrapper).toHaveAttribute(
      'title',
      'Jane Doe is not available on this date',
    );
    expect(wrapper).toHaveClass('h-full', 'w-full');
  });

  it('confirms filter-by-time slot on day click and shows selection banner', () => {
    const onSlotSelected = vi.fn();
    const onFilterSlotConfirmed = vi.fn();

    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={expert}
          onSlotSelected={onSlotSelected}
          onFilterSlotConfirmed={onFilterSlotConfirmed}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /filter by time/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Any time' }));
    fireEvent.click(screen.getByRole('option', { name: '09:00 AM' }));

    fireEvent.click(screen.getByTestId('mock-select-day'));

    expect(onSlotSelected).toHaveBeenCalledTimes(1);
    expect(onFilterSlotConfirmed).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('selection-confirmed-banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15, selected' })).toBeInTheDocument();
  });

  it('marks filtered 9 AM unavailable at 90 min when only two half-hour blocks exist', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{ ...expert, timeSlots: [18, 19] }}
          selectedDurationMinutes={90}
          onSlotSelected={vi.fn()}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /filter by time/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Any time' }));
    fireEvent.click(screen.getByRole('option', { name: '09:00 AM' }));

    expect(screen.getByRole('button', { name: '15' })).toHaveClass('cursor-not-allowed');
  });

  it('marks filtered 9 AM available at 60 min when two consecutive blocks exist', () => {
    const onSlotSelected = vi.fn();

    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{ ...expert, timeSlots: [18, 19] }}
          selectedDurationMinutes={60}
          onSlotSelected={onSlotSelected}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /filter by time/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Any time' }));
    fireEvent.click(screen.getByRole('option', { name: '09:00 AM' }));

    const dayBtn = screen.getByRole('button', { name: '15' });
    expect(dayBtn).toHaveClass('cursor-pointer');

    fireEvent.click(screen.getByTestId('mock-select-day'));
    expect(onSlotSelected).toHaveBeenCalledTimes(1);
  });
});
