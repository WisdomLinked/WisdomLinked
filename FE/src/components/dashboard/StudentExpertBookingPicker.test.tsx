import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest';
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
    // Pin "now" so the 24h booking-notice window doesn't make the fixture's
    // June 15 2026 day flaky depending on when the suite runs.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(wrapper).toHaveClass('relative', 'h-full');
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

  it('limits modal duration options to allowed durations', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={expert}
          allowedDurationMinutes={[60, 90]}
          onSlotSelected={vi.fn()}
        />
      </Provider>,
    );

    fireEvent.click(screen.getByTestId('mock-select-day'));

    expect(screen.getByText('Appointment Duration')).toBeInTheDocument();
    expect(screen.queryByText(/30 min/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/60 min/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/90 min/).length).toBeGreaterThan(0);
  });

  it('shows selection banner when confirmedSlotStart prop is provided', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={expert}
          confirmedSlotStart={new Date('2026-06-15T14:00:00.000Z')}
          selectedDurationMinutes={60}
          onSlotSelected={vi.fn()}
        />
      </Provider>,
    );

    const banner = screen.getByTestId('selection-confirmed-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Selected appointment');
    expect(banner).toHaveTextContent('60 min');
  });

  it('blocks a day when an existing booking overlaps its slots', () => {
    const onSlotSelected = vi.fn();

    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{
            ...expert,
            groupChats: [
              {
                _id: 'gc-overlap',
                name: 'Booked session',
                type: 'individual',
                // Spans well beyond June 15 in any viewer time zone, so every
                // slot on the 15th conflicts and the day must become unavailable.
                start: '2026-06-14T00:00:00.000Z',
                end: '2026-06-17T00:00:00.000Z',
              },
            ],
          }}
          onSlotSelected={onSlotSelected}
        />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: '15' })).toHaveClass(
      'cursor-not-allowed',
    );

    // Clicking an unavailable day must not select a slot.
    fireEvent.click(screen.getByTestId('mock-select-day'));
    expect(onSlotSelected).not.toHaveBeenCalled();
  });

  it('keeps a day available when bookings fall on other days', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{
            ...expert,
            groupChats: [
              {
                _id: 'gc-other-day',
                name: 'Unrelated session',
                type: 'seminar',
                start: '2026-06-20T00:00:00.000Z',
                end: '2026-06-20T01:00:00.000Z',
              },
            ],
          }}
          onSlotSelected={vi.fn()}
        />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: '15' })).toHaveClass(
      'cursor-pointer',
    );
  });

  it('ignores declined bookings when computing availability', () => {
    render(
      <Provider store={store}>
        <StudentExpertBookingPicker
          expert={{
            ...expert,
            groupChats: [
              {
                _id: 'gc-declined',
                name: 'Declined session',
                type: 'individual',
                status: 'declined',
                start: '2026-06-14T00:00:00.000Z',
                end: '2026-06-17T00:00:00.000Z',
              },
            ],
          }}
          onSlotSelected={vi.fn()}
        />
      </Provider>,
    );

    // A declined booking overlapping the 15th must not block it.
    expect(screen.getByRole('button', { name: '15' })).toHaveClass(
      'cursor-pointer',
    );
  });
});
