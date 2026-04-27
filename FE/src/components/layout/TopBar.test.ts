import { describe, expect, it } from 'vitest';
import { getTopBarNotificationCount, type TopBarNotificationItem } from './TopBar';

describe('getTopBarNotificationCount', () => {
  it('sums explicit unread counts when provided', () => {
    const items: TopBarNotificationItem[] = [
      { id: '1', title: 'A', meta: '2 unread', unreadCount: 2 },
      { id: '2', title: 'B', meta: '5 unread', unreadCount: 5 },
      { id: '3', title: 'C', meta: '0 unread', unreadCount: 0 },
    ];
    expect(getTopBarNotificationCount(items)).toBe(7);
  });

  it('falls back to item count when unread counts are absent', () => {
    const items: TopBarNotificationItem[] = [
      { id: '1', title: 'A', meta: 'new' },
      { id: '2', title: 'B', meta: 'new' },
    ];
    expect(getTopBarNotificationCount(items)).toBe(2);
  });

  it('ignores invalid and negative unread values', () => {
    const items: TopBarNotificationItem[] = [
      { id: '1', title: 'A', meta: 'x', unreadCount: -5 },
      { id: '2', title: 'B', meta: 'x', unreadCount: Number.NaN },
      { id: '3', title: 'C', meta: 'x', unreadCount: 3 },
    ];
    expect(getTopBarNotificationCount(items)).toBe(3);
  });
});

