import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callLogout = vi.fn(async () => {});

vi.mock('../api/api', () => ({ getMe: vi.fn(), callLogout: () => callLogout() }));
vi.mock('../api/csrf', () => ({ clearCsrfToken: vi.fn() }));
vi.mock('../utils/authCookie', () => ({ clearClientAccessTokenCookie: vi.fn() }));
vi.mock('../components/ImpersonationBanner', () => ({ clearImpersonationSession: vi.fn() }));
vi.mock('../components/helpBot/types', () => ({ clearHelpBotSession: vi.fn() }));
vi.mock('./chatActions', () => ({ resetChatAction: () => ({ type: 'resetChatAction' }) }));
vi.mock('./friendActions', () => ({ resetFriendsAction: () => ({ type: 'resetFriendsAction' }) }));

import { LOGOUT_TO_HOMEPAGE, logoutUser } from './authActions';
import { actionTypes } from './types';

const originalLocation = window.location;

describe('logoutUser', () => {
  beforeEach(() => {
    callLogout.mockClear();
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '/user/studentdashboard' } });
    window.localStorage.setItem('currentUser', JSON.stringify({ email: 's@test.com' }));
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    window.localStorage.clear();
  });

  it('sends an automatic logout to the login page', async () => {
    await logoutUser()(vi.fn());
    expect(window.location.href).toBe('/login');
  });

  it('sends a Logout click to the homepage', async () => {
    expect(LOGOUT_TO_HOMEPAGE).toBe('/');
    await logoutUser(LOGOUT_TO_HOMEPAGE)(vi.fn());
    expect(window.location.href).toBe('/');
  });

  it('ends the session before leaving the page', async () => {
    const dispatch = vi.fn((action: any) => {
      expect(window.location.href).toBe('/user/studentdashboard');
      return action;
    });
    await logoutUser(LOGOUT_TO_HOMEPAGE)(dispatch);

    expect(callLogout).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('currentUser')).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: actionTypes.logout });
    expect(window.location.href).toBe('/');
  });
});
