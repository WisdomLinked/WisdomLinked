import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

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

describe('PaymentHistory audit tab with dates', () => {
  beforeEach(() => {
    mockedFilter.mockReset();
    mockedPayroll.mockReset();
  });

  it('keeps a cheque to its own payroll month, whatever time zone the admin is in', async () => {
    mockedPayroll.mockResolvedValue({
      cheques: [
        { year: 2026, month: 9, amountCents: 4000, chequeNumber: 'C-SEP', chequeDate: '2026-10-03T00:00:00.000Z' },
        { year: 2026, month: 10, amountCents: 3000, chequeNumber: 'C-OCT', chequeDate: '2026-11-02T00:00:00.000Z' },
      ],
    });
    // Falls in UTC October, so the October cheque has paid it even though October is not in view.
    mockedFilter.mockResolvedValue({
      result: [
        {
          _id: '1',
          amount: 7000,
          status: 'completed',
          paymentType: 'charge',
          description: 'Late September seat',
          createdAt: '2026-10-01T00:00:00.000Z',
          customer: { username: 'Sam' },
        },
      ],
      totalCount: 1,
    });
    render(
      <PaymentHistory
        userDetails={{ _id: 'e1', role: 'expert', email: 'ada@x.com' }}
        range={{ from: '2026-09-01', to: '2026-09-30' }}
      />,
    );
    expect(await screen.findByText('September 2026')).toBeTruthy();
    expect(screen.queryByText('October 2026')).toBeNull();
    const tile = (label: string) =>
      screen.getAllByText(label).find(el => el.nextElementSibling?.textContent?.startsWith('$'))?.nextElementSibling?.textContent;
    await waitFor(() => expect(tile('Paid out')).toBe('$40.00'));
    expect(tile('Ready to pay')).toBe('$0.00');
  });
});

describe('PaymentHistory audit tab with changing dates', () => {
  beforeEach(() => {
    mockedFilter.mockReset();
    mockedPayroll.mockReset();
    mockedPayroll.mockResolvedValue({ cheques: [] });
  });

  it('ignores a slow answer for dates the admin has already moved on from', async () => {
    const row = (description: string, amount: number) => ({
      _id: description,
      amount,
      status: 'completed',
      paymentType: 'charge',
      description,
      createdAt: '2026-10-05T12:00:00.000Z',
      customer: { username: 'Sam' },
    });
    const slow: Array<() => void> = [];
    mockedFilter.mockImplementation((body: any) =>
      body.dateTo?.startsWith('2026-10-')
        ? new Promise(resolve => slow.push(() => resolve({ result: [row('Stale September', 9900)], totalCount: 1 })))
        : Promise.resolve({ result: [row('Fresh October', 1000)], totalCount: 1 }),
    );
    const user = { _id: 'e1', role: 'expert', email: 'ada@x.com' };
    const { rerender } = render(<PaymentHistory userDetails={user} range={{ from: '2026-09-01', to: '2026-09-30' }} />);
    rerender(<PaymentHistory userDetails={user} range={{ from: '2026-10-01', to: '2026-10-31' }} />);
    expect((await screen.findAllByText('Fresh October')).length).toBeGreaterThan(0);

    await act(async () => {
      slow.forEach(answer => answer());
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(screen.queryByText('Stale September')).toBeNull();
    const gross = screen.getByText('Gross earnings').nextElementSibling?.textContent;
    expect(gross).toBe('$10.00');
  });
});

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
