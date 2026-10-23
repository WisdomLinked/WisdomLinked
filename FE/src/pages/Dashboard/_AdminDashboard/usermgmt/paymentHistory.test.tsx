import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../../api/api', () => ({
  doFilterPaymentHistories: vi.fn(),
  getPricingSettings: vi.fn(async () => null),
}));

import { doFilterPaymentHistories } from '../../../../api/api';
import PaymentHistory from './paymentHistory';

const mockedFilter = vi.mocked(doFilterPaymentHistories);

describe('PaymentHistory audit tab', () => {
  beforeEach(() => {
    mockedFilter.mockReset();
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
});
