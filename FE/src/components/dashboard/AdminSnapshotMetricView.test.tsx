import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../api/api', () => ({
  doGetAdminDashboardStats: vi.fn(),
  doFilterUsers: vi.fn(),
  doGetAdminPlatformEvents: vi.fn(),
  doFilterPaymentHistories: vi.fn(),
  profileImageFetch: vi.fn(),
}));

import {
  doFilterPaymentHistories,
  doFilterUsers,
  doGetAdminDashboardStats,
} from '../../api/api';
import AdminSnapshotMetricView from './AdminSnapshotMetricView';

const mockedStats = vi.mocked(doGetAdminDashboardStats);
const mockedUsers = vi.mocked(doFilterUsers);
const mockedPayments = vi.mocked(doFilterPaymentHistories);

describe('AdminSnapshotMetricView', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    mockedStats.mockResolvedValue({
      status: 'SUCCESS',
      data: {
        pendingApprovals: 0,
        newContactMessages: 0,
        unansweredChatbotQuestions: 0,
        expertCount: 2,
        customerCount: 0,
        oneOnOneSessions: 0,
        seminarsHeld: 0,
        totalPayments: 0,
        refundCount: 0,
        todayUpcomingEvents: 0,
        expertReviewCount: 1,
        range: {
          expertsJoined: 1,
          customersJoined: 0,
          sessionsHeld: 0,
          seminarsHeld: 0,
          paymentsCount: 0,
          refundsCount: 0,
          paymentsAmountByCurrency: {},
          refundsAmountByCurrency: {},
          sessionsCancelled: 0,
          seminarsAttendees: 0,
          refundsUnlinked: 0,
        },
        monthly: {
          experts: [{ month: '2026-10', count: 1 }],
          customers: [],
          sessions: [],
          seminars: [],
          payments: [],
          refunds: [],
        },
      },
    });
    mockedUsers.mockResolvedValue({
      result: [
        {
          _id: 'u1',
          username: 'Ada Expert',
          email: 'ada@example.com',
          title: 'Admissions',
          status: 'review',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      totalCount: 1,
    });
    mockedPayments.mockResolvedValue({ result: [], totalCount: 0 });
  });

  it('loads experts from the API and shows KPIs without the old drawer', async () => {
    render(
      <MemoryRouter initialEntries={['/user/admindashboard/snapshot/experts?range=6m']}>
        <Routes>
          <Route path="/user/admindashboard/snapshot/:listType" element={<AdminSnapshotMetricView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Experts' })).toBeInTheDocument();
    expect(screen.getByText('← Overview')).toBeInTheDocument();
    expect(screen.getByText('Everyone offering mentoring on the platform.')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('of 2 total')).toBeInTheDocument();
    expect(screen.getByText('New experts per month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'October 2026: 1' })).toBeInTheDocument();
    const bar = screen.getByRole('button', { name: 'October 2026: 1' }).querySelector('span');
    expect(bar).toHaveStyle({ height: '128px' });
    await waitFor(() => expect(screen.getAllByText('Ada Expert').length).toBeGreaterThan(0));
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    expect(screen.getByText('Select a row to see details.')).toBeInTheDocument();
    expect(screen.getByText('1 expert · all accounts, activity counted for last 6 months')).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Past or upcoming' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a centred empty chart message when every month is zero', async () => {
    mockedStats.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        pendingApprovals: 0,
        newContactMessages: 0,
        unansweredChatbotQuestions: 0,
        expertCount: 2,
        customerCount: 0,
        oneOnOneSessions: 0,
        seminarsHeld: 0,
        totalPayments: 0,
        refundCount: 0,
        todayUpcomingEvents: 0,
        expertReviewCount: 1,
        range: {
          expertsJoined: 1,
          customersJoined: 0,
          sessionsHeld: 0,
          seminarsHeld: 0,
          paymentsCount: 0,
          refundsCount: 0,
          paymentsAmountByCurrency: {},
          refundsAmountByCurrency: {},
          sessionsCancelled: 0,
          seminarsAttendees: 0,
          refundsUnlinked: 0,
        },
        monthly: {
          experts: [{ month: '2026-10', count: 0 }],
          customers: [],
          sessions: [],
          seminars: [],
          payments: [],
          refunds: [],
        },
      },
    });
    render(
      <MemoryRouter initialEntries={['/user/admindashboard/snapshot/experts?range=6m']}>
        <Routes>
          <Route path="/user/admindashboard/snapshot/:listType" element={<AdminSnapshotMetricView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('No new experts in this range')).toBeInTheDocument();
  });

  it('auto-selects the first row on desktop', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('1024px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    render(
      <MemoryRouter initialEntries={['/user/admindashboard/snapshot/experts?range=6m']}>
        <Routes>
          <Route path="/user/admindashboard/snapshot/:listType" element={<AdminSnapshotMetricView />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument();
      expect(screen.getAllByText('Ada Expert').length).toBeGreaterThan(1);
    });
  });

  it('scrolls refunds in a sticky table and shows unlinked-user details', async () => {
    mockedPayments.mockReset();
    mockedPayments.mockResolvedValue({
      result: [
        {
          _id: 'r1',
          amount: 5000,
          currency: 'usd',
          description: 'Refund — session declined',
          paymentType: 'refund',
          status: 'refunded',
          createdAt: '2026-10-06T17:53:00.000Z',
          paymentIntent: 'pi_abc123',
          receiptUrl: 'https://stripe.test/r1',
        },
        {
          _id: 'r2',
          amount: 2500,
          currency: 'usd',
          description: 'Refund — captured without enrollment',
          paymentType: 'refund',
          status: 'refunded',
          createdAt: '2026-09-01T10:00:00.000Z',
          customer: { username: 'Sam Student', email: 'sam@example.com' },
        },
      ],
      totalCount: 62,
    });
    render(
      <MemoryRouter initialEntries={['/user/admindashboard/snapshot/refunds?range=6m']}>
        <Routes>
          <Route path="/user/admindashboard/snapshot/:listType" element={<AdminSnapshotMetricView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findAllByText('Sam Student')).length).toBeGreaterThan(0);
    expect(screen.getByText('62 refunds · last 6 months')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 62')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Refunded' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reason' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('session declined').length).toBeGreaterThan(0);
    expect(screen.queryByRole('tablist', { name: 'Past or upcoming' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByText('Unknown user')[0]);
    expect(screen.getAllByText(/No account is linked to this refund/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('pi_abc123').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Open receipt' })[0]).toHaveAttribute(
      'href',
      'https://stripe.test/r1',
    );
  });
});
