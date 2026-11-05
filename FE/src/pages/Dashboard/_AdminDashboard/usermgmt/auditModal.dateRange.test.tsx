import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-redux', () => ({
  useSelector: (select: (state: any) => unknown) => select({ auth: { userDetails: { _id: 'admin-1', role: 'admin' } } }),
  useDispatch: () => vi.fn(),
}));

vi.mock('../../../../api/api', () => ({
  doGetFullUserDataByEmail: vi.fn(),
  doFilterPaymentHistories: vi.fn(),
  doGetDirectChatHistory: vi.fn(),
  doGetGroupChatHistory: vi.fn(),
  doGetGroupChatActivity: vi.fn(async () => false),
  getPricingSettings: vi.fn(async () => null),
  listExpertPayroll: vi.fn(async () => ({ cheques: [] })),
  profileImageFetch: vi.fn(),
}));

import {
  doGetFullUserDataByEmail,
  doFilterPaymentHistories,
  doGetGroupChatHistory,
  profileImageFetch,
} from '../../../../api/api';
import AuditModal from './auditModal';

const mockedUser = vi.mocked(doGetFullUserDataByEmail);
const mockedPayments = vi.mocked(doFilterPaymentHistories);
const mockedGroup = vi.mocked(doGetGroupChatHistory);
const mockedImage = vi.mocked(profileImageFetch);

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

const seminar = (id: string, name: string, day: string) => ({
  _id: id,
  name,
  type: 'seminar',
  status: 'active',
  start: day,
  end: day,
  createdAt: day,
  updatedAt: day,
  participants: [],
});

const fullUser = {
  _id: 'expert-1',
  username: 'Ada Expert',
  email: 'ada@x.com',
  role: 'expert',
  status: 'active',
  createdAt: '2024-03-12T00:00:00.000Z',
  generalChats: [],
  groupChats: [seminar('s-sep', 'September seminar', at(2026, 9, 10)), seminar('s-oct', 'October seminar', at(2026, 10, 10))],
};

const paymentRow = {
  _id: 'p1',
  amount: 5000,
  status: 'completed',
  paymentType: 'charge',
  description: 'Seminar seat',
  createdAt: at(2026, 10, 5),
  customer: { username: 'Sam' },
};

const setDates = (from: string, to: string) => {
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: to } });
};

describe('AuditModal date range', () => {
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
    mockedImage.mockReset();
    mockedUser.mockResolvedValue({ result: fullUser });
    mockedPayments.mockResolvedValue({ result: [paymentRow], totalCount: 1 });
    mockedGroup.mockResolvedValue({ result: [], gotAllChats: true });
  });

  it('narrows the chat list and its tab count to the chosen dates, then clears', async () => {
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    const list = await screen.findByRole('listbox', { name: 'Conversations' });
    expect(await within(list).findByText('September seminar')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Chat history/ })).toHaveTextContent('2');

    setDates('2026-10-01', '2026-10-31');

    await waitFor(() => expect(within(list).queryByText('September seminar')).toBeNull());
    expect(within(list).getByText('October seminar')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Chat history/ })).toHaveTextContent('1');
    expect(within(list).getByText('No community chats in these dates.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await within(list).findByText('September seminar')).toBeTruthy();
    expect(screen.getByLabelText('From date')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('moves off a selected conversation that the dates hide', async () => {
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    const list = await screen.findByRole('listbox', { name: 'Conversations' });
    await userEvent.click(await within(list).findByText('September seminar'));
    expect(within(list).getByRole('option', { name: /September seminar/ })).toHaveAttribute('aria-selected', 'true');

    setDates('2026-10-01', '2026-10-31');

    await waitFor(() =>
      expect(within(list).getByRole('option', { name: /October seminar/ })).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('asks the server for payments inside the dates and says when there are none', async () => {
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    await userEvent.click(await screen.findByRole('tab', { name: /Payment history/ }));
    expect((await screen.findAllByText('Seminar seat')).length).toBeGreaterThan(0);

    mockedPayments.mockClear();
    mockedPayments.mockResolvedValue({ result: [], totalCount: 0 });
    setDates('2026-11-01', '2026-11-30');

    expect(await screen.findByText('No payments in these dates')).toBeTruthy();
    const ranged = mockedPayments.mock.calls.map(call => call[0]).filter((body: any) => body.dateTo);
    expect(ranged.some((body: any) => body.numPerPage === 5)).toBe(true);
    expect(ranged.some((body: any) => body.numPerPage === 100)).toBe(true);
    for (const body of ranged) {
      expect(body.dateFrom).toBe(new Date(new Date(2026, 10, 1).getTime() - 1).toISOString());
      expect(body.dateTo).toBe(new Date(2026, 11, 1).toISOString());
    }
    expect(screen.getByRole('tab', { name: /Payment history/ })).toHaveTextContent('0');
  });

  it('clears "to" when "from" is moved past it', async () => {
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    await screen.findByRole('listbox', { name: 'Conversations' });
    setDates('2026-10-01', '2026-10-10');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-20' } });
    expect(screen.getByLabelText('From date')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('To date')).toHaveValue('');
  });
});

describe('AuditModal header photo', () => {
  beforeEach(() => {
    mockedUser.mockReset();
    mockedPayments.mockReset();
    mockedImage.mockReset();
    mockedPayments.mockResolvedValue({ result: [], totalCount: 0 });
  });

  const photo = () => screen.getByRole('banner').querySelector('img');

  it('loads a stored filename through the image service instead of using it as a link', async () => {
    mockedUser.mockResolvedValue({ result: { ...fullUser, groupChats: [], image: 'IMG_2921.JPG' } });
    mockedImage.mockResolvedValue('data:image/png;base64,AAAA');
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    await waitFor(() => expect(photo()?.getAttribute('src')).toBe('data:image/png;base64,AAAA'));
    expect(mockedImage).toHaveBeenCalledWith('IMG_2921.JPG', 'small');
  });

  it('shows initials, never a broken image, when the photo cannot be loaded', async () => {
    mockedUser.mockResolvedValue({ result: { ...fullUser, groupChats: [], image: 'missing.jpg' } });
    mockedImage.mockResolvedValue(null);
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Ada Expert' });
    await waitFor(() => expect(mockedImage).toHaveBeenCalled());
    expect(photo()).toBeNull();
  });

  it('uses a full photo link (sign-in with Google etc.) as it is', async () => {
    mockedUser.mockResolvedValue({ result: { ...fullUser, groupChats: [], image: 'https://lh3.example.com/a.png' } });
    render(<AuditModal selectedUser={{ email: 'ada@x.com' }} closeModal={vi.fn()} />);
    await waitFor(() => expect(photo()?.getAttribute('src')).toBe('https://lh3.example.com/a.png'));
    expect(mockedImage).not.toHaveBeenCalled();
  });
});
