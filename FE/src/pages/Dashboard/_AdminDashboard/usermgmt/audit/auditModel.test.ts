import { describe, expect, it } from 'vitest';
import {
  buildConversations,
  communityMemberTag,
  communityMembersFromChat,
  conversationKindLabel,
  formatAfterAppointment,
  formatCallTime,
  formatCount,
  formatPerWeek,
  emptySectionCopy,
  filterConversations,
  initialsFromName,
  paymentDisplayStatus,
  paymentSummary,
} from './auditModel';

const user = {
  _id: 'expert-1',
  username: 'Ada Expert',
  email: 'ada@x.com',
  role: 'expert',
  status: 'active',
  createdAt: '2024-03-12T00:00:00.000Z',
  generalChats: [
    { _id: 'g-global', name: 'Global Chat', admin: { _id: 'x' }, participants: [] },
    { _id: 'g-admin', name: 'Admin', admin: { _id: 'x' }, participants: [] },
    {
      _id: 'g-1',
      name: 'Cohort A',
      description: 'Weekly check-in',
      admin: { _id: 'expert-1' },
      participants: [{ _id: 's1', username: 'Sam' }],
      createdAt: '2024-04-01T00:00:00.000Z',
    },
  ],
  groupChats: [
    {
      _id: 'a-1',
      name: '1:1 with Priya',
      type: 'individual',
      start: '2024-01-03T18:00:00.000Z',
      participants: [{ _id: 'f-1', username: 'Priya Student' }],
    },
    {
      _id: 's-1',
      name: 'Essay workshop',
      description: 'Bring a draft',
      start: '2024-01-01T18:00:00.000Z',
      end: '2024-01-01T19:00:00.000Z',
      duration: 60,
      participants: [
        { _id: 'expert-1', username: 'Ada Expert' },
        { _id: 's1', username: 'Sam' },
      ],
    },
  ],
};

describe('auditModel conversations', () => {
  it('buckets communities, 1:1 appointments and seminars and skips Global Chat and Admin', () => {
    const buckets = buildConversations(user);
    expect(buckets.group.map(item => item.id)).toEqual(['g-1']);
    expect(buckets.group[0].title).toBe('General Chat');
    expect(buckets.appointments.map(item => item.title)).toEqual(['1:1 with Priya']);
    expect(buckets.appointments[0].appointmentSource?.type).toBe('individual');
    expect(buckets.seminars.map(item => item.title)).toEqual(['Essay workshop']);
    expect(buckets.seminars[0].seminar?.status).toBe('Completed');
    expect(buckets.seminars[0].seminar?.attendeeCount).toBe(2);
  });

  it('keeps empty sections addressable', () => {
    const empty = buildConversations({ _id: 'x', generalChats: [], groupChats: [] });
    expect(empty.group).toEqual([]);
    expect(empty.appointments).toEqual([]);
    expect(empty.seminars).toEqual([]);
    expect(emptySectionCopy('private')).toBe('No 1:1 appointments on this account.');
    expect(emptySectionCopy('group')).toBe('No community chats on this account.');
    expect(conversationKindLabel('group')).toBe('Community');
    expect(conversationKindLabel('private')).toBe('1:1');
  });

  it('filters by title, preview and segment', () => {
    const buckets = buildConversations(user);
    expect(filterConversations(buckets.all, 'priya', 'all').map(item => item.kind)).toEqual(['private']);
    expect(filterConversations(buckets.all, '', 'seminar')).toHaveLength(1);
    expect(filterConversations(buckets.all, 'missing', 'all')).toHaveLength(0);
  });

  it('builds two-letter initials', () => {
    expect(initialsFromName('Ada Expert')).toBe('AE');
    expect(initialsFromName('')).toBe('?');
  });
});

describe('auditModel payments', () => {
  it('excludes refunded rows and reports expert net from the current commission', () => {
    const summary = paymentSummary([
      { _id: '1', amount: 10000, status: 'completed', paymentType: 'charge' },
      { _id: '2', amount: 4000, status: 'refunded', paymentType: 'refund' },
      { _id: '3', amount: 2500, status: 'pending', paymentType: 'charge' },
      { _id: '4', amount: 1500, status: 'withheld', paymentType: 'charge' },
    ], 'expert');
    expect(summary.gross).toBe(14000);
    expect(summary.fees).toBe(2800);
    expect(summary.paidOut).toBe(0);
    expect(summary.readyToPay).toBe(8000);
    expect(summary.pending).toBe(3200);
    expect(summary.net).toBe(8000);
  });

  it('uses the stored snapshot for an expert, including a free session', () => {
    const summary = paymentSummary([
      {
        _id: 'paid',
        amount: 10300,
        status: 'completed',
        paymentType: 'charge',
        sessionType: 'oneToOne',
        advertisedCents: 10000,
        platformFeeCents: 300,
        taxCents: 0,
        commissionCents: 2000,
        expertNetCents: 8000,
      },
      {
        _id: 'free',
        amount: 100,
        status: 'completed',
        paymentType: 'charge',
        sessionType: 'seminar',
        advertisedCents: 0,
        platformFeeCents: 100,
        taxCents: 0,
        commissionCents: 0,
        expertNetCents: 0,
      },
    ], 'expert', { seminarCommissionPercent: 50, oneToOneCommissionPercent: 50 });
    expect(summary.gross).toBe(10000);
    expect(summary.fees).toBe(2000);
    expect(summary.paidOut).toBe(0);
    expect(summary.readyToPay).toBe(8000);
  });

  it('counts paid out as recorded cheques and leaves that month out of ready to pay', () => {
    const summary = paymentSummary([
      {
        _id: 'mar',
        amount: 1000,
        status: 'completed',
        paymentType: 'charge',
        createdAt: '2026-03-15T00:00:00.000Z',
      },
      {
        _id: 'apr',
        amount: 1000,
        status: 'completed',
        paymentType: 'charge',
        createdAt: '2026-04-02T00:00:00.000Z',
      },
      {
        _id: 'pend',
        amount: 1000,
        status: 'pending',
        paymentType: 'charge',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ], 'expert', undefined, [{ year: 2026, month: 3, amountCents: 800 }]);
    expect(summary.paidOut).toBe(800);
    expect(summary.readyToPay).toBe(800);
    expect(summary.pending).toBe(800);
    expect(summary.net).toBe(1600);
  });

  it('splits a student charge into price, platform fee and tax, including tax on a free session', () => {
    const summary = paymentSummary([
      {
        _id: 'free',
        amount: 100,
        status: 'completed',
        paymentType: 'charge',
        advertisedCents: 0,
        platformFeeCents: 100,
        taxCents: 0,
      },
      {
        _id: 'taxed',
        amount: 108,
        status: 'completed',
        paymentType: 'charge',
        advertisedCents: 0,
        platformFeeCents: 100,
        taxCents: 8,
      },
      {
        _id: 'paid',
        amount: 11124,
        status: 'completed',
        paymentType: 'charge',
        advertisedCents: 10000,
        platformFeeCents: 300,
        taxCents: 824,
        commissionCents: 2000,
        expertNetCents: 8000,
      },
    ], 'student');
    expect(summary.priceCollected).toBe(10000);
    expect(summary.fees).toBe(500);
    expect(summary.tax).toBe(832);
    expect(summary.paidOut).toBe(11332);
  });

  it('does not invent a platform fee on a historical free student payment', () => {
    const summary = paymentSummary([
      { _id: 'old', amount: 0, status: 'completed', paymentType: 'charge' },
    ], 'student');
    expect(summary.priceCollected).toBe(0);
    expect(summary.fees).toBe(0);
    expect(summary.tax).toBe(0);
  });

  it('maps statuses onto Completed, Pending and Refunded pills', () => {
    expect(paymentDisplayStatus({ status: 'completed' }).label).toBe('Completed');
    expect(paymentDisplayStatus({ status: 'pending' }).label).toBe('Pending');
    expect(paymentDisplayStatus({ status: 'withheld' }).label).toBe('Pending');
    expect(paymentDisplayStatus({ status: 'refunded' }).label).toBe('Refunded');
  });
});

describe('community members', () => {
  it('lists everyone once, strongest role first, even though the owner is also a participant', () => {
    const members = communityMembersFromChat({
      admin: { _id: 'o1', username: 'Owner' },
      coModerators: [{ _id: 'm1', username: 'Mod' }],
      participants: [{ _id: 'o1', username: 'Owner' }, { _id: 'm1', username: 'Mod' }, { _id: 's1', username: 'Sam' }],
      chatAdmins: [{ _id: 'a1', username: 'Staff' }],
    });
    expect(members.map(m => [m._id, m.communityRole])).toEqual([
      ['o1', 'owner'],
      ['m1', 'co-moderator'],
      ['s1', 'member'],
      ['a1', 'platform-admin'],
    ]);
    expect(communityMembersFromChat({})).toEqual([]);
  });

  it('tags the audited user and anyone with a community role', () => {
    const member = { _id: 's1', communityRole: 'member' as const };
    expect(communityMemberTag(member, 's1')).toBe('Audited');
    expect(communityMemberTag(member, 'x')).toBe('');
    expect(communityMemberTag({ _id: 'o1', communityRole: 'owner' }, 'x')).toBe('Owner');
    expect(communityMemberTag({ _id: 'm1', communityRole: 'co-moderator' }, 'x')).toBe('Co-moderator');
  });

  it('carries community details for the title popup', () => {
    const buckets = buildConversations({
      _id: 'x',
      generalChats: [{ _id: 'g1', name: 'Cohort', description: 'About', isOpenToAll: true, admin: { _id: 'o1' }, participants: [{ _id: 'o1' }] }],
    });
    expect(buckets.group[0].group).toMatchObject({ name: 'Cohort', description: 'About', isOpenToAll: true });
    expect(buckets.group[0].group?.members).toHaveLength(1);
  });

  it('shows unknown numbers as a dash, not zero', () => {
    expect(formatCount(null)).toBe('—');
    expect(formatCount(1234)).toBe('1,234');
    expect(formatPerWeek(null)).toBe('—');
    expect(formatPerWeek(2.25)).toBe('2.3');
    expect(formatPerWeek(0)).toBe('0');
  });
});

describe('1:1 appointment call time', () => {
  const base = { bookedMinutes: 30, calledMinutes: 29, timeStatus: 'recorded' as const, callsDuring: 1, callsAfter: 0, messagesAfter: 0, scheduledEnd: null };
  it('reads as call time against booked time', () => {
    expect(formatCallTime(base)).toBe('29 of 30 min');
    expect(formatCallTime({ ...base, bookedMinutes: null })).toBe('29 min');
    expect(formatCallTime({ ...base, timeStatus: 'no-call', calledMinutes: 0 })).toBe('No call');
    expect(formatCallTime({ ...base, timeStatus: 'in-progress' })).toBe('Call in progress');
  });
  it('summarises what happened after the booked end', () => {
    expect(formatAfterAppointment({ ...base, callsAfter: 1, messagesAfter: 1 })).toBe('1 call · 1 message');
    expect(formatAfterAppointment({ ...base, callsAfter: 2, messagesAfter: 7 })).toBe('2 calls · 7 messages');
    expect(formatAfterAppointment({ ...base, messagesAfter: null })).toBe('0 calls · messages unavailable');
  });
});

