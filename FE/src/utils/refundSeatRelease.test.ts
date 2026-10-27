import { describe, expect, it } from 'vitest';
import { seatReleasedByRefund } from './refundSeatRelease';

const NOW = Date.parse('2026-10-23T12:00:00.000Z');
const payment = (groupChat: any) => ({ amount: 2500, customer: { email: 'student@test.com' }, groupChat });

describe('seatReleasedByRefund', () => {
  it('warns for an upcoming or live 1:1 or seminar', () => {
    expect(seatReleasedByRefund(payment({ type: 'individual', name: 'Student & Expert', status: 'active', start: '2026-10-24T10:00:00.000Z', end: '2026-10-24T11:00:00.000Z' }), NOW))
      .toEqual({ sessionName: 'Student & Expert', series: false });
    expect(seatReleasedByRefund(payment({ type: 'seminar', name: 'Clinic', status: 'active', start: '2026-10-23T11:30:00.000Z', end: '2026-10-23T12:30:00.000Z' }), NOW))
      .toEqual({ sessionName: 'Clinic', series: false });
  });

  it('says nothing for a finished or cancelled session', () => {
    expect(seatReleasedByRefund(payment({ type: 'individual', name: 'Done', status: 'active', end: '2026-10-22T11:00:00.000Z' }), NOW)).toBeNull();
    expect(seatReleasedByRefund(payment({ type: 'individual', name: 'Gone', status: 'cancelled', end: '2026-10-24T11:00:00.000Z' }), NOW)).toBeNull();
  });

  it('always warns for a series, whose later dates may still be ahead', () => {
    expect(seatReleasedByRefund(payment({ type: 'seminar', name: 'Weekly', status: 'active', seriesId: 's1', end: '2026-10-01T11:00:00.000Z' }), NOW))
      .toEqual({ sessionName: 'Weekly', series: true });
  });

  it('says nothing without a linked session', () => {
    expect(seatReleasedByRefund(payment(null), NOW)).toBeNull();
    expect(seatReleasedByRefund(payment('ddddddddddddddddddddddd4'), NOW)).toBeNull();
    expect(seatReleasedByRefund(payment({ type: 'community', name: 'Group' }), NOW)).toBeNull();
    expect(seatReleasedByRefund(null, NOW)).toBeNull();
  });

  it('falls back to a generic name', () => {
    expect(seatReleasedByRefund(payment({ type: 'individual', status: 'active' }), NOW)).toEqual({ sessionName: 'this 1:1 session', series: false });
  });
});
