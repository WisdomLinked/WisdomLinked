import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import ExpertSetupCard from './ExpertSetupCard';
import { SETUP_STEPS } from './setupSteps';

const api = vi.hoisted(() => ({
  doUpdateProfile: vi.fn(),
  doSetExpertBookingNoticeHours: vi.fn(),
}));
vi.mock('../../../api/api', () => api);

let savedUser: Record<string, unknown> = {};
vi.mock('../../../actions/authActions', () => ({
  updateMe: () => (dispatch: any) => dispatch({ type: 'auth/set', payload: savedUser }),
}));

const NEW_EXPERT = {
  _id: 'e1',
  role: 'expert',
  price: [],
  appointmentDurations: [30, 60, 90],
  bookingNoticeHours: 24,
  timeSlots: [],
  availabilityMode: 'common',
};

function renderCard(user: Record<string, unknown>, onOpenAvailability = vi.fn()) {
  savedUser = user;
  const auth = createSlice({
    name: 'auth',
    initialState: { userDetails: user },
    reducers: {
      set: (state, action: PayloadAction<Record<string, unknown>>) => {
        state.userDetails = action.payload;
      },
    },
  });
  const store = configureStore({ reducer: { auth: auth.reducer } });
  const view = render(
    <Provider store={store}>
      <ExpertSetupCard onOpenAvailability={onOpenAvailability} />
    </Provider>,
  );
  return { ...view, onOpenAvailability };
}

const row = (title: string) => screen.getByRole('heading', { name: title }).closest('li') as HTMLElement;
const progress = () => screen.getByRole('progressbar', { name: 'Setup progress' });

describe('setup step config', () => {
  it('derives completion and summaries from saved availability', () => {
    const done = {
      price: [100],
      appointmentDurations: [30, 60],
      bufferMinutes: 15,
      bookingNoticeHours: 48,
      timeSlots: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
      availabilityMode: 'common' as const,
    };
    expect(SETUP_STEPS.every((s) => s.isComplete(done))).toBe(true);
    expect(SETUP_STEPS.map((s) => s.getSummary(done))).toEqual([
      '$100 per hour',
      '30 min, 60 min',
      '15 min buffer · 48 hours notice',
      '8 hours per day',
    ]);
  });

  it('treats a rate under $5, an unset buffer, and no slots as incomplete', () => {
    const [rate, , rules, slots] = SETUP_STEPS;
    expect(rate.isComplete({ price: [4] })).toBe(false);
    expect(rules.isComplete({ bookingNoticeHours: 24 })).toBe(false);
    expect(rules.isComplete({ bookingNoticeHours: 24, bufferMinutes: 0 })).toBe(true);
    expect(slots.isComplete({ timeSlots: [] })).toBe(false);
  });

  it('reads weekday-specific slots in daily mode', () => {
    const slots = SETUP_STEPS[3];
    const a = { availabilityMode: 'daily' as const, weeklyTimeSlots: { Mon: [18, 19, 20, 21], Tue: [18, 19] } };
    expect(slots.isComplete(a)).toBe(true);
    expect(slots.getSummary(a)).toBe('3 hours a week across 2 days');
  });
});

describe('ExpertSetupCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing once every step is saved', () => {
    const { container } = renderCard({
      ...NEW_EXPERT,
      price: [50],
      bufferMinutes: 15,
      timeSlots: [18, 19],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for non-experts', () => {
    const { container } = renderCard({ ...NEW_EXPERT, role: 'customer' });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows progress from saved data and highlights the first incomplete step', () => {
    renderCard(NEW_EXPERT);
    expect(screen.getByText('Set up your availability')).toBeInTheDocument();
    expect(progress()).toHaveAttribute('aria-valuenow', '1');
    expect(progress()).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByText('1 of 4 complete')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    expect(row('Hourly rate').className).toMatch(/bg-\[#e8f0f8\]/);
    expect(within(row('Session lengths')).getByText('30 min, 60 min, 90 min')).toBeInTheDocument();
    expect(within(row('Session lengths')).getByRole('button', { name: /^Edit/ })).toBeInTheDocument();
    expect(within(row('Weekly time slots')).getByRole('button', { name: /Go to Availability/ })).toBeInTheDocument();
  });

  it('collapses and expands the step list', async () => {
    const user = userEvent.setup();
    renderCard(NEW_EXPERT);
    const toggle = screen.getByRole('button', { name: 'Hide setup steps' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(screen.queryByRole('heading', { name: 'Hourly rate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show setup steps' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('saves the rate inline, refreshes, and collapses the row', async () => {
    const user = userEvent.setup();
    api.doUpdateProfile.mockResolvedValue(true);
    renderCard(NEW_EXPERT);

    const setUp = screen.getByRole('button', { name: 'Set up: Hourly rate' });
    await user.click(setUp);
    expect(setUp).toHaveAttribute('aria-expanded', 'true');

    const save = screen.getByRole('button', { name: 'Save rate' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Custom rate'), '3');
    expect(screen.getByText('Hourly rate should be at least $5.')).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /\$100 \/hr/ }));
    expect(screen.getByRole('button', { name: /\$100 \/hr/ })).toHaveAttribute('aria-pressed', 'true');
    savedUser = { ...NEW_EXPERT, price: [100] };
    await user.click(save);

    expect(api.doUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ price: 100, timeZone: expect.any(String) }),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save rate' })).not.toBeInTheDocument());
    expect(within(row('Hourly rate')).getByText('$100 per hour')).toBeInTheDocument();
    expect(progress()).toHaveAttribute('aria-valuenow', '2');
  });

  it('keeps the row open when a save fails', async () => {
    const user = userEvent.setup();
    api.doUpdateProfile.mockResolvedValue(false);
    renderCard(NEW_EXPERT);
    await user.click(screen.getByRole('button', { name: 'Set up: Hourly rate' }));
    await user.click(screen.getByRole('button', { name: /\$50 \/hr/ }));
    await user.click(screen.getByRole('button', { name: 'Save rate' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save rate' })).toBeEnabled());
    expect(progress()).toHaveAttribute('aria-valuenow', '1');
  });

  it('opens only one inline row at a time', async () => {
    const user = userEvent.setup();
    renderCard(NEW_EXPERT);
    await user.click(screen.getByRole('button', { name: 'Set up: Hourly rate' }));
    await user.click(screen.getByRole('button', { name: 'Set up: Booking rules' }));
    expect(screen.queryByRole('button', { name: 'Save rate' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeInTheDocument();
  });

  it('requires a session length before saving', async () => {
    const user = userEvent.setup();
    renderCard(NEW_EXPERT);
    await user.click(screen.getByRole('button', { name: /^Edit: Session lengths/ }));
    for (const d of ['30 min', '60 min', '90 min']) {
      await user.click(screen.getByRole('button', { name: d }));
    }
    expect(screen.getByRole('button', { name: 'Save lengths' })).toBeDisabled();
  });

  it('saves booking rules through the profile and notice endpoints', async () => {
    const user = userEvent.setup();
    api.doUpdateProfile.mockResolvedValue(true);
    api.doSetExpertBookingNoticeHours.mockResolvedValue({ status: 'SUCCESS' });
    renderCard(NEW_EXPERT);

    await user.click(screen.getByRole('button', { name: 'Set up: Booking rules' }));
    const save = screen.getByRole('button', { name: 'Save rules' });
    expect(save).toBeDisabled();
    await user.click(within(screen.getByRole('group', { name: 'Buffer time' })).getByRole('button', { name: '15 min' }));
    await user.click(screen.getByRole('button', { name: '48 hours' }));
    savedUser = { ...NEW_EXPERT, bufferMinutes: 15, bookingNoticeHours: 48 };
    await user.click(save);

    expect(api.doUpdateProfile).toHaveBeenCalledWith({ bufferMinutes: 15 });
    expect(api.doSetExpertBookingNoticeHours).toHaveBeenCalledWith(48);
    expect(await within(row('Booking rules')).findByText('15 min buffer · 48 hours notice')).toBeInTheDocument();
  });

  it('sends the time-slot step to the Availability page', async () => {
    const user = userEvent.setup();
    const { onOpenAvailability } = renderCard(NEW_EXPERT);
    await user.click(screen.getByRole('button', { name: /Go to Availability/ }));
    expect(onOpenAvailability).toHaveBeenCalledTimes(1);
  });
});
