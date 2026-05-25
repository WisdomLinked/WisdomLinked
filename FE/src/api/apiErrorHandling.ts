import { store } from '../store';
import { showErrorAlert } from '../actions/alertActions';
import { logoutUser } from '../actions/authActions';
import { SetLoadingStatus } from '../actions/appActions';
import { resolveUserFacingError } from '../utils/resolveUserFacingError';

export type ApiFailure = false;

export type AuthApiFailBody = { status: 'FAIL'; error: string };

export type HandleApiFailureOptions = {
    /** When false, caller shows inline FormAlert (auth flows). Default true. */
    notify?: boolean;
    /** When false, 401/403 do not force logout. Default true. */
    logoutOnAuth?: boolean;
};

export function handleApiFailure(
    error: unknown,
    options: HandleApiFailureOptions = {},
): ApiFailure {
    const notify = options.notify !== false;
    const logoutOnAuth = options.logoutOnAuth !== false;

    const err = error as { response?: { status?: number }; status?: number };
    const responseCode = err?.response?.status ?? err?.status;

    if (logoutOnAuth && (responseCode === 401 || responseCode === 403)) {
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
    const err = error as { response?: { status?: number }; status?: number };
    const responseCode = err?.response?.status ?? err?.status;

    if (responseCode === 401 || responseCode === 403) {
        store.dispatch(logoutUser());
        SetLoadingStatus(false);
        return false;
    }

    SetLoadingStatus(false);
    return { status: 'FAIL', error: resolveUserFacingError(error) };
}
