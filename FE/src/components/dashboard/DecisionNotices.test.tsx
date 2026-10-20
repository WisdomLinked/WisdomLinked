import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DecisionNotices from './DecisionNotices';

vi.mock('../../api/api', () => ({
  getMyDecisionNotices: vi.fn(),
  markDecisionNoticeRead: vi.fn(async () => ({})),
}));

import { getMyDecisionNotices } from '../../api/api';

describe('DecisionNotices', () => {
  beforeEach(() => {
    vi.mocked(getMyDecisionNotices).mockReset();
  });

  it('shows seat-offer copy and Open seminar + Pay now for awaiting payment', async () => {
    vi.mocked(getMyDecisionNotices).mockResolvedValue({
      result: [
        {
          id: 'req-1',
          kind: 'seat',
          outcome: 'accepted_awaiting_payment',
          title: 'Cells 101',
          note: 'A seat opened for you. Pay to confirm your spot.',
          decidedAt: new Date().toISOString(),
          price: 40,
          payBy: new Date(Date.now() + 3600_000).toISOString(),
          groupChatId: 'sem-7',
          expertName: 'Dr Wang',
        },
      ],
    });

    const onPay = vi.fn();
    const onOpenSeminar = vi.fn();
    render(<DecisionNotices onPay={onPay} onOpenSeminar={onOpenSeminar} />);

    expect(await screen.findByText(/a seat is available for “Cells 101”/i)).toBeTruthy();
    expect(screen.queryByText(/Dr Wang accepted/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /open seminar/i }));
    expect(onOpenSeminar).toHaveBeenCalledWith('sem-7');

    fireEvent.click(screen.getByRole('button', { name: /pay now/i }));
    expect(onPay).toHaveBeenCalled();
  });

  it('shows you’re in copy for a free auto-enroll seat offer', async () => {
    vi.mocked(getMyDecisionNotices).mockResolvedValue({
      result: [
        {
          id: 'req-2',
          kind: 'seat',
          outcome: 'accepted',
          title: 'Free Seminar',
          note: 'A seat opened for you on this seminar — you are enrolled.',
          decidedAt: new Date().toISOString(),
          groupChatId: 'sem-9',
          expertName: 'Dr Wang',
        },
      ],
    });

    render(<DecisionNotices onOpenSeminar={vi.fn()} />);
    expect(await screen.findByText(/you’re in/i)).toBeTruthy();
  });
});
