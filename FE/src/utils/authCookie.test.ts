import { describe, expect, it } from 'vitest';
import { clearClientAccessTokenCookie } from './authCookie';

describe('authCookie', () => {
    it('clearClientAccessTokenCookie expires the accessToken cookie', () => {
        document.cookie = 'accessToken=test-jwt; path=/';
        clearClientAccessTokenCookie();
        expect(document.cookie).not.toContain('accessToken=test-jwt');
    });
});
