import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../api/api', () => ({
  doGetFullUserDataByEmail: vi.fn(),
  doFilterPaymentHistories: vi.fn(),
  doGetDirectChatHistory: vi.fn(),
  doGetGroupChatHistory: vi.fn(),
  getPricingSettings: vi.fn(async () => null),
}));

import {
  doGetFullUserDataByEmail,
  doFilterPaymentHistories,
  doGetGroupChatHistory,
} from '../../../../api/api';
import AuditModal from './auditModal';

const mockedUser = vi.mocked(doGetFullUserDataByEmail);
const mockedPayments = vi.mocked(doFilterPaymentHistories);
const mockedGroup = vi.mocked(doGetGroupChatHistory);

const fullUser = {
  _id: 'expert-1',
  username: 'Ada Expert',
  email: 'ada@x.com',
  role: 'expert',
  status: 'active',
  createdAt: '2024-03-12T00:00:00.000Z',
  generalChats: [
    { _id: 'g-1', name: 'Cohort A', admin: { _id: 'expert-1' }, participants: [] },
  ],
  friends: [],
  groupChats: [],
};

describe('AuditModal', () => {
  beforeEach(() => {
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
    mockedUser.mockReset();
    mockedPayments.mockReset();
    mockedGroup.mockReset();
    mockedUser.mockResolvedValue({ result: fullUser });
    mockedPayments.mockResolvedValue({ result: [], totalCount: 0 });
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
  });

  it('renders the header, summary strip and accessible tabs from live account data', async () => {
    const closeModal = vi.fn();
    render(<AuditModal selectedUser={{ email: 'ada@x.com', username: 'Ada Expert' }} closeModal={closeModal} />);

    expect(await screen.findByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Ada Expert' })).toBeTruthy();
    expect(screen.getByText('Expert')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText(/ada@x.com/)).toBeTruthy();
    expect(screen.getByText(/Joined Mar 2024/)).toBeTruthy();
    expect(screen.getByText('Read-only view')).toBeTruthy();
    expect(screen.queryByText(/Audit EXPERT Account/)).toBeNull();

    expect(screen.getByRole('tab', { name: /Chat history/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: /Payment history/ }));
    expect(screen.getByRole('tab', { name: /Payment history/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('No payments yet')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closeModal).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const closeModal = vi.fn();
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={closeModal} />);
    await waitFor(() => expect(mockedUser).toHaveBeenCalled());
    await userEvent.keyboard('{Escape}');
    expect(closeModal).toHaveBeenCalled();
  });
});
