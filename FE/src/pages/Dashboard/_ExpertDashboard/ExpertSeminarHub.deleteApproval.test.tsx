import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import ExpertSeminarHub from './ExpertSeminarHub';
import { deleteGroup } from '../../../api/api';

vi.mock('./seminar', () => ({ default: () => <div data-testid="seminar-form" /> }));
vi.mock('../../../api/api', () => ({
  deleteGroup: vi.fn(async () => ({ success: true })),
  getMySeatRequests: vi.fn(async () => ({ result: [] })),
  profileImageFetch: vi.fn(async () => null),
  getSeminarSeatRequests: vi.fn(async () => ({ requests: [] })),
  approveSeminarSeatRequest: vi.fn(),
  rejectSeminarSeatRequest: vi.fn(),
}));
vi.mock('../../../actions/authActions', () => ({ updateMe: () => ({ type: 'test/refresh' }) }));
vi.mock('../../../actions/appActions', () => ({ SetLoadingStatus: vi.fn() }));
vi.mock('../../../utils/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const remove = vi.mocked(deleteGroup);
const APPROVAL = /I have approval from all the participants to delete this seminar/;

const seminar = (participants: string[], extra: Record<string, unknown> = {}) => ({
  _id: 'sem1',
  name: 'Career planning',
  description: 'Plan your next step.',
  type: 'seminar',
  status: 'active',
  admin: 'host',
  participants,
  start: '2099-10-08T18:00:00.000Z',
  end: '2099-10-08T19:00:00.000Z',
  duration: 60,
  price: 25,
  ...extra,
});

function openDetail(groupChat: any) {
  const userDetails = {
    _id: 'host',
    role: 'expert',
    groupChats: [groupChat],
    events: [],
    price: [25],
    appointmentDurations: [30, 60],
    bufferMinutes: 15,
    bookingNoticeHours: 24,
    availabilityMode: 'common',
    timeSlots: [18, 19],
  };
  const store = configureStore({ reducer: { auth: () => ({ userDetails }) } });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ExpertSeminarHub />
      </MemoryRouter>
    </Provider>,
  );
  fireEvent.click(screen.getAllByRole('button', { name: /view details/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
}

const approvalBox = () => screen.getByRole('checkbox', { name: APPROVAL });

describe('deleting a seminar with students from the seminar page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts unticked with Yes, delete disabled, and deletes nothing until ticked', () => {
    openDetail(seminar(['host', 'student-1']));
    expect(approvalBox()).not.toBeChecked();
    const yes = screen.getByRole('button', { name: 'Yes, delete' });
    expect(yes).toBeDisabled();
    fireEvent.click(yes);
    expect(remove).not.toHaveBeenCalled();
  });

  it('ticks when the approval text is clicked, and unticking disables delete again', () => {
    openDetail(seminar(['host', 'student-1']));
    fireEvent.click(screen.getByText(APPROVAL));
    expect(approvalBox()).toBeChecked();
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeEnabled();
    fireEvent.click(approvalBox());
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeDisabled();
  });

  it('deletes the seminar once approval is ticked', async () => {
    openDetail(seminar(['host', 'student-1']));
    fireEvent.click(approvalBox());
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ groupChatId: 'sem1', scope: 'series' }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('asks again after Cancel', () => {
    openDetail(seminar(['host', 'student-1']));
    fireEvent.click(approvalBox());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('checkbox', { name: APPROVAL })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(approvalBox()).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeDisabled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('locks both recurring delete options until approval is ticked', async () => {
    openDetail(seminar(['host', 'student-1'], { isRecurring: true }));
    const onlyThis = screen.getByRole('button', { name: 'Delete only this session' });
    const allUpcoming = screen.getByRole('button', { name: 'Delete all upcoming sessions' });
    expect(onlyThis).toBeDisabled();
    expect(allUpcoming).toBeDisabled();
    fireEvent.click(onlyThis);
    fireEvent.click(allUpcoming);
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(approvalBox());
    expect(onlyThis).toBeEnabled();
    expect(allUpcoming).toBeEnabled();
    fireEvent.click(onlyThis);
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ groupChatId: 'sem1', scope: 'occurrence' }));
  });

  it('keeps the usual confirmation, with no checkbox, when no students have joined', async () => {
    openDetail(seminar(['host']));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Delete this seminar\? It will be removed from everyone’s calendars/)).toBeInTheDocument();
    const yes = screen.getByRole('button', { name: 'Yes, delete' });
    expect(yes).toBeEnabled();
    fireEvent.click(yes);
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ groupChatId: 'sem1', scope: 'series' }));
  });

  it('keeps the recurring options unlocked, with no checkbox, when no students have joined', () => {
    openDetail(seminar(['host'], { isRecurring: true }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete only this session' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete all upcoming sessions' })).toBeEnabled();
  });
});
