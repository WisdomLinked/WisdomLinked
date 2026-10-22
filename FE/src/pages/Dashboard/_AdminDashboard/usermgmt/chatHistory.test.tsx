import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../api/api', () => ({
  doGetDirectChatHistory: vi.fn(),
  doGetGroupChatHistory: vi.fn(),
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

import { doGetDirectChatHistory, doGetGroupChatHistory } from '../../../../api/api';
import { notify } from '../../../../utils/notify';
import ChatHistory from './chatHistory';

const mockedDirect = vi.mocked(doGetDirectChatHistory);
const mockedGroup = vi.mocked(doGetGroupChatHistory);

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
  friends: [{ _id: 'f-1', username: 'Priya Student', email: 'priya@x.com' }],
  groupChats: [],
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
    mockedDirect.mockReset();
    mockedGroup.mockReset();
    vi.mocked(notify.error).mockReset();
  });

  it('shows empty private and seminar sections and auto-selects the first group chat', async () => {
    mockedGroup.mockResolvedValue({ result: [{ _id: 'm1', content: 'Hello', createdAt: '2024-01-01T12:00:00.000Z', author: { _id: 'expert-1', username: 'Ada Expert' } }], gotAllChats: true });
    render(<ChatHistory userDetails={{ ...userDetails, friends: [] }} />);

    expect(screen.getByText('No private chats on this account.')).toBeTruthy();
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

    render(<ChatHistory userDetails={userDetails} />);

    expect(await screen.findByText("Couldn't load messages for this chat")).toBeTruthy();
    expect(screen.getByText('Messages failed to load')).toBeTruthy();
    expect(notify.error).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered')).toBeTruthy();
    expect(screen.queryByText("Couldn't load messages for this chat")).toBeNull();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('loads private chats with the friend as receiver', async () => {
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
    mockedDirect.mockResolvedValue({
      result: [{ _id: 'm3', content: 'Hi there', createdAt: '2024-01-02T12:00:00.000Z', author: { _id: 'f-1', username: 'Priya Student' } }],
      gotAllChats: true,
    });

    render(<ChatHistory userDetails={userDetails} />);
    await userEvent.click(screen.getByText('Priya Student'));
    await waitFor(() => expect(mockedDirect).toHaveBeenCalled());
    expect(mockedDirect.mock.calls[0][0]).toMatchObject({
      senderId: 'expert-1',
      receiverId: 'f-1',
    });
    expect(mockedDirect.mock.calls[0][1]).toEqual({ notify: false });
    expect(await screen.findByText('Hi there')).toBeTruthy();
  });
});
