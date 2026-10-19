import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('../hooks/useMarkRoomRead', () => ({
  flushOwedChatReads: vi.fn(async () => { calls.push('flushOwedChatReads'); }),
}));
vi.mock('../api/api', () => ({
  getMe: vi.fn(),
  callLogout: vi.fn(async () => { calls.push('callLogout'); }),
}));
vi.mock('../api/csrf', () => ({
  clearCsrfToken: vi.fn(() => { calls.push('clearCsrfToken'); }),
}));
vi.mock('../utils/authCookie', () => ({
  clearClientAccessTokenCookie: vi.fn(() => { calls.push('clearClientAccessTokenCookie'); }),
}));
vi.mock('../components/ImpersonationBanner', () => ({ clearImpersonationSession: vi.fn() }));
vi.mock('../components/helpBot/types', () => ({ clearHelpBotSession: vi.fn() }));

import { logoutUser } from './authActions';

describe('logoutUser', () => {
  beforeEach(() => {
    calls.length = 0;
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true, configurable: true });
  });

  it('sends any chat read still waiting before the session is cleared', async () => {
    await logoutUser()(vi.fn() as any);
    expect(calls[0]).toBe('flushOwedChatReads');
    expect(calls.indexOf('flushOwedChatReads')).toBeLessThan(calls.indexOf('clearCsrfToken'));
    expect(calls.indexOf('flushOwedChatReads')).toBeLessThan(calls.indexOf('clearClientAccessTokenCookie'));
    expect(calls.indexOf('flushOwedChatReads')).toBeLessThan(calls.indexOf('callLogout'));
    expect(window.location.href).toBe('/login');
  });
});
