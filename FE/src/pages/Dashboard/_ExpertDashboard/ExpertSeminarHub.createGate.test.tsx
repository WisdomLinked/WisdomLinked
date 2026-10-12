import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import ExpertSeminarHub from './ExpertSeminarHub';

vi.mock('./seminar', () => ({ default: () => <div data-testid="seminar-form" /> }));
vi.mock('../../../api/api', () => ({
  deleteGroup: vi.fn(),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  profileImageFetch: vi.fn(async () => null),
  getSeminarSeatRequests: vi.fn(async () => ({ requests: [] })),
  approveSeminarSeatRequest: vi.fn(),
  rejectSeminarSeatRequest: vi.fn(),
}));
vi.mock('../../../actions/authActions', () => ({ updateMe: () => ({ type: 'test/refresh' }) }));
vi.mock('../../../actions/appActions', () => ({ SetLoadingStatus: vi.fn() }));
vi.mock('../../../utils/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const MESSAGE = 'You need to complete your profile setup first.';

const expert = (overrides: Record<string, unknown> = {}) => ({
  _id: 'host',
  role: 'expert',
  groupChats: [],
  events: [],
  price: [25],
  appointmentDurations: [30, 60],
  bufferMinutes: 15,
  bookingNoticeHours: 24,
  availabilityMode: 'common',
  timeSlots: [18, 19],
  ...overrides,
});

function show(userDetails: any) {
  const store = configureStore({
    reducer: {
      auth: (state = { userDetails }, action: any) =>
        action.type === 'test/setUser' ? { userDetails: action.payload } : state,
    },
  });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ExpertSeminarHub />
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

const createButton = () => screen.getByRole('button', { name: /create seminar/i });

describe('Create seminar is gated on profile setup', () => {
  it('opens the seminar form for a fully set-up expert', () => {
    show(expert());
    fireEvent.click(createButton());
    expect(screen.getByTestId('seminar-form')).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('stays on the list and shows the red message when setup is unfinished', () => {
    show(expert({ bufferMinutes: undefined }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(createButton());
    expect(screen.queryByTestId('seminar-form')).not.toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(MESSAGE);
    expect(alert).toHaveClass('text-rose-600');
    expect(alert.className).not.toMatch(/text-red-\d/);
  });

  it('lets the expert in once setup is finished, without a reload', () => {
    const store = show(expert({ timeSlots: [] }));
    fireEvent.click(createButton());
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);

    act(() => {
      store.dispatch({ type: 'test/setUser', payload: expert() });
    });
    fireEvent.click(createButton());
    expect(screen.getByTestId('seminar-form')).toBeInTheDocument();
  });
});
