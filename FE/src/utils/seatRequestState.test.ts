import { describe, expect, it } from 'vitest';

import { indexSeatRequests, seatRequestFor } from './seatRequestState';

const NOW = Date.parse('2026-08-14T12:00:00Z');
const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

const row = (over: Record<string, unknown> = {}) => ({
  _id: 'req-1',
  status: 'pending',
  amount: 2500,
  groupChat: { _id: 'sem-1', seriesId: null },
  ...over,
});

describe('indexSeatRequests', () => {
  it('treats a request awaiting the host as open', () => {
    const index = indexSeatRequests([row()], NOW);
    expect(seatRequestFor(index, { _id: 'sem-1' })?.state).toBe('awaiting_host');
  });

  it('treats an approved but unpaid seat as open, in its own state', () => {
    // The bug: this read as "no request", so the seminar page offered the
    // join-the-waiting-list button to someone already holding an approved seat.
    const index = indexSeatRequests(
      [row({ status: 'awaiting_payment', paymentDeadline: inHours(20) })],
      NOW,
    );
    const entry = seatRequestFor(index, { _id: 'sem-1' });
    expect(entry?.state).toBe('awaiting_payment');
    expect(entry?.price).toBe(25);
    expect(entry?.requestId).toBe('req-1');
  });

  it('drops an approval whose payment window has lapsed', () => {
    // The seat is about to be released, so the student may ask again.
    const index = indexSeatRequests(
      [row({ status: 'awaiting_payment', paymentDeadline: inHours(-1) })],
      NOW,
    );
    expect(seatRequestFor(index, { _id: 'sem-1' })).toBeNull();
  });

  it('ignores requests that are already settled', () => {
    const settled = ['approved', 'rejected', 'expired', 'failed'].map((status, i) =>
      row({ _id: `r${i}`, status }),
    );
    const index = indexSeatRequests(settled, NOW);
    expect(seatRequestFor(index, { _id: 'sem-1' })).toBeNull();
  });

  it('matches any occurrence of a recurring series', () => {
    const index = indexSeatRequests(
      [row({ groupChat: { _id: 'sem-1', seriesId: 'series-9' } })],
      NOW,
    );
    // The request was made against one occurrence; every occurrence is covered.
    expect(seatRequestFor(index, { _id: 'sem-2', seriesId: 'series-9' })?.state).toBe(
      'awaiting_host',
    );
  });

  it('prefers an unpaid approval over a pending request for the same seminar', () => {
    const index = indexSeatRequests(
      [
        row({ _id: 'older', status: 'pending' }),
        row({ _id: 'approved', status: 'awaiting_payment', paymentDeadline: inHours(5) }),
      ],
      NOW,
    );
    // The approval is the one the student can act on.
    expect(seatRequestFor(index, { _id: 'sem-1' })?.requestId).toBe('approved');
  });

  it('survives missing and malformed input', () => {
    expect(seatRequestFor(indexSeatRequests(null, NOW), { _id: 'sem-1' })).toBeNull();
    expect(seatRequestFor(indexSeatRequests(undefined, NOW), { _id: 'sem-1' })).toBeNull();
    expect(seatRequestFor(indexSeatRequests([{}], NOW), { _id: 'sem-1' })).toBeNull();
    expect(seatRequestFor(null, { _id: 'sem-1' })).toBeNull();
    expect(seatRequestFor(indexSeatRequests([row()], NOW), null)).toBeNull();
  });

  it('accepts a seminar id passed as a bare reference', () => {
    const index = indexSeatRequests([row({ groupChat: 'sem-1' })], NOW);
    expect(seatRequestFor(index, { id: 'sem-1' })?.state).toBe('awaiting_host');
  });

  it("carries who started the request, so the student is not told they asked", () => {
    const index = indexSeatRequests(
      [row({ _id: 'invited', status: 'awaiting_payment', paymentDeadline: inHours(20), origin: 'host' })],
      NOW,
    );
    expect(seatRequestFor(index, { _id: 'sem-1' })?.origin).toBe('host');

    const asked = indexSeatRequests(
      [row({ _id: 'asked', status: 'awaiting_payment', paymentDeadline: inHours(20) })],
      NOW,
    );
    expect(seatRequestFor(asked, { _id: 'sem-1' })?.origin).toBe('student');
  });
});
