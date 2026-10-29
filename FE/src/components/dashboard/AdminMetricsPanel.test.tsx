import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminMetricsPanel from './AdminMetricsPanel';
import type { AdminDashboardStatsData } from '../../api/api';
import { snapshotRangeDescription } from '../../utils/adminSnapshotRange';

const stats: AdminDashboardStatsData = {
  pendingApprovals: 0,
  newContactMessages: 0,
  unansweredChatbotQuestions: 0,
  expertCount: 12,
  customerCount: 40,
  oneOnOneSessions: 9,
  seminarsHeld: 3,
  totalPayments: 20,
  refundCount: 2,
  todayUpcomingEvents: 1,
  expertReviewCount: 1,
  customerBlockedCount: 2,
  upcomingSessions: 4,
  upcomingSeminars: 1,
  range: {
    expertsJoined: 3,
    customersJoined: 8,
    sessionsHeld: 5,
    seminarsHeld: 2,
    paymentsCount: 7,
    refundsCount: 1,
    paymentsAmountByCurrency: { usd: 12000 },
    refundsAmountByCurrency: { usd: 2000 },
    sessionsCancelled: 1,
    seminarsAttendees: 11,
    refundsUnlinked: 0,
  },
  change: {
    expertsJoined: 50,
    customersJoined: 10,
    sessionsHeld: -20,
    seminarsHeld: 100,
    paymentsCount: 0,
    refundsCount: -50,
    paymentsAmountByCurrency: { usd: 20 },
    refundsAmountByCurrency: { usd: -10 },
  },
  monthly: {
    experts: [{ month: '2026-09', count: 1 }, { month: '2026-10', count: 2 }],
    customers: [{ month: '2026-09', count: 3 }, { month: '2026-10', count: 5 }],
    sessions: [{ month: '2026-09', count: 2 }, { month: '2026-10', count: 3 }],
    seminars: [{ month: '2026-09', count: 1 }, { month: '2026-10', count: 1 }],
    payments: [{ month: '2026-09', count: 2, amountsByCurrency: { usd: 4000 } }],
    refunds: [{ month: '2026-10', count: 1, amountsByCurrency: { usd: 2000 } }],
  },
};

describe('AdminMetricsPanel', () => {
  it('shows range counts, upcoming notes, and hides change for all time', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <AdminMetricsPanel
        stats={stats}
        rangeKey="6m"
        onRangeChange={vi.fn()}
        onSelectList={onSelect}
      />,
    );
    expect(screen.getByText('Last 6 months')).toBeInTheDocument();
    expect(screen.getByText('3 joined in range')).toBeInTheDocument();
    expect(screen.getByText('4 upcoming')).toBeInTheDocument();
    expect(screen.getByText('$120')).toBeInTheDocument();
    expect(screen.getByText('$20 returned')).toBeInTheDocument();
    expect(screen.getByText('+50% vs previous period')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /experts/i }));
    expect(onSelect).toHaveBeenCalledWith('experts');

    rerender(
      <AdminMetricsPanel
        stats={stats}
        rangeKey="all"
        onRangeChange={vi.fn()}
        onSelectList={onSelect}
      />,
    );
    expect(screen.getByRole('radio', { name: 'All time' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/vs previous period/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeInTheDocument();
  });

  it('opens Custom after All time and applies a valid start/end range', () => {
    const onRangeChange = vi.fn();
    const { rerender } = render(
      <AdminMetricsPanel
        stats={stats}
        rangeKey="6m"
        onRangeChange={onRangeChange}
        onSelectList={vi.fn()}
      />,
    );
    const labels = screen.getAllByRole('radio').map(el => el.textContent);
    expect(labels[labels.length - 2]).toBe('All time');
    expect(labels[labels.length - 1]).toBe('Custom');

    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-03-31' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/on or after start/i);
    expect(onRangeChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onRangeChange).toHaveBeenCalledWith('custom', { startDate: '2026-01-01', endDate: '2026-03-31' });

    rerender(
      <AdminMetricsPanel
        stats={stats}
        rangeKey="custom"
        customRange={{ startDate: '2026-01-01', endDate: '2026-03-31' }}
        onRangeChange={onRangeChange}
        onSelectList={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText(
        snapshotRangeDescription('custom', { startDate: '2026-01-01', endDate: '2026-03-31' }),
      ),
    ).toBeInTheDocument();
  });
});
