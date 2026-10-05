import { describe, expect, it } from 'vitest';
import {
  buildClientRows,
  dedupeById,
  filterAndSort,
  formatLastSession,
  formatNextSession,
  summaryCounts,
  type ClientFilters,
} from './clientModel';

const NOW = new Date('2026-10-02T09:00:00').getTime();
const HOUR = 3600000;
const DAY = 24 * HOUR;
const iso = (t: number) => new Date(t).toISOString();

const me = { _id: 'exp1' };
const ana = { _id: 's1', username: 'Ana Lopez', role: 'customer', image: 'img-ana' };
const ben = { _id: 's2', username: 'Ben Kim', role: 'customer' };
const cai = { _id: 's3', username: 'Cai Wu', role: 'customer' };
const dee = { _id: 's4', username: 'Dee Park', role: 'customer' };

const userDetails = {
  ...me,
  groupChats: [
    // Ana: one past and one upcoming booked session.
    { type: 'individual', status: 'active', admin: 'exp1', participants: [ana], start: iso(NOW - 8 * DAY), end: iso(NOW - 8 * DAY + HOUR) },
    { type: 'individual', status: 'active', admin: 'exp1', participants: [ana], start: iso(NOW + DAY), end: iso(NOW + DAY + HOUR) },
    // Ben: a pending proposal only.
    { type: 'individual', status: 'pending', admin: 'exp1', createdBy: 'exp1', participants: [ben], start: iso(NOW + 3 * DAY), end: iso(NOW + 3 * DAY + HOUR) },
    // Another expert's session must be ignored.
    { type: 'individual', status: 'active', admin: 'other', participants: [dee], start: iso(NOW + DAY), end: iso(NOW + DAY + HOUR) },
    { type: 'seminar', status: 'active', admin: 'exp1', participants: [dee], start: iso(NOW + DAY), end: iso(NOW + DAY + HOUR) },
  ],
  events: [
    // Cai: a legacy accepted event in the past -> idle.
    { expert: 'exp1', customer: cai, status: 'accepted', start: iso(NOW - 20 * DAY), end: iso(NOW - 20 * DAY + HOUR) },
  ],
  directConversations: [
    { rcChannelId: 'rid-dee', participants: [me, dee], lastMessageAt: iso(NOW - HOUR) },
    { rcChannelId: 'rid-ana', participants: [me, ana] },
    { rcChannelId: 'rid-admin', participants: [me, { _id: 'adm', username: 'Admin', role: 'admin' }] },
  ],
};

const directory = [
  { ...ana, currentUniversity: 'MIT', degreeSought: 'PhD Robotics', keywords: [{ _id: 'k1', value: 'Engineering' }] },
  { ...ben, currentUniversity: 'Stanford', keywords: [{ _id: 'k2', value: 'Biology' }] },
  { ...ana, currentUniversity: 'MIT' },
  { _id: 's9', username: 'Zed Stranger', role: 'customer' },
];

const rows = buildClientRows({ directory, userDetails, unreadByRid: { 'rid-ana': 3 }, scope: 'mine', now: NOW });
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
const base: ClientFilters = { query: '', status: 'all', field: 'all', sortBy: 'next' };

describe('clientModel', () => {
  it('dedupes by id, keeping the first occurrence', () => {
    expect(dedupeById(directory).map((u) => u._id)).toEqual(['s1', 's2', 's9']);
  });

  it('builds "my clients" from my sessions, events and student chats only', () => {
    expect(rows.map((r) => r.id).sort()).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('derives status, counts and dates', () => {
    expect(byId.s1).toMatchObject({ status: 'upcoming', sessionsCount: 2, nextSessionAt: NOW + DAY, lastSessionAt: NOW - 8 * DAY, unread: 3 });
    expect(byId.s2).toMatchObject({ status: 'pending', sessionsCount: 0, nextSessionAt: null });
    expect(byId.s3).toMatchObject({ status: 'idle', sessionsCount: 1 });
    expect(byId.s4).toMatchObject({ status: 'new', sessionsCount: 0, unread: 0 });
  });

  it('merges directory details into relationship rows', () => {
    expect(byId.s1).toMatchObject({ school: 'MIT', goal: 'PhD Robotics', fields: ['Engineering'], image: 'img-ana' });
  });

  it('"all students" lists the deduped directory with derived status', () => {
    const all = buildClientRows({ directory, userDetails, unreadByRid: {}, scope: 'all', now: NOW });
    expect(all.map((r) => [r.id, r.status])).toEqual([
      ['s1', 'upcoming'],
      ['s2', 'pending'],
      ['s9', 'new'],
    ]);
  });

  it('counts the summary bar', () => {
    expect(summaryCounts(rows, NOW)).toEqual({ thisWeek: 1, pending: 1, new: 1, idle: 1 });
  });

  it('searches name, school and goal', () => {
    expect(filterAndSort(rows, { ...base, query: 'stanford' }).map((r) => r.id)).toEqual(['s2']);
    expect(filterAndSort(rows, { ...base, query: 'robotics' }).map((r) => r.id)).toEqual(['s1']);
    expect(filterAndSort(rows, { ...base, query: 'cai' }).map((r) => r.id)).toEqual(['s3']);
  });

  it('filters by status and field', () => {
    expect(filterAndSort(rows, { ...base, status: 'idle' }).map((r) => r.id)).toEqual(['s3']);
    expect(filterAndSort(rows, { ...base, field: 'Biology' }).map((r) => r.id)).toEqual(['s2']);
  });

  it('sorts four ways', () => {
    const ids = (sortBy: ClientFilters['sortBy']) => filterAndSort(rows, { ...base, sortBy }).map((r) => r.id);
    expect(ids('next')[0]).toBe('s1');
    expect(ids('name')).toEqual(['s1', 's2', 's3', 's4']);
    expect(ids('sessions')).toEqual(['s1', 's3', 's2', 's4']);
    expect(ids('recent')[0]).toBe('s4');
  });

  it('formats session dates', () => {
    expect(formatNextSession(null, NOW)).toBeNull();
    expect(formatNextSession(new Date('2026-10-03T10:30:00').getTime(), NOW)).toBe('Tomorrow, 10:30 AM');
    expect(formatNextSession(new Date('2026-10-03T10:30:00').getTime() + DAY, NOW)).toBe('Sun, 10:30 AM');
    expect(formatNextSession(new Date('2026-10-12T14:00:00').getTime(), NOW)).toBe('Oct 12, 2:00 PM');
    expect(formatLastSession(new Date('2026-09-24T12:00:00').getTime(), NOW)).toBe('Sep 24');
    expect(formatLastSession(new Date('2025-09-24T12:00:00').getTime(), NOW)).toBe('Sep 24, 2025');
  });
});
