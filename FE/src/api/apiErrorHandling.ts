import { store } from '../store';
import { showErrorAlert } from '../actions/alertActions';
import { logoutUser } from '../actions/authActions';
import { SetLoadingStatus } from '../actions/appActions';
import { resolveUserFacingError } from '../utils/resolveUserFacingError';
import { isCsrfError } from './csrf';

export type ApiFailure = false;

export type AuthApiFailBody = { status: 'FAIL'; error: string };

export type HandleApiFailureOptions = {
    /** When false, caller shows inline FormAlert (auth flows). Default true. */
    notify?: boolean;
    /** When false, 401/403 do not force logout. Default true. */
    logoutOnAuth?: boolean;
};

function hasStoredSession(): boolean {
    try {
        const raw = localStorage.getItem('currentUser');
        if (!raw || raw === '{}' || raw === 'undefined') return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed?.email);
    } catch {
        return false;
    }
}

function shouldForceLogout(responseCode: number | undefined, responseData: unknown): boolean {
    if (responseCode !== 401 && responseCode !== 403) return false;
    if (isCsrfError(responseData, responseCode)) return false;
    return hasStoredSession();
}

export function handleApiFailure(
    error: unknown,
    options: HandleApiFailureOptions = {},
): ApiFailure {
    const notify = options.notify !== false;
    const logoutOnAuth = options.logoutOnAuth !== false;

    const err = error as { response?: { status?: number; data?: unknown }; status?: number };
    const responseCode = err?.response?.status ?? err?.status;
    const responseData = err?.response?.data;

    if (logoutOnAuth && shouldForceLogout(responseCode, responseData)) {
        store.dispatch(logoutUser());
        SetLoadingStatus(false);
        return false;
    }

    if (notify) {
        store.dispatch(showErrorAlert(resolveUserFacingError(error)));
    }

    SetLoadingStatus(false);
    return false;
}

/** @deprecated Use handleApiFailure — kept for incremental migration */
export function checkForAuthorization(error: unknown): ApiFailure {
    return handleApiFailure(error, { notify: true });
}

export function handleAuthApiFailure(
    error: unknown,
): ApiFailure | AuthApiFailBody {
    const err = error as { response?: { status?: number; data?: unknown }; status?: number };
    const responseCode = err?.response?.status ?? err?.status;
    const responseData = err?.response?.data;

    if (shouldForceLogout(responseCode, responseData)) {
        store.dispatch(logoutUser());
        SetLoadingStatus(false);
        return false;
    }

    SetLoadingStatus(false);
    return { status: 'FAIL', error: resolveUserFacingError(error) };
}
