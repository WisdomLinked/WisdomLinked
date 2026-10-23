import { describe, expect, it } from 'vitest';
import {
  buildConversations,
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
  friends: [{ _id: 'f-1', username: 'Priya Student', email: 'priya@x.com' }],
  groupChats: [
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
  it('buckets group, private and seminar chats and skips Global Chat and Admin', () => {
    const buckets = buildConversations(user);
    expect(buckets.group.map(item => item.id)).toEqual(['g-1']);
    expect(buckets.group[0].title).toBe('General Chat');
    expect(buckets.privateChats.map(item => item.title)).toEqual(['Priya Student']);
    expect(buckets.seminars.map(item => item.title)).toEqual(['Essay workshop']);
    expect(buckets.seminars[0].seminar?.status).toBe('Completed');
    expect(buckets.seminars[0].seminar?.attendeeCount).toBe(2);
  });

  it('keeps empty sections addressable', () => {
    const empty = buildConversations({ _id: 'x', generalChats: [], friends: [], groupChats: [] });
    expect(empty.group).toEqual([]);
    expect(empty.privateChats).toEqual([]);
    expect(empty.seminars).toEqual([]);
    expect(emptySectionCopy('private')).toBe('No private chats on this account.');
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
    expect(summary.paidOut).toBe(8000);
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
    expect(summary.paidOut).toBe(8000);
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

  it('maps statuses onto Paid out, Pending and Refunded pills', () => {
    expect(paymentDisplayStatus({ status: 'completed' }).label).toBe('Paid out');
    expect(paymentDisplayStatus({ status: 'pending' }).label).toBe('Pending');
    expect(paymentDisplayStatus({ status: 'withheld' }).label).toBe('Pending');
    expect(paymentDisplayStatus({ status: 'refunded' }).label).toBe('Refunded');
  });
});
