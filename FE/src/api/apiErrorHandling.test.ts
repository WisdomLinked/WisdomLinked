import { describe, expect, it, vi, beforeEach } from 'vitest';

const dispatch = vi.fn();
const getState = vi.fn(() => ({ auth: { userDetails: null } }));
const logoutUser = vi.fn(() => ({ type: 'LOGOUT' }));
const showErrorAlert = vi.fn((msg: string) => ({ type: 'SHOW_ALERT', payload: msg }));
const SetLoadingStatus = vi.fn();

vi.mock('../store', () => ({ store: { dispatch, getState } }));
vi.mock('../actions/authActions', () => ({ logoutUser }));
vi.mock('../actions/alertActions', () => ({ showErrorAlert }));
vi.mock('../actions/appActions', () => ({ SetLoadingStatus }));

describe('apiErrorHandling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getState.mockReturnValue({ auth: { userDetails: null } });
        localStorage.clear();
    });

    it('handleApiFailure dispatches toast when notify is true', async () => {
        const { handleApiFailure } = await import('./apiErrorHandling');
        const result = handleApiFailure({
            response: { status: 500, data: { error: 'Server error' } },
        });
        expect(result).toBe(false);
        expect(showErrorAlert).toHaveBeenCalledWith('Server error');
    });

    it('handleAuthApiFailure returns FAIL body without toast', async () => {
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({
            response: { status: 500, data: { error: 'Invalid credentials. Please try again.' } },
        });
        expect(result).toEqual({
            status: 'FAIL',
            error: 'Invalid credentials. Please try again.',
        });
        expect(showErrorAlert).not.toHaveBeenCalled();
    });

    it('handleAuthApiFailure logs out on 401 when session exists', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({ response: { status: 401 } });
        expect(result).toBe(false);
        expect(logoutUser).toHaveBeenCalled();
    });

    it('handleAuthApiFailure does not logout on 401 without stored session', async () => {
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({ response: { status: 401 } });
        expect(result).toEqual({
            status: 'FAIL',
            error: expect.any(String),
        });
        expect(logoutUser).not.toHaveBeenCalled();
    });

    it('handleAuthApiFailure does not logout on CSRF 403', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({
            response: {
                status: 403,
                data: { code: 'EBADCSRFTOKEN', error: 'Invalid or missing CSRF token.' },
            },
        });
        expect(result).toEqual({
            status: 'FAIL',
            error: expect.stringContaining('CSRF'),
        });
        expect(logoutUser).not.toHaveBeenCalled();
    });

    it('handleApiFailure does not logout when stored user is under review (generic 401 body)', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'review' }));
        const { handleApiFailure } = await import('./apiErrorHandling');
        const result = handleApiFailure({
            response: { status: 401, data: 'Something went wrong. Please try again.' },
        });
        expect(result).toBe(false);
        expect(logoutUser).not.toHaveBeenCalled();
        expect(showErrorAlert).toHaveBeenCalled();
    });

    it('handleAuthApiFailure does not logout on UNDER_REVIEW code', async () => {
        localStorage.setItem('currentUser', JSON.stringify({ email: 'a@test.com', status: 'active' }));
        const { handleAuthApiFailure } = await import('./apiErrorHandling');
        const result = handleAuthApiFailure({
            response: {
                status: 401,
                data: {
                    status: 'FAIL',
                    error: 'Something went wrong. Please try again.',
                    code: 'UNDER_REVIEW',
                },
            },
        });
        expect(result).toEqual({
            status: 'FAIL',
            error: 'Something went wrong. Please try again.',
        });
        expect(logoutUser).not.toHaveBeenCalled();
    });
});
