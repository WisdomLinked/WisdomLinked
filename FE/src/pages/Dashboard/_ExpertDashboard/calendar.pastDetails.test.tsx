import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import ExpertCalendar from './calendar';
import { doGetMyEvents } from '../../../api/api';

vi.mock('../../../api/api', () => ({
  doAcceptEvent: vi.fn(),
  doCancelInvitation: vi.fn(),
  doDeclineEvent: vi.fn(),
  doGetMyEvents: vi.fn(),
  cancelIndividualAppointment: vi.fn(),
}));
vi.mock('../seminarDetails', () => ({
  default: ({ title }: any) => <div data-testid="seminar-details">{title}</div>,
}));
vi.mock('../../../hooks/usePeerProfileModal', () => ({
  usePeerProfileModal: () => ({ openPeerProfile: vi.fn(), peerProfileModal: null }),
}));
vi.mock('../../../actions/authActions', () => ({ updateMe: () => ({ type: 'test/refresh' }) }));
vi.mock('../../../actions/appActions', () => ({ SetLoadingStatus: vi.fn() }));
vi.mock('../../../utils/expertOpenChatWithUser', () => ({ openExpertChatWithUser: vi.fn() }));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const session = (name: string, startMs: number, overrides: Record<string, unknown> = {}) => ({
  _id: `gc-${name}`,
  name,
  type: 'individual',
  status: 'active',
  start: new Date(startMs).toISOString(),
  end: new Date(startMs + HOUR).toISOString(),
  duration: 60,
  admin: { _id: 'expert-1', username: 'Expert' },
  createdBy: { _id: 'student-1' },
  participants: [{ _id: 'expert-1' }, { _id: 'student-1', username: 'Student' }],
  ...overrides,
});

const legacyEvent = (title: string, startMs: number) => ({
  _id: `ev-${title}`,
  title,
  status: 'accepted',
  start: new Date(startMs).toISOString(),
  end: new Date(startMs + HOUR).toISOString(),
  customer: { _id: 'student-1', username: 'Student' },
});

function show(groupChats: any[], events: any[] = []) {
  vi.mocked(doGetMyEvents).mockResolvedValue({ result: { events, groupChats } } as any);
  const userDetails = { _id: 'expert-1', role: 'expert', groupChats, events };
  const store = configureStore({ reducer: { auth: (state = { userDetails }) => state } });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ExpertCalendar />
      </MemoryRouter>
    </Provider>,
  );
}

const openFromList = async (title: string) => {
  fireEvent.click((await screen.findAllByText(title))[0]);
};

describe('Expert calendar details popups', () => {
  beforeEach(() => vi.mocked(doGetMyEvents).mockReset());

  it('has no Chat History button on a past 1:1', async () => {
    show([session('Old Session', Date.now() - 3 * DAY)]);
    await openFromList('Old Session');
    expect(screen.getByTestId('seminar-details')).toBeTruthy();
    expect(screen.queryByRole("button", { name: /chat history|enter chat|enter seminar chat|withdraw offer|go to chat/i })).toBeNull();
  });

  it('has no Chat History button on a past seminar', async () => {
    show([session('Old Seminar', Date.now() - 3 * DAY, { type: 'seminar' })]);
    await openFromList('Old Seminar');
    expect(screen.queryByRole("button", { name: /chat history|enter chat|enter seminar chat|withdraw offer|go to chat/i })).toBeNull();
  });

  it('has no Chat History button on a past legacy event', async () => {
    show([], [legacyEvent('Old Event', Date.now() - 3 * DAY)]);
    await openFromList('Old Event');
    expect(screen.getByText('Event Details')).toBeTruthy();
    expect(screen.queryByRole("button", { name: /chat history|enter chat|enter seminar chat|withdraw offer|go to chat/i })).toBeNull();
  });

  it('still offers Enter Chat on an upcoming 1:1', async () => {
    show([session('Next Session', Date.now() + 3 * DAY)]);
    await openFromList('Next Session');
    expect(screen.getByRole('button', { name: 'Enter Chat' })).toBeTruthy();
  });

  it('still offers Enter Seminar Chat on an upcoming seminar', async () => {
    show([session('Next Seminar', Date.now() + 3 * DAY, { type: 'seminar' })]);
    await openFromList('Next Seminar');
    expect(screen.getByRole('button', { name: 'Enter Seminar Chat' })).toBeTruthy();
  });

  it('shows Cancelled in red on a cancelled 1:1 and no action button', async () => {
    show([session('Gone Session', Date.now() - 3 * DAY, { status: 'cancelled' })]);
    await openFromList('Gone Session');
    const label = screen.getByText('Cancelled');
    expect(label.className).toMatch(/text-rose-600/);
    expect(screen.queryByRole('button', { name: /enter chat|chat history/i })).toBeNull();
  });

  it('does not offer Enter Chat on a cancelled 1:1 that is still in the future', async () => {
    show([session('Gone Later', Date.now() + 3 * DAY, { status: 'cancelled' })]);
    await openFromList('Gone Later');
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enter Chat' })).toBeNull();
  });

  it('does not show Cancelled on a session that was not cancelled', async () => {
    show([session('Old Session', Date.now() - 3 * DAY)]);
    await openFromList('Old Session');
    expect(screen.queryByText('Cancelled')).toBeNull();
  });

  it('labels a cancelled 1:1 Cancelled 1-1 in the past list', async () => {
    show([session('Gone Session', Date.now() - 3 * DAY, { status: 'cancelled' })]);
    const pastHeading = await screen.findByText('Past meetings');
    const pastBox = pastHeading.parentElement as HTMLElement;
    expect(within(pastBox).getByText('Cancelled 1-1')).toBeTruthy();
  });
});
