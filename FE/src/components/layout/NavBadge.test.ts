import { describe, expect, it } from 'vitest';
import { formatNavBadgeCount } from './NavBadge';

describe('formatNavBadgeCount', () => {
  it('hides zero and invalid counts', () => {
    expect(formatNavBadgeCount(0)).toBeNull();
    expect(formatNavBadgeCount(-3)).toBeNull();
    expect(formatNavBadgeCount(Number.NaN)).toBeNull();
  });

  it('shows the exact count up to 99', () => {
    expect(formatNavBadgeCount(1)).toBe('1');
    expect(formatNavBadgeCount(12)).toBe('12');
    expect(formatNavBadgeCount(99)).toBe('99');
  });

  it('caps at 99+', () => {
    expect(formatNavBadgeCount(100)).toBe('99+');
    expect(formatNavBadgeCount(256)).toBe('99+');
  });
});
