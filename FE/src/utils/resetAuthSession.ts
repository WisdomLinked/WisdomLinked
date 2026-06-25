import { store } from '../store';
import { actionTypes } from '../actions/types';
import { callLogout } from '../api/api';
import { clearCsrfToken, bootstrapCsrfToken } from '../api/csrf';
import { clearClientAccessTokenCookie } from './authCookie';

export type ResetAuthSessionOptions = {
    /** When false, skip POST /auth/logout (e.g. backend already cleared httpOnly cookie). */
    skipLogoutPost?: boolean;
    /** When true, fetch a fresh CSRF token after clearing state. */
    rebootstrapCsrf?: boolean;
};

/** Clear client auth state without a full-page logout redirect. */
export async function resetAuthSessionForLogin(
    options: ResetAuthSessionOptions = {},
): Promise<void> {
    clearClientAccessTokenCookie();
    localStorage.removeItem('isLoginRemembered');
    localStorage.removeItem('currentUser');
    store.dispatch({ type: actionTypes.logout });

    clearCsrfToken();

    if (!options.skipLogoutPost) {
        try {
            await callLogout();
        } catch {
            // Best-effort; OAuth failure redirects may have already cleared the cookie.
        }
    }

    if (options.rebootstrapCsrf) {
        try {
            await bootstrapCsrfToken();
        } catch {
            // Caller may bootstrap CSRF separately (e.g. WLLogin mount).
        }
    }
}
