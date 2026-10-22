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
  it('excludes refunded rows from gross earnings and fees', () => {
    const summary = paymentSummary([
      { _id: '1', amount: 10000, status: 'completed', paymentType: 'charge' },
      { _id: '2', amount: 4000, status: 'refunded', paymentType: 'refund' },
      { _id: '3', amount: 2500, status: 'pending', paymentType: 'charge' },
      { _id: '4', amount: 1500, status: 'withheld', paymentType: 'charge' },
    ]);
    expect(summary.gross).toBe(14000);
    expect(summary.fees).toBe(0);
    expect(summary.paidOut).toBe(10000);
    expect(summary.pending).toBe(4000);
    expect(summary.net).toBe(10000);
  });

  it('maps statuses onto Paid out, Pending and Refunded pills', () => {
    expect(paymentDisplayStatus({ status: 'completed' }).label).toBe('Paid out');
    expect(paymentDisplayStatus({ status: 'pending' }).label).toBe('Pending');
    expect(paymentDisplayStatus({ status: 'withheld' }).label).toBe('Pending');
    expect(paymentDisplayStatus({ status: 'refunded' }).label).toBe('Refunded');
  });
});
