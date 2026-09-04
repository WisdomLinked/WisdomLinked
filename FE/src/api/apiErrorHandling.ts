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

/** Review-status feature blocks return 401 with this copy — not a dead session. */
function isUnderReviewBlock(responseData: unknown): boolean {
    let text = '';
    if (typeof responseData === 'string') {
        text = responseData;
    } else if (responseData && typeof responseData === 'object') {
        const obj = responseData as Record<string, unknown>;
        if (typeof obj.error === 'string') text = obj.error;
        else if (typeof obj.message === 'string') text = obj.message;
    }
    return /under review/i.test(text);
}

function shouldForceLogout(responseCode: number | undefined, responseData: unknown): boolean {
    if (responseCode !== 401 && responseCode !== 403) return false;
    if (isCsrfError(responseData, responseCode)) return false;
    if (isUnderReviewBlock(responseData)) return false;
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
    options: HandleApiFailureOptions = {},
): ApiFailure | AuthApiFailBody {
    const logoutOnAuth = options.logoutOnAuth !== false;
    const err = error as { response?: { status?: number; data?: unknown }; status?: number; parsedBody?: unknown };
    const responseCode = err?.response?.status ?? err?.status;
    const responseData = err?.response?.data ?? err?.parsedBody;

    if (logoutOnAuth && shouldForceLogout(responseCode, responseData)) {
        store.dispatch(logoutUser());
        SetLoadingStatus(false);
        return false;
    }

    SetLoadingStatus(false);
    return { status: 'FAIL', error: resolveUserFacingError(error) };
}
