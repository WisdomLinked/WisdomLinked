import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../../api/api', () => ({
  doFilterPaymentHistories: vi.fn(),
  getPricingSettings: vi.fn(async () => null),
  listExpertPayroll: vi.fn(async () => ({ cheques: [] })),
}));

import { doFilterPaymentHistories, listExpertPayroll } from '../../../../api/api';
import PaymentHistory from './paymentHistory';

const mockedFilter = vi.mocked(doFilterPaymentHistories);
const mockedPayroll = vi.mocked(listExpertPayroll);

const recordedCheque = {
  year: 2026,
  month: 10,
  amountCents: 4000,
  chequeNumber: '1001',
  chequeDate: '2026-11-02T00:00:00.000Z',
};

describe('PaymentHistory audit tab', () => {
  beforeEach(() => {
    mockedFilter.mockReset();
    mockedPayroll.mockReset();
    mockedPayroll.mockResolvedValue({ cheques: [] });
  });

  it('renders an empty state when the account has no payments', async () => {
    mockedFilter.mockResolvedValue({ result: [], totalCount: 0 });
    render(<PaymentHistory userDetails={{ email: 'ada@x.com' }} />);
    expect(await screen.findByText('No payments yet')).toBeTruthy();
  });

  it('excludes refunded rows from gross earnings and shows status pills', async () => {
    mockedFilter.mockResolvedValue({
      result: [
        {
          _id: '1',
          amount: 10000,
          status: 'completed',
          paymentType: 'charge',
          description: 'Seminar seat',
          paymentIntent: 'pi_live_123456789',
          createdAt: '2024-05-01T12:00:00.000Z',
          customer: { username: 'Sam', email: 'sam@x.com' },
        },
        {
          _id: '2',
          amount: 4000,
          status: 'refunded',
          paymentType: 'refund',
          description: 'Refunded seat',
          paymentIntent: 'pi_refund',
          createdAt: '2024-05-02T12:00:00.000Z',
          customer: { username: 'Sam', email: 'sam@x.com' },
        },
      ],
      totalCount: 2,
    });

    render(<PaymentHistory userDetails={{ email: 'ada@x.com', role: 'expert' }} />);

    await waitFor(() => expect(screen.getAllByText('Seminar seat').length).toBeGreaterThan(0));
    expect(screen.getAllByText('$100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$80.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paid out').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Refunded').length).toBeGreaterThan(0);
    expect(screen.getAllByText('pi_live_123456789').length).toBeGreaterThan(0);
  });

  it('lists a recorded cheque for an expert and hides it for a student', async () => {
    mockedPayroll.mockResolvedValue({ cheques: [recordedCheque] });
    mockedFilter.mockResolvedValue({
      result: [
        {
          _id: '1',
          amount: 10000,
          status: 'completed',
          paymentType: 'charge',
          description: 'Seminar seat',
          paymentIntent: 'pi_live_123456789',
          createdAt: '2026-10-15T12:00:00.000Z',
          customer: { username: 'Sam', email: 'sam@x.com' },
        },
      ],
      totalCount: 1,
    });

    const { unmount } = render(
      <PaymentHistory userDetails={{ _id: 'expert-1', email: 'ada@x.com', role: 'expert' }} />,
    );
    expect(await screen.findByText('1001')).toBeTruthy();
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByText('Nov 2, 2026')).toBeTruthy();
    expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0);
    unmount();

    render(<PaymentHistory userDetails={{ _id: 'student-1', email: 'sam@x.com', role: 'student' }} />);
    expect((await screen.findAllByText('Seminar seat')).length).toBeGreaterThan(0);
    expect(screen.queryByText('1001')).toBeNull();
    expect(screen.queryByText('October 2026')).toBeNull();
  });
});
