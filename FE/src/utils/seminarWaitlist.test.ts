import { describe, expect, it } from 'vitest';
import {
  admitConfirmation,
  admitCountFromInput,
  admitResultMessage,
  groupWaitlistBySeminar,
  isLegacyHeldSeatRequest,
  maxAttendeesAfterAdmit,
  waitlistJoinHeadline,
  waitlistJoinNotices,
} from './seminarWaitlist';

const row = (id: string, seminarId: string, over: any = {}) => ({
  _id: id,
  createdAt: '2026-11-01T10:00:00Z',
  customer: { _id: `user-${id}`, username: `name-${id}` },
  groupChat: { _id: seminarId, name: `Seminar ${seminarId}`, start: '2026-12-01T10:00:00Z' },
  ...over,
});

describe('isLegacyHeldSeatRequest', () => {
  it('is true only for requests holding a payment', () => {
    expect(isLegacyHeldSeatRequest({ paymentIntent: 'pi_1' })).toBe(true);
    expect(isLegacyHeldSeatRequest({ paymentMode: 'wallet', amount: 500 })).toBe(true);
    expect(isLegacyHeldSeatRequest({ paymentMode: 'wallet', amount: 0 })).toBe(false);
    expect(isLegacyHeldSeatRequest({ paymentMode: 'card', amount: 500 })).toBe(false);
  });
});

describe('groupWaitlistBySeminar', () => {
  it('groups by seminar, keeps join order, and puts the soonest seminar first', () => {
    const later = { _id: 'b', name: 'Later', start: '2027-01-01T10:00:00Z', seriesId: 'series' };
    const groups = groupWaitlistBySeminar(
      [
        row('1', 'b', { groupChat: later }),
        row('2', 'a'),
        row('3', 'b', { groupChat: later }),
      ],
      { a: { occupied: 50, maxAttendees: 50 } },
    );
    expect(groups.map(g => g.seminarId)).toEqual(['a', 'b']);
    expect(groups[1].students.map(s => s.name)).toEqual(['name-1', 'name-3']);
    expect(groups[1].recurring).toBe(true);
    expect(groups[0].recurring).toBe(false);
    expect(groups[0].seats).toEqual({ occupied: 50, maxAttendees: 50 });
  });

  it('leaves out held requests and rows with no seminar', () => {
    const groups = groupWaitlistBySeminar([
      row('1', 'a', { paymentIntent: 'pi_1' }),
      row('2', 'a', { groupChat: null }),
    ]);
    expect(groups).toEqual([]);
  });

  it('falls back to email, then a plain label, for the name', () => {
    const groups = groupWaitlistBySeminar([
      row('1', 'a', { customer: { email: 'x@y.com' } }),
      row('2', 'a', { customer: null }),
    ]);
    expect(groups[0].students.map(s => s.name)).toEqual(['x@y.com', 'Student']);
  });
});

describe('admitCountFromInput', () => {
  it.each([
    ['3', 5, 3],
    [' 3 ', 5, 3],
    ['5', 5, 5],
    ['99', 5, 5],
  ])('reads %j with %i waiting as %i', (input, waiting, expected) => {
    expect(admitCountFromInput(input, waiting)).toBe(expected);
  });

  it.each(['', '  ', '0', '-1', '1.5', 'abc', '2x'])('refuses %j', input => {
    expect(admitCountFromInput(input, 5)).toBeNull();
  });
});

describe('maxAttendeesAfterAdmit', () => {
  it('rises only as far as needed', () => {
    expect(maxAttendeesAfterAdmit({ occupied: 50, maxAttendees: 50 }, 3)).toBe(53);
    expect(maxAttendeesAfterAdmit({ occupied: 40, maxAttendees: 50 }, 3)).toBe(50);
    expect(maxAttendeesAfterAdmit({ occupied: 10, maxAttendees: null }, 3)).toBeNull();
  });
});

describe('admitConfirmation', () => {
  it('says how the limit changes', () => {
    expect(admitConfirmation({ occupied: 50, maxAttendees: 50 }, 1)).toBe(
      'Admit 1 student from the waitlist? Max attendees goes from 50 to 51.',
    );
    expect(admitConfirmation({ occupied: 40, maxAttendees: 50 }, 2)).toBe(
      'Admit 2 students from the waitlist? Max attendees stays at 50.',
    );
    expect(admitConfirmation({ occupied: 40, maxAttendees: null }, 2)).toBe(
      'Admit 2 students from the waitlist?',
    );
  });
});

describe('admitResultMessage', () => {
  it('separates students who must pay from those already enrolled', () => {
    expect(
      admitResultMessage('Calculus', {
        admitted: 3,
        awaitingPayment: 2,
        enrolled: 1,
        stillWaiting: 0,
        maxAttendees: 53,
      }),
    ).toBe(
      '3 students admitted to “Calculus”. 2 students must pay by the deadline to keep the seat. 1 student enrolled. Max attendees is now 53.',
    );
  });

  it('skips the parts that do not apply', () => {
    expect(
      admitResultMessage('Calculus', {
        admitted: 1,
        awaitingPayment: 0,
        enrolled: 1,
        stillWaiting: 0,
        maxAttendees: null,
      }),
    ).toBe('1 student admitted to “Calculus”. 1 student enrolled.');
  });
});

describe('waitlistJoinNotices', () => {
  const NOW = Date.parse('2026-11-05T12:00:00Z');
  const HOUR = 3600_000;
  const joined = (id: string, seminarId: string, hoursAgo: number, over: any = {}) => ({
    _id: id,
    createdAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
    customer: { _id: `u-${id}`, username: `Student ${id}` },
    groupChat: { _id: seminarId, name: `Seminar ${seminarId}`, start: '2026-12-01T10:00:00Z' },
    ...over,
  });
  const seats = { a: { occupied: 2, maxAttendees: 2 } };

  it('groups by seminar, newest name and newest seminar first, with the whole waitlist counted', () => {
    const result = waitlistJoinNotices(
      [joined('1', 'a', 5), joined('2', 'a', 1), joined('3', 'b', 3), joined('old', 'a', 60)],
      seats,
      NOW,
    );
    expect(result.map(n => n.seminarId)).toEqual(['a', 'b']);
    expect(result[0].names).toEqual(['Student 2', 'Student 1']);
    expect(result[0].waiting).toBe(3);
    expect(result[0].seats).toEqual(seats.a);
    expect(result[0].latestJoinAt).toBe(new Date(NOW - HOUR).toISOString());
  });

  it('puts the seminar with the latest join first, whatever its date', () => {
    const result = waitlistJoinNotices(
      [joined('1', 'a', 5), joined('2', 'b', 1)],
      seats,
      NOW,
    );
    expect(result.map(n => n.seminarId)).toEqual(['b', 'a']);
  });

  it('leaves out dismissed, too old and older held requests', () => {
    const result = waitlistJoinNotices(
      [
        joined('read', 'a', 1, { expertNoticeReadAt: new Date(NOW).toISOString() }),
        joined('old', 'a', 48),
        joined('held', 'a', 1, { paymentIntent: 'pi_1', amount: 4000 }),
      ],
      seats,
      NOW,
    );
    expect(result).toEqual([]);
  });

  it('a new student brings the banner back after a dismissal, naming only them', () => {
    const result = waitlistJoinNotices(
      [joined('read', 'a', 3, { expertNoticeReadAt: new Date(NOW).toISOString() }), joined('new', 'a', 1)],
      seats,
      NOW,
    );
    expect(result[0].names).toEqual(['Student new']);
    expect(result[0].waiting).toBe(2);
  });

  it.each([
    [['Ana'], 'Ana joined the waitlist for “X”.'],
    [['Ana', 'Ben'], 'Ana and Ben joined the waitlist for “X”.'],
    [['Ana', 'Ben', 'Cy'], 'Ana, Ben and 1 other joined the waitlist for “X”.'],
    [['Ana', 'Ben', 'Cy', 'Di'], 'Ana, Ben and 2 others joined the waitlist for “X”.'],
  ])('headline for %j', (names, expected) => {
    expect(waitlistJoinHeadline({ names, title: 'X' })).toBe(expected);
  });
});
