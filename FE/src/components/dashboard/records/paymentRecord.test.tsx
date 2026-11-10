import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentDetailFields, bookingKindLabel, paymentHeader, paymentUser, toPaymentRow } from './paymentRecord';

const charge = {
  _id: 'p1',
  amount: 7000,
  currency: 'usd',
  description: 'Weekly seminar',
  status: 'completed',
  paymentType: 'charge',
  stripeMode: 'live',
  createdAt: '2026-10-01T15:00:00.000Z',
  paymentIntent: 'pi_1',
  customer: { username: 'ann', email: 'ann@x.com' },
  expert: { username: 'eli', email: 'eli@x.com' },
  groupChat: { type: 'seminar', name: 'Quantum 101', status: 'active', start: '2026-10-05T15:00:00.000Z' },
};

describe('paymentRecord', () => {
  it('names the student and the expert, or says the user is unknown', () => {
    expect(paymentUser(charge).label).toBe('ann → eli');
    expect(paymentUser({ ...charge, expert: null }).label).toBe('ann');
    expect(paymentUser({ customer: null, expert: null })).toEqual({ label: 'Unknown user', missing: true });
    expect(paymentHeader(toPaymentRow({ customer: null, expert: null, amount: 100, currency: 'usd' }))).toMatchObject({ title: 'Unknown user', unknownUser: true });
  });

  it('carries the booking for the Booking section', () => {
    const row = toPaymentRow(charge);
    expect(row).toMatchObject({ id: 'p1', groupName: 'Quantum 101', groupType: 'seminar', bookingStart: '2026-10-05T15:00:00.000Z' });
  });

  it('reads booking kinds in plain words', () => {
    expect(bookingKindLabel('seminar')).toBe('Seminar');
    expect(bookingKindLabel('individual')).toBe('1:1 session');
    expect(bookingKindLabel('community')).toBe('Community');
  });

  it('shows both emails, the live tag only when asked, and the booking', () => {
    const { rerender } = render(<PaymentDetailFields row={toPaymentRow(charge)} variant="payment" />);
    expect(screen.getByText('Student email')).toBeInTheDocument();
    expect(screen.getByText('Expert email')).toBeInTheDocument();
    expect(screen.queryByText('live · charge')).toBeNull();
    expect(screen.getByText('Quantum 101')).toBeInTheDocument();
    expect(screen.getByText('Seminar')).toBeInTheDocument();
    rerender(<PaymentDetailFields row={toPaymentRow(charge)} variant="payment" showLiveMode />);
    expect(screen.getByText('live · charge')).toBeInTheDocument();
  });

  it('a refund reads as a refund: Reason and Refunded, no booking section', () => {
    render(<PaymentDetailFields row={toPaymentRow({ ...charge, paymentType: 'refund', description: 'Refund: student asked' })} variant="refund" />);
    expect(screen.getByRole('heading', { name: 'Refund' })).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Refunded')).toBeInTheDocument();
    expect(screen.queryByText('Booking')).toBeNull();
  });
});
