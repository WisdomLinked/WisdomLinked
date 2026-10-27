import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../api/api', () => ({
  doGetDirectChatHistory: vi.fn(),
  doGetGroupChatHistory: vi.fn(),
  doGetGroupChatActivity: vi.fn(),
  profileImageFetch: vi.fn(),
}));

vi.mock('../../../../hooks/useResolvedProfileImages', () => ({
  useResolvedProfileImages: () => new Map(),
}));

vi.mock('react-redux', () => ({
  useSelector: (select: (state: any) => unknown) => select({ auth: { userDetails: { _id: 'admin-1', role: 'admin' } } }),
  useDispatch: () => vi.fn(),
}));

vi.mock('../../../../api/chatApi', () => ({
  fetchChatUserProfile: vi.fn(),
}));

vi.mock('../../../../utils/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import { doGetGroupChatActivity, doGetGroupChatHistory } from '../../../../api/api';
import { fetchChatUserProfile } from '../../../../api/chatApi';
import { notify } from '../../../../utils/notify';
import ChatHistory from './chatHistory';

const mockedGroup = vi.mocked(doGetGroupChatHistory);
const mockedActivity = vi.mocked(doGetGroupChatActivity);
const mockedProfile = vi.mocked(fetchChatUserProfile);

const activityResponse = {
  status: 'SUCCESS',
  community: {
    _id: 'g-1',
    name: 'Cohort A',
    description: 'A place for cohort A to talk.',
    isOpenToAll: true,
    keywords: [],
    services: [],
  },
  members: [
    { _id: 'expert-1', username: 'Ada Expert', communityRole: 'owner', callsJoined: 3, callsStarted: 3, callsPerWeek: 1.5, messages: 12, messagesPerWeek: 6 },
    { _id: 's1', username: 'Sam', communityRole: 'member', callsJoined: 1, callsStarted: 0, callsPerWeek: 0.5, messages: 4, messagesPerWeek: 2 },
  ],
  totals: { calls: 3, callsPerWeek: 1.5, messages: 16, messagesPerWeek: 8, messagesFromOthers: 0, weeks: 2, since: '2024-01-01T00:00:00.000Z' },
  messagesAvailable: true,
  messagesCapped: false,
};

const userDetails = {
  _id: 'expert-1',
  username: 'Ada Expert',
  email: 'ada@x.com',
  generalChats: [
    {
      _id: 'g-1',
      name: 'Cohort A',
      admin: { _id: 'expert-1' },
      participants: [{ _id: 's1', username: 'Sam' }],
    },
  ],
  groupChats: [
    {
      _id: 'appt-1',
      name: 'Essay review with Priya',
      description: 'Go through the second draft.',
      type: 'individual',
      price: 25,
      admin: { _id: 'expert-1', username: 'Ada Expert' },
      participants: [{ _id: 'f-1', username: 'Priya Student' }],
      start: '2024-01-05T15:00:00.000Z',
      end: '2024-01-05T16:00:00.000Z',
    },
  ],
};

function stubDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

describe('ChatHistory audit pane', () => {
  beforeEach(() => {
    stubDesktop();
    mockedGroup.mockReset();
    mockedActivity.mockReset();
    mockedActivity.mockResolvedValue(activityResponse);
    mockedProfile.mockReset();
    mockedProfile.mockResolvedValue({ success: false });
    vi.mocked(notify.error).mockReset();
  });

  it('shows empty private and seminar sections and auto-selects the first group chat', async () => {
    mockedGroup.mockResolvedValue({ result: [{ _id: 'm1', content: 'Hello', createdAt: '2024-01-01T12:00:00.000Z', author: { _id: 'expert-1', username: 'Ada Expert' } }], gotAllChats: true });
    render(<ChatHistory userDetails={{ ...userDetails, groupChats: [] }} />);

    expect(screen.getByText('No 1:1 appointments on this account.')).toBeTruthy();
    expect(screen.getByText('No seminars on this account.')).toBeTruthy();

    await waitFor(() => expect(mockedGroup).toHaveBeenCalled());
    expect(mockedGroup.mock.calls[0][0]).toMatchObject({ groupChatId: 'g-1', currentPage: 0 });
    expect(mockedGroup.mock.calls[0][1]).toEqual({ notify: false });
    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(screen.getByText('Audited user')).toBeTruthy();
  });

  it('shows an inline retry when messages fail to load, without a global toast', async () => {
    mockedGroup.mockResolvedValueOnce(false);
    mockedGroup.mockResolvedValueOnce({
      result: [{ _id: 'm2', content: 'Recovered', createdAt: '2024-01-01T12:00:00.000Z', author: { _id: 's1', username: 'Sam' } }],
      gotAllChats: true,
    });

    render(<ChatHistory userDetails={{ ...userDetails, groupChats: [] }} />);

    expect(await screen.findByText("Couldn't load messages for this chat")).toBeTruthy();
    expect(screen.getByText('Messages failed to load')).toBeTruthy();
    expect(notify.error).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered')).toBeTruthy();
    expect(screen.queryByText("Couldn't load messages for this chat")).toBeNull();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('lists 1:1 appointments under 1:1, opens the first one and its session details', async () => {
    mockedGroup.mockResolvedValue({
      result: [{ _id: 'm3', content: 'Hi there', createdAt: '2024-01-02T12:00:00.000Z', author: { _id: 'f-1', username: 'Priya Student' } }],
      gotAllChats: true,
    });

    render(<ChatHistory userDetails={userDetails} />);
    await waitFor(() => expect(mockedGroup).toHaveBeenCalled());
    expect(mockedGroup.mock.calls[0][0]).toMatchObject({ groupChatId: 'appt-1', currentPage: 0 });
    expect(await screen.findByText('Hi there')).toBeTruthy();
    expect(screen.getByText('No seminars on this account.')).toBeTruthy();

    await userEvent.click(screen.getByTitle('View session details'));
    expect(await screen.findByRole('dialog', { name: 'Session details' })).toBeTruthy();
    expect(screen.getAllByText('Go through the second draft.').length).toBeGreaterThan(0);
    expect(screen.getByText('Expert')).toBeTruthy();
  });

  it('keeps 1:1 appointments out of the seminars list', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    render(<ChatHistory userDetails={userDetails} />);
    await userEvent.click(screen.getByRole('button', { name: 'Seminars' }));
    const list = screen.getByRole('listbox', { name: 'Conversations' });
    expect(list.textContent).toContain('No seminars on this account.');
    expect(list.textContent).not.toContain('Essay review with Priya');
  });

  it('orders the filters and sections as 1:1, Seminars, Communities', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    render(<ChatHistory userDetails={userDetails} />);

    const filters = screen.getByRole('group', { name: 'Filter conversations' });
    expect(Array.from(filters.querySelectorAll('button')).map(b => b.textContent)).toEqual([
      'All',
      '1:1',
      'Seminars',
      'Communities',
    ]);
    expect(Array.from(document.querySelectorAll('section h3 span:first-child')).map(el => el.textContent)).toEqual([
      '1:1 appointments',
      'Seminars',
      'Community chats',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Communities' }));
    expect(Array.from(document.querySelectorAll('section h3 span:first-child')).map(el => el.textContent)).toEqual([
      'Community chats',
    ]);
    expect(screen.getByText('General Chat')).toBeTruthy();
  });

  it('shows community members, activity and the community details for a community chat', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    render(<ChatHistory userDetails={{ ...userDetails, groupChats: [] }} />);

    await waitFor(() => expect(mockedActivity).toHaveBeenCalledWith('g-1', { notify: false }));
    const activity = await screen.findByRole('region', { name: 'Activity' });
    expect(activity.textContent).toContain('Video calls');
    expect(activity.textContent).toContain('16');
    const rows = Array.from(activity.querySelectorAll('tbody tr')).map(row =>
      Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent),
    );
    expect(rows).toEqual([
      ['Ada Expert · Audited', '3', '1.5', '12', '6'],
      ['Sam', '1', '0.5', '4', '2'],
    ]);

    await userEvent.click(screen.getByRole('button', { name: /General Chat/ }));
    expect(await screen.findByText('A place for cohort A to talk.')).toBeTruthy();
  });

  it('can fold the per-member table away and back, keeping the totals', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    render(<ChatHistory userDetails={{ ...userDetails, groupChats: [] }} />);
    const activity = await screen.findByRole('region', { name: 'Activity' });
    const table = activity.querySelector('#audit-activity-members') as HTMLElement;
    expect(table.hidden).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(table.hidden).toBe(true);
    expect(screen.getByRole('button', { name: 'Show' }).getAttribute('aria-expanded')).toBe('false');
    expect(activity.textContent).toContain('Video calls');
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(table.hidden).toBe(false);
  });

  it('opens all participants from the names line, then a member profile card, with no remove option', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    mockedProfile.mockResolvedValue({ success: true, result: { _id: 's1', username: 'Sam Student', role: 'customer' } });
    render(<ChatHistory userDetails={{ ...userDetails, groupChats: [] }} />);

    await userEvent.click(await screen.findByTitle('View all participants'));
    expect(await screen.findByText('2 participants')).toBeTruthy();
    expect(screen.getByText('Host')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();

    await userEvent.click(screen.getAllByText('Sam').find(el => el.closest('[role="button"]'))!);
    await waitFor(() => expect(mockedProfile).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Sam Student')).toBeTruthy();
  });

  it('offers a retry when community activity fails to load', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    mockedActivity.mockResolvedValueOnce(false as any);
    render(<ChatHistory userDetails={{ ...userDetails, groupChats: [] }} />);

    expect(await screen.findByText("Couldn't load activity for this community.")).toBeTruthy();
    const retries = screen.getAllByRole('button', { name: 'Retry' });
    await userEvent.click(retries[0]);
    expect(await screen.findByRole('region', { name: 'Activity' })).toBeTruthy();
    expect(mockedActivity).toHaveBeenCalledTimes(2);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('gives a 1:1 appointment the participants popup and an activity row with call time vs booked', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    mockedActivity.mockResolvedValue({
      ...activityResponse,
      community: { ...activityResponse.community, type: 'individual' },
      members: [
        { _id: 'expert-1', username: 'Ada Expert', communityRole: 'owner', callsJoined: 2, callsStarted: 2, callsPerWeek: 1, messages: 3, messagesPerWeek: 1.5 },
        { _id: 'f-1', username: 'Priya Student', communityRole: 'member', callsJoined: 2, callsStarted: 0, callsPerWeek: 1, messages: 5, messagesPerWeek: 2.5 },
      ],
      appointment: { bookedMinutes: 30, calledMinutes: 29, timeStatus: 'unconfirmed', callsDuring: 2, callsAfter: 1, messagesAfter: 4, scheduledEnd: '2024-01-05T16:00:00.000Z' },
    });
    mockedProfile.mockResolvedValue({ success: true, result: { _id: 'f-1', username: 'Priya S.', role: 'customer' } });
    render(<ChatHistory userDetails={userDetails} />);
    await waitFor(() => expect(mockedActivity).toHaveBeenCalledWith('appt-1', { notify: false }));
    const activity = await screen.findByRole('region', { name: 'Activity' });
    expect(activity.textContent).toContain('29 of 30 min');
    expect(activity.textContent).toContain('Unconfirmed');
    expect(activity.textContent).toContain('1 call · 4 messages');
    expect(activity.textContent).toContain('Ada Expert · Audited');

    await userEvent.click(screen.getByTitle('View all participants'));
    expect(await screen.findByText('2 participants')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    await userEvent.click(screen.getAllByText('Priya Student').find(el => el.closest('[role="button"]'))!);
    await waitFor(() => expect(mockedProfile).toHaveBeenCalledWith('f-1'));
    expect(await screen.findByText('Priya S.')).toBeTruthy();
  });

  it('gives seminars the same participants popup, a details popup and series activity', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    mockedActivity.mockResolvedValue({
      ...activityResponse,
      community: { ...activityResponse.community, type: 'seminar', sessionCount: 3 },
    });
    const seminarUser = {
      ...userDetails,
      generalChats: [],
      groupChats: [
        {
          _id: 'sem-1',
          name: 'Thermo 101',
          description: 'Intro to thermodynamics.',
          type: 'seminar',
          price: 10,
          admin: { _id: 'expert-1', username: 'Ada Expert' },
          participants: [{ _id: 'expert-1', username: 'Ada Expert' }, { _id: 's1', username: 'Sam' }],
          start: '2024-02-01T15:00:00.000Z',
          end: '2024-02-01T16:00:00.000Z',
        },
      ],
    };
    render(<ChatHistory userDetails={seminarUser} />);

    await waitFor(() => expect(mockedActivity).toHaveBeenCalledWith('sem-1', { notify: false }));
    const activity = await screen.findByRole('region', { name: 'Activity' });
    expect(activity.textContent).toContain('Covers all 3 sessions');
    expect(activity.textContent).toContain('Ada Expert · Audited');

    await userEvent.click(screen.getByTitle('View all participants'));
    expect(await screen.findByText('2 participants')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Close participants' }));

    await userEvent.click(screen.getByTitle('View seminar details'));
    expect(await screen.findByRole('dialog', { name: 'Seminar details' })).toBeTruthy();
    expect(screen.getAllByText('Intro to thermodynamics.').length).toBeGreaterThan(0);
  });
});

