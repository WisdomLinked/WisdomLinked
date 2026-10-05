import { describe, expect, it } from 'vitest';
import {
  filterPublicExperts,
  findRecentRateCandidates,
  getPopularExperts,
  getRecommendedExperts,
  getStudentTodos,
  getUpcomingSeminarsForStudent,
  profileCompletionPercent,
  studentHasMatchSignals,
} from './studentDiscovery';

describe('studentDiscovery', () => {
  it('filters admins, inactive, and obvious test emails', () => {
    const list = filterPublicExperts([
      { _id: '1', role: 'expert', status: 'active', email: 'a@x.com' },
      { _id: '2', role: 'admin', status: 'active', email: 'admin@x.com' },
      { _id: '3', role: 'expert', status: 'review', email: 'b@x.com' },
      { _id: '4', role: 'expert', status: 'active', email: 'qa+test@x.com' },
    ]);
    expect(list.map((e) => e._id)).toEqual(['1']);
  });

  it('returns only future open seminars the student is not in', () => {
    const now = Date.parse('2026-06-01T12:00:00Z');
    const seminars = [
      {
        _id: 'past',
        start: '2026-05-01T12:00:00Z',
        participants: [{ _id: 'host' }],
        maxAttendees: 10,
        admin: { username: 'Host' },
        price: 0,
      },
      {
        _id: 'enrolled',
        start: '2026-07-01T12:00:00Z',
        participants: [{ _id: 'host' }, { _id: 'me' }],
        maxAttendees: 10,
        admin: { username: 'Host' },
        price: 20,
      },
      {
        _id: 'full',
        start: '2026-07-02T12:00:00Z',
        participants: [{ _id: 'host' }, { _id: 'a' }, { _id: 'b' }],
        maxAttendees: 2,
        admin: { username: 'Host' },
        price: 0,
      },
      {
        _id: 'open',
        name: 'Open seminar',
        start: '2026-07-03T12:00:00Z',
        participants: [{ _id: 'host' }],
        maxAttendees: 5,
        admin: { username: 'Host', image: null },
        price: 15,
      },
    ];
    const result = getUpcomingSeminarsForStudent(seminars, 'me', now);
    expect(result.map((s) => s.id)).toEqual(['open']);
    expect(result[0].seatsLeft).toBe(5);
    expect(result[0].price).toBe(15);
  });

  it('asks for profile completion when match signals are missing', () => {
    expect(studentHasMatchSignals({ username: 'Stu' })).toBe(false);
    const rec = getRecommendedExperts(
      [{ _id: 'e1', role: 'expert', status: 'active', keywords: [{ value: 'Chem' }] }],
      { username: 'Stu' },
    );
    expect(rec.needsProfile).toBe(true);
    expect(rec.items).toHaveLength(0);
  });

  it('recommends by keyword overlap and excludes new-expert ids', () => {
    const user = { keywords: [{ value: 'Transportation Engineering' }] };
    const experts = [
      {
        _id: 'keep',
        role: 'expert',
        status: 'active',
        email: 'k@x.com',
        keywords: [{ value: 'Transportation Engineering' }],
        title: 'Mentor',
      },
      {
        _id: 'new',
        role: 'expert',
        status: 'active',
        email: 'n@x.com',
        keywords: [{ value: 'Transportation Engineering' }],
        title: 'New',
      },
      {
        _id: 'other',
        role: 'expert',
        status: 'active',
        email: 'o@x.com',
        keywords: [{ value: 'Biology' }],
        title: 'Bio',
      },
    ];
    const rec = getRecommendedExperts(experts, user, ['new']);
    expect(rec.needsProfile).toBe(false);
    expect(rec.items.map((e) => String(e._id))).toEqual(['keep']);
    expect(rec.items[0].reason).toMatch(/Transportation Engineering/i);
  });

  it('ranks popular experts by rating then followers, preferring ones not excluded', () => {
    const experts = [
      { _id: 'a', role: 'expert', status: 'active', email: 'a@x.com', rating: 4.2, followers: [1] },
      { _id: 'b', role: 'expert', status: 'active', email: 'b@x.com', rating: 4.9 },
      { _id: 'c', role: 'expert', status: 'active', email: 'c@x.com', rating: 4.2, followers: [1, 2] },
      { _id: 'admin', role: 'admin', status: 'active', email: 'x@x.com', rating: 5 },
    ];
    expect(getPopularExperts(experts, ['b']).map((e) => e._id)).toEqual(['c', 'a']);
    expect(getPopularExperts(experts, ['a', 'b', 'c']).map((e) => e._id)).toEqual(['b', 'c', 'a']);
  });

  it('names the full student interest and ignores short partial keyword matches', () => {
    const user = { keywords: [{ value: 'Computer Engineering' }] };
    const experts = [
      { _id: 'short', role: 'expert', status: 'active', email: 's@x.com', keywords: [{ value: 'Co' }] },
      { _id: 'partial', role: 'expert', status: 'active', email: 'p@x.com', keywords: [{ value: 'Computer' }] },
    ];
    const rec = getRecommendedExperts(experts, user);
    expect(rec.items.map((e) => String(e._id))).toEqual(['partial']);
    expect(rec.items[0].reason).toBe('Matches your interest in Computer Engineering');
  });

  it('computes profile completion and gates todos', () => {
    expect(profileCompletionPercent({})).toBe(0);
    const todos = getStudentTodos({
      user: { username: 'Ada' },
      unreadCount: 2,
      paymentItems: [{ id: 'p1', label: 'Seminar A' }],
      rateItems: [{ id: 'r1', expertName: 'Dr. Kim' }],
    });
    expect(todos.some((t) => t.kind === 'profile')).toBe(true);
    expect(todos.some((t) => t.kind === 'messages' && t.label.includes('2'))).toBe(true);
    expect(todos.some((t) => t.kind === 'payment')).toBe(true);
    expect(todos.some((t) => t.kind === 'rate' && t.label.includes('Dr. Kim'))).toBe(true);
    expect(getStudentTodos({ user: null, unreadCount: 0, paymentItems: [], rateItems: [] })).toEqual(
      [],
    );
  });

  it('finds recent ended sessions for rate todos', () => {
    const now = Date.parse('2026-06-15T12:00:00Z');
    const user = {
      _id: 'me',
      groupChats: [
        {
          _id: 'g1',
          type: 'individual',
          end: '2026-06-10T12:00:00Z',
          status: 'accepted',
          participants: [
            { _id: 'me', username: 'Me' },
            { _id: 'ex', username: 'Expert One' },
          ],
        },
      ],
      events: [],
    };
    const found = findRecentRateCandidates(user, 14 * 24 * 60 * 60 * 1000, now);
    expect(found).toEqual([{ id: 'g1', expertName: 'Expert One', expertId: 'ex' }]);
  });
});
